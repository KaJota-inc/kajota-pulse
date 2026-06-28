-- Kajota Pulse — Aurora Serverless v2 (Postgres) schema.
--
-- Designed for the AWS RDS Data API so Next.js Server Actions on
-- Vercel can query without VPC plumbing. All tables are append-only
-- where reasonable (price_snapshots, stock_events) so trending /
-- waterfall calculations are just window-function queries.

-- ----------------------------------------------------------------------
-- products — denormalised copy of the Kajota product, refreshed by the
-- ingestion Lambda on every Mongo change event.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id              TEXT        PRIMARY KEY,             -- Mongo _id
    name            TEXT        NOT NULL,
    currency        CHAR(3)     NOT NULL DEFAULT 'NGN',
    price           NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    category_id     TEXT,
    store_id        TEXT,
    stock_status    TEXT        NOT NULL DEFAULT 'UNKNOWN'
                                  CHECK (stock_status IN ('IN_STOCK','LOW_STOCK','OUT_OF_STOCK','UNKNOWN')),
    last_synced_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_category_idx ON products (category_id);
CREATE INDEX IF NOT EXISTS products_store_idx ON products (store_id);

-- ----------------------------------------------------------------------
-- price_snapshots — every price change a product ever sees. Used for
-- the trending velocity signal + price-waterfall historical context.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS price_snapshots (
    product_id    TEXT          NOT NULL,  -- no FK: ingestion is event-streamed (events arrive out of order)
    captured_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    price         NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    currency      CHAR(3)       NOT NULL,
    PRIMARY KEY (product_id, captured_at)
);
CREATE INDEX IF NOT EXISTS price_snapshots_captured_idx ON price_snapshots (captured_at DESC);

-- ----------------------------------------------------------------------
-- stock_events — append-only log of stock-status transitions. The
-- stock_alerts dashboard card is just `latest_per_product WHERE
-- stock_status='OUT_OF_STOCK' AND captured_at > now() - interval '24h'`.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_events (
    product_id     TEXT          NOT NULL,  -- no FK: ingestion is event-streamed
    captured_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    stock_status   TEXT          NOT NULL
                                   CHECK (stock_status IN ('IN_STOCK','LOW_STOCK','OUT_OF_STOCK')),
    PRIMARY KEY (product_id, captured_at)
);
CREATE INDEX IF NOT EXISTS stock_events_status_time_idx ON stock_events (stock_status, captured_at DESC);

-- ----------------------------------------------------------------------
-- engagement_events — favorites + shares + product-detail-view signals.
-- Drives the trending composite score.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS engagement_events (
    id           BIGSERIAL    PRIMARY KEY,
    product_id   TEXT         NOT NULL,  -- no FK: ingestion is event-streamed
    kind         TEXT         NOT NULL CHECK (kind IN ('favorite','share','view','cosell_create')),
    captured_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actor_id     TEXT
);
CREATE INDEX IF NOT EXISTS engagement_events_lookup_idx
    ON engagement_events (product_id, kind, captured_at DESC);

-- ----------------------------------------------------------------------
-- cosell_listings — replicas of cosellproducts Mongo docs for the
-- margin leaderboard.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cosell_listings (
    id                 TEXT          PRIMARY KEY,
    product_id         TEXT          NOT NULL,  -- no FK: ingestion is event-streamed
    seller_id          TEXT          NOT NULL,
    markup_pct         NUMERIC(6,2)  NOT NULL,
    marked_up_price    NUMERIC(12,2) NOT NULL,
    is_active          BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cosell_listings_seller_idx ON cosell_listings (seller_id);
CREATE INDEX IF NOT EXISTS cosell_listings_active_idx ON cosell_listings (is_active, created_at DESC);

-- ----------------------------------------------------------------------
-- Views — keep dashboard queries simple.
-- ----------------------------------------------------------------------

-- Latest stock status per product (used for stock_alerts card).
CREATE OR REPLACE VIEW v_latest_stock AS
SELECT DISTINCT ON (product_id)
    product_id,
    stock_status,
    captured_at
FROM stock_events
ORDER BY product_id, captured_at DESC;

-- Trending composite score over the last 24h.
CREATE OR REPLACE VIEW v_trending_24h AS
SELECT
    p.id          AS product_id,
    p.name,
    p.currency,
    p.price,
    p.category_id,
    p.store_id,
    COALESCE(SUM(CASE WHEN e.kind='favorite' THEN 1 ELSE 0 END), 0) * 1.0 AS favorites_delta,
    COALESCE(SUM(CASE WHEN e.kind='share'    THEN 1 ELSE 0 END), 0) * 1.0 AS shares_delta,
    COALESCE(SUM(CASE WHEN e.kind='view'     THEN 1 ELSE 0 END), 0) * 0.1 AS velocity_delta
FROM products p
LEFT JOIN engagement_events e
    ON e.product_id = p.id
   AND e.captured_at > now() - interval '24 hours'
GROUP BY p.id;
