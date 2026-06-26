/**
 * Postgres data layer (direct connection via `pg`).
 *
 * The Pulse cluster is Aurora Serverless v2 with the simplified
 * internet-access-gateway networking model, so it's reachable over a
 * normal TLS Postgres connection — no RDS Data API, no Secrets Manager,
 * no AWS credentials in the Vercel runtime. Just `DATABASE_URL`.
 *
 * Configuration (env var):
 *   DATABASE_URL = postgresql://postgres:<pw>@pulse.cluster-xxxx.eu-west-1.rds.amazonaws.com:5432/postgres?sslmode=require
 *
 * Schema lives in `docs/schema.sql`.
 */
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

import type {
  DashboardData,
  MarginLeaderboardRow,
  PriceWaterfallRow,
  PulseProduct,
  StockAlert,
  TrendingEntry,
} from './types';

// ---------------------------------------------------------------------
//  Pool (lazy singleton — survives warm serverless invocations)
// ---------------------------------------------------------------------

let pool: Pool | null = null;

/**
 * True when DATABASE_URL is present, i.e. the dashboard should try real
 * data instead of the mock. Lets the page auto-switch the moment the
 * env var lands on Vercel — no code change required.
 */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. See docs/provisioning-checklist.md.');
  }
  pool = new Pool({
    connectionString,
    // Aurora requires TLS. We don't pin the RDS CA here (demo-grade);
    // for production, load the rds-combined-ca-bundle and set
    // rejectUnauthorized: true.
    ssl: { rejectUnauthorized: false },
    // Serverless: keep the footprint tiny. One connection per warm
    // instance is plenty for dashboard read traffic.
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  });
  return pool;
}

async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query<T>(sql, params);
  return res.rows;
}

/** Run several statements on one checked-out client (used by ingestion). */
async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------
//  Read-side — dashboard queries
// ---------------------------------------------------------------------

/**
 * Top entry-point for the dashboard page. Returns all 4 cards' data.
 * Replaces the W1 mock in `lib/mock.ts` (via `lib/data.ts`).
 */
export async function getDashboardData(sellerId?: string): Promise<DashboardData> {
  const [trending, priceWaterfall, stockAlerts, marginLeaderboard] = await Promise.all([
    queryTrending(),
    queryPriceWaterfall(sellerId),
    queryStockAlerts(sellerId),
    queryMarginLeaderboard(),
  ]);
  return { trending, priceWaterfall, stockAlerts, marginLeaderboard };
}

interface TrendingRow {
  product_id: string;
  name: string;
  currency: string;
  price: string;
  category_id: string | null;
  store_id: string | null;
  favorites_delta: string;
  shares_delta: string;
  velocity_delta: string;
  score: string;
}

async function queryTrending(): Promise<TrendingEntry[]> {
  const rows = await query<TrendingRow>(
    `SELECT product_id, name, currency, price, category_id, store_id,
            favorites_delta, shares_delta, velocity_delta,
            (favorites_delta + shares_delta + velocity_delta) AS score
       FROM v_trending_24h
      ORDER BY score DESC
      LIMIT 5`,
  );
  return rows.map(r => {
    const product: PulseProduct = {
      id: r.product_id,
      name: r.name,
      currency: r.currency ?? 'NGN',
      price: Number(r.price ?? 0),
      categoryId: r.category_id,
      storeId: r.store_id,
      stockStatus: 'UNKNOWN',
    };
    return {
      product,
      score: Number(r.score ?? 0),
      signals: {
        favoritesDelta: Number(r.favorites_delta ?? 0),
        sharesDelta: Number(r.shares_delta ?? 0),
        velocityDelta: Number(r.velocity_delta ?? 0),
      },
    };
  });
}

interface WaterfallRow {
  category: string;
  currency: string;
  lowest: string;
  median: string;
  your_price: string | null;
}

async function queryPriceWaterfall(sellerId?: string): Promise<PriceWaterfallRow[]> {
  const rows = await query<WaterfallRow>(
    `SELECT
        COALESCE(category_id, 'Uncategorised')                      AS category,
        currency,
        MIN(price)                                                 AS lowest,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY price)         AS median,
        MAX(CASE WHEN store_id = $1 THEN price END)                AS your_price
      FROM products
     GROUP BY category_id, currency
     ORDER BY median DESC
     LIMIT 8`,
    [sellerId ?? ''],
  );
  return rows.map(r => ({
    category: r.category,
    currency: r.currency ?? 'NGN',
    lowestCompetitor: Number(r.lowest ?? 0),
    median: Number(r.median ?? 0),
    yourPrice: r.your_price == null ? null : Number(r.your_price),
  }));
}

interface StockRow {
  product_id: string;
  name: string;
  category_id: string | null;
  store_id: string | null;
  captured_at: string;
}

async function queryStockAlerts(sellerId?: string): Promise<StockAlert[]> {
  const rows = await query<StockRow>(
    `SELECT s.product_id, p.name, p.category_id, p.store_id, s.captured_at
       FROM v_latest_stock s
       JOIN products p ON p.id = s.product_id
      WHERE s.stock_status = 'OUT_OF_STOCK'
        AND s.captured_at > now() - interval '24 hours'
        AND ($1 = '' OR p.store_id IS DISTINCT FROM $1)
      ORDER BY s.captured_at DESC
      LIMIT 10`,
    [sellerId ?? ''],
  );
  return rows.map(r => ({
    id: r.product_id,
    productName: r.name,
    category: r.category_id ?? 'Uncategorised',
    competitorStoreName: r.store_id ?? 'Unknown store',
    detectedAt: new Date(r.captured_at).toISOString(),
  }));
}

interface MarginRow {
  category: string;
  avg_markup: string;
  cosell_count: string;
  currency: string;
}

async function queryMarginLeaderboard(): Promise<MarginLeaderboardRow[]> {
  const rows = await query<MarginRow>(
    `SELECT
        COALESCE(p.category_id, 'Uncategorised') AS category,
        AVG(c.markup_pct)                        AS avg_markup,
        COUNT(*)                                 AS cosell_count,
        MAX(p.currency)                          AS currency
       FROM cosell_listings c
       JOIN products p ON p.id = c.product_id
      WHERE c.is_active = TRUE
        AND c.created_at > now() - interval '30 days'
      GROUP BY p.category_id
      ORDER BY avg_markup DESC
      LIMIT 5`,
  );
  return rows.map(r => ({
    category: r.category,
    realisedMarkupPct: Number(r.avg_markup ?? 0),
    cosellCount: Number(r.cosell_count ?? 0),
    currency: r.currency ?? 'NGN',
  }));
}

// ---------------------------------------------------------------------
//  Write-side — ingestion (called from /api/ingest)
// ---------------------------------------------------------------------

export async function upsertProduct(prod: PulseProduct): Promise<void> {
  await query(
    `INSERT INTO products (id, name, currency, price, category_id, store_id, stock_status, last_synced_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (id) DO UPDATE SET
        name           = EXCLUDED.name,
        currency       = EXCLUDED.currency,
        price          = EXCLUDED.price,
        category_id    = EXCLUDED.category_id,
        store_id       = EXCLUDED.store_id,
        stock_status   = EXCLUDED.stock_status,
        last_synced_at = now()`,
    [
      prod.id,
      prod.name,
      prod.currency,
      prod.price,
      prod.categoryId,
      prod.storeId,
      prod.stockStatus,
    ],
  );
}

export async function recordPriceSnapshot(
  productId: string,
  price: number,
  currency: string,
): Promise<void> {
  await query(
    `INSERT INTO price_snapshots (product_id, price, currency)
        VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [productId, price, currency],
  );
}

export async function recordStockEvent(
  productId: string,
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK',
): Promise<void> {
  await query(
    `INSERT INTO stock_events (product_id, stock_status)
        VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [productId, stockStatus],
  );
}

export async function recordEngagement(
  productId: string,
  kind: 'favorite' | 'share' | 'view' | 'cosell_create',
  actorId?: string,
): Promise<void> {
  await query(
    `INSERT INTO engagement_events (product_id, kind, actor_id)
        VALUES ($1, $2, $3)`,
    [productId, kind, actorId ?? null],
  );
}

export async function upsertCosellListing(args: {
  id: string;
  productId: string;
  sellerId: string;
  markupPct: number;
  markedUpPrice: number;
  isActive: boolean;
}): Promise<void> {
  await query(
    `INSERT INTO cosell_listings (id, product_id, seller_id, markup_pct, marked_up_price, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET
        markup_pct      = EXCLUDED.markup_pct,
        marked_up_price = EXCLUDED.marked_up_price,
        is_active       = EXCLUDED.is_active`,
    [args.id, args.productId, args.sellerId, args.markupPct, args.markedUpPrice, args.isActive],
  );
}

export { withClient };
