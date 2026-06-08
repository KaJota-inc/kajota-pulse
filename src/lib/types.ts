/**
 * Pulse data shapes.
 *
 * Mirrors the relevant subset of Kajota Mongo documents that are
 * ingested into Aurora Serverless v2 (Postgres). Each field that gets
 * persisted to the Postgres side carries a comment with the target
 * column type.
 *
 * Aurora schema lives in `docs/schema.sql`.
 */

/** A single Kajota product (subset relevant to Pulse views). */
export interface PulseProduct {
  /** Mongo _id, persisted as TEXT PRIMARY KEY in `products`. */
  id: string;
  /** `productName` in Mongo, NOT NULL TEXT. */
  name: string;
  /** `ccy` in Mongo (ISO code), NOT NULL TEXT (3 chars). */
  currency: string;
  /** `price` in Mongo, NUMERIC(12,2). Always positive. */
  price: number;
  /** `categoryIds[0]` in Mongo, TEXT references categories.id. */
  categoryId: string | null;
  /** `storeId`, TEXT. */
  storeId: string | null;
  /** `stockStatus` in Mongo, one of IN_STOCK/LOW_STOCK/OUT_OF_STOCK. */
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
}

/** A "trending" entry — product plus the signals that scored it. */
export interface TrendingEntry {
  product: PulseProduct;
  /** Composite score over the last 24h. Higher = hotter. */
  score: number;
  /** Components, exposed for tooltips and "Explain why" Gemini calls. */
  signals: {
    favoritesDelta: number;
    sharesDelta: number;
    velocityDelta: number;
  };
}

/** One row of the price-waterfall (your price vs. market). */
export interface PriceWaterfallRow {
  category: string;
  yourPrice: number | null;
  median: number;
  lowestCompetitor: number;
  currency: string;
}

/** A stock-out alert — a competitor product that just went OOS in a
 *  category the seller participates in. */
export interface StockAlert {
  id: string;
  productName: string;
  category: string;
  competitorStoreName: string;
  /** ISO timestamp the OOS transition was detected. */
  detectedAt: string;
}

/** One row of the margin leaderboard (categories ranked by realised
 *  co-sell markup). */
export interface MarginLeaderboardRow {
  category: string;
  realisedMarkupPct: number;
  cosellCount: number;
  currency: string;
}

/** Top-level shape the dashboard page consumes. */
export interface DashboardData {
  trending: TrendingEntry[];
  priceWaterfall: PriceWaterfallRow[];
  stockAlerts: StockAlert[];
  marginLeaderboard: MarginLeaderboardRow[];
}
