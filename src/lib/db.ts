/**
 * Aurora Serverless v2 (Postgres) client via the AWS RDS Data API.
 *
 * Why the Data API and not a regular Postgres driver?
 *   - Vercel Functions can't open persistent VPC connections.
 *   - Data API speaks plain HTTPS, scales with the function, and
 *     auto-resumes the cluster when it's paused.
 *
 * Configuration (env vars):
 *   AURORA_RESOURCE_ARN   the cluster ARN
 *   AURORA_SECRET_ARN     the Secrets Manager ARN with the DB password
 *   AURORA_DATABASE       the database name (default: pulse)
 *   AWS_REGION            standard AWS SDK env
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY  standard AWS creds
 *
 * Schema lives in `docs/schema.sql`.
 */
import {
  ExecuteStatementCommand,
  type ExecuteStatementCommandInput,
  type Field,
  RDSDataClient,
} from '@aws-sdk/client-rds-data';

import type {
  DashboardData,
  MarginLeaderboardRow,
  PriceWaterfallRow,
  PulseProduct,
  StockAlert,
  TrendingEntry,
} from './types';

// ---------------------------------------------------------------------
//  Client construction (lazy — first call wins)
// ---------------------------------------------------------------------

let cachedClient: RDSDataClient | null = null;

function client(): RDSDataClient {
  if (cachedClient) return cachedClient;
  if (!process.env.AURORA_RESOURCE_ARN || !process.env.AURORA_SECRET_ARN) {
    throw new Error(
      'AURORA_RESOURCE_ARN and AURORA_SECRET_ARN must be set. See docs/aws-setup.md.',
    );
  }
  cachedClient = new RDSDataClient({});
  return cachedClient;
}

/**
 * Execute a parameterised SQL statement against Aurora. Returns the
 * raw rows (each row = array of Field). Caller is responsible for
 * decoding into typed shapes.
 */
async function exec(
  sql: string,
  parameters: ExecuteStatementCommandInput['parameters'] = [],
): Promise<Field[][]> {
  const cmd = new ExecuteStatementCommand({
    resourceArn: process.env.AURORA_RESOURCE_ARN!,
    secretArn: process.env.AURORA_SECRET_ARN!,
    database: process.env.AURORA_DATABASE ?? 'pulse',
    sql,
    parameters,
    includeResultMetadata: false,
  });
  const out = await client().send(cmd);
  return out.records ?? [];
}

/** Tiny helpers for building parameters concisely. */
const p = {
  s: (name: string, value: string) => ({ name, value: { stringValue: value } }),
  n: (name: string, value: number) => ({ name, value: { doubleValue: value } }),
  i: (name: string, value: number) => ({ name, value: { longValue: value } }),
};

/** Decode a Field into a primitive (best-effort). */
function pickValue(f: Field | undefined): string | number | null {
  if (!f) return null;
  if (f.isNull) return null;
  if (f.stringValue != null) return f.stringValue;
  if (f.longValue != null) return f.longValue;
  if (f.doubleValue != null) return f.doubleValue;
  if (f.booleanValue != null) return f.booleanValue ? 1 : 0;
  return null;
}

// ---------------------------------------------------------------------
//  Read-side — dashboard queries
// ---------------------------------------------------------------------

/**
 * Top entry-point for the dashboard page. Returns all 4 cards' data in
 * one round-trip per card. Replaces the W1 mock in `lib/mock.ts`.
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

async function queryTrending(): Promise<TrendingEntry[]> {
  const rows = await exec(
    `SELECT product_id, name, currency, price, category_id, store_id,
            favorites_delta, shares_delta, velocity_delta,
            (favorites_delta + shares_delta + velocity_delta) AS score
       FROM v_trending_24h
      ORDER BY score DESC
      LIMIT 5`,
  );
  return rows.map(r => {
    const fav = (pickValue(r[6]) as number) ?? 0;
    const sh = (pickValue(r[7]) as number) ?? 0;
    const vel = (pickValue(r[8]) as number) ?? 0;
    const product: PulseProduct = {
      id: String(pickValue(r[0]) ?? ''),
      name: String(pickValue(r[1]) ?? ''),
      currency: String(pickValue(r[2]) ?? 'NGN'),
      price: Number(pickValue(r[3]) ?? 0),
      categoryId: pickValue(r[4]) as string | null,
      storeId: pickValue(r[5]) as string | null,
      stockStatus: 'UNKNOWN',
    };
    return {
      product,
      score: Number(pickValue(r[9]) ?? 0),
      signals: { favoritesDelta: fav, sharesDelta: sh, velocityDelta: vel },
    };
  });
}

async function queryPriceWaterfall(sellerId?: string): Promise<PriceWaterfallRow[]> {
  const rows = await exec(
    `SELECT
        COALESCE(category_id, 'Uncategorised') AS category,
        currency,
        MIN(price) AS lowest,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY price) AS median,
        MAX(CASE WHEN store_id = :sellerId THEN price END) AS your_price
      FROM products
     GROUP BY category_id, currency
     ORDER BY median DESC
     LIMIT 8`,
    [p.s('sellerId', sellerId ?? '')],
  );
  return rows.map(r => ({
    category: String(pickValue(r[0]) ?? ''),
    currency: String(pickValue(r[1]) ?? 'NGN'),
    lowestCompetitor: Number(pickValue(r[2]) ?? 0),
    median: Number(pickValue(r[3]) ?? 0),
    yourPrice: pickValue(r[4]) == null ? null : Number(pickValue(r[4])),
  }));
}

async function queryStockAlerts(sellerId?: string): Promise<StockAlert[]> {
  const rows = await exec(
    `SELECT s.product_id, p.name, p.category_id, p.store_id, s.captured_at
       FROM v_latest_stock s
       JOIN products p ON p.id = s.product_id
      WHERE s.stock_status = 'OUT_OF_STOCK'
        AND s.captured_at > now() - interval '24 hours'
        AND (:sellerId = '' OR p.store_id != :sellerId)
      ORDER BY s.captured_at DESC
      LIMIT 10`,
    [p.s('sellerId', sellerId ?? '')],
  );
  return rows.map(r => ({
    id: String(pickValue(r[0]) ?? ''),
    productName: String(pickValue(r[1]) ?? ''),
    category: String(pickValue(r[2]) ?? 'Uncategorised'),
    competitorStoreName: String(pickValue(r[3]) ?? 'Unknown store'),
    detectedAt: String(pickValue(r[4]) ?? ''),
  }));
}

async function queryMarginLeaderboard(): Promise<MarginLeaderboardRow[]> {
  const rows = await exec(
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
    category: String(pickValue(r[0]) ?? ''),
    realisedMarkupPct: Number(pickValue(r[1]) ?? 0),
    cosellCount: Number(pickValue(r[2]) ?? 0),
    currency: String(pickValue(r[3]) ?? 'NGN'),
  }));
}

// ---------------------------------------------------------------------
//  Write-side — ingestion (called from /api/ingest)
// ---------------------------------------------------------------------

/**
 * Upsert a product row. Called when a Mongo `products` change-event
 * arrives. Idempotent: re-running with the same id is safe.
 */
export async function upsertProduct(prod: PulseProduct): Promise<void> {
  await exec(
    `INSERT INTO products (id, name, currency, price, category_id, store_id, stock_status, last_synced_at)
        VALUES (:id, :name, :currency, :price, :categoryId, :storeId, :stockStatus, now())
     ON CONFLICT (id) DO UPDATE SET
        name           = EXCLUDED.name,
        currency       = EXCLUDED.currency,
        price          = EXCLUDED.price,
        category_id    = EXCLUDED.category_id,
        store_id       = EXCLUDED.store_id,
        stock_status   = EXCLUDED.stock_status,
        last_synced_at = now()`,
    [
      p.s('id', prod.id),
      p.s('name', prod.name),
      p.s('currency', prod.currency),
      p.n('price', prod.price),
      prod.categoryId ? p.s('categoryId', prod.categoryId) : { name: 'categoryId', value: { isNull: true } },
      prod.storeId ? p.s('storeId', prod.storeId) : { name: 'storeId', value: { isNull: true } },
      p.s('stockStatus', prod.stockStatus),
    ],
  );
}

/**
 * Append a price snapshot. Always called when product.price changes.
 * Powers the trending velocity signal + waterfall historical context.
 */
export async function recordPriceSnapshot(
  productId: string,
  price: number,
  currency: string,
): Promise<void> {
  await exec(
    `INSERT INTO price_snapshots (product_id, price, currency)
        VALUES (:productId, :price, :currency)
     ON CONFLICT DO NOTHING`,
    [p.s('productId', productId), p.n('price', price), p.s('currency', currency)],
  );
}

/**
 * Append a stock transition. Used by the StockAlerts card.
 */
export async function recordStockEvent(
  productId: string,
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK',
): Promise<void> {
  await exec(
    `INSERT INTO stock_events (product_id, stock_status)
        VALUES (:productId, :stockStatus)
     ON CONFLICT DO NOTHING`,
    [p.s('productId', productId), p.s('stockStatus', stockStatus)],
  );
}

/**
 * Append an engagement signal (favorite / share / view / cosell_create).
 * Drives the trending composite score.
 */
export async function recordEngagement(
  productId: string,
  kind: 'favorite' | 'share' | 'view' | 'cosell_create',
  actorId?: string,
): Promise<void> {
  await exec(
    `INSERT INTO engagement_events (product_id, kind, actor_id)
        VALUES (:productId, :kind, :actorId)`,
    [
      p.s('productId', productId),
      p.s('kind', kind),
      actorId ? p.s('actorId', actorId) : { name: 'actorId', value: { isNull: true } },
    ],
  );
}

/**
 * Upsert a co-sell listing row. Called on cosellproducts change events.
 */
export async function upsertCosellListing(args: {
  id: string;
  productId: string;
  sellerId: string;
  markupPct: number;
  markedUpPrice: number;
  isActive: boolean;
}): Promise<void> {
  await exec(
    `INSERT INTO cosell_listings (id, product_id, seller_id, markup_pct, marked_up_price, is_active)
        VALUES (:id, :productId, :sellerId, :markupPct, :markedUpPrice, :isActive)
     ON CONFLICT (id) DO UPDATE SET
        markup_pct      = EXCLUDED.markup_pct,
        marked_up_price = EXCLUDED.marked_up_price,
        is_active       = EXCLUDED.is_active`,
    [
      p.s('id', args.id),
      p.s('productId', args.productId),
      p.s('sellerId', args.sellerId),
      p.n('markupPct', args.markupPct),
      p.n('markedUpPrice', args.markedUpPrice),
      { name: 'isActive', value: { booleanValue: args.isActive } },
    ],
  );
}
