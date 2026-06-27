/**
 * seed.mjs — load a realistic demo dataset into the Pulse Aurora cluster
 * so the live dashboard shows genuine AWS-backed numbers (not mock).
 *
 * Idempotent: truncates the 5 tables, then inserts a fresh set of
 * African-marketplace products + engagement / stock / cosell signals
 * timed within the dashboard's windows (24h / 30d).
 *
 * Same IAM-token auth + .env.local loading as apply-schema.mjs.
 *
 *   node scripts/seed.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Signer } from '@aws-sdk/rds-signer';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

for (const line of (() => {
  try {
    return readFileSync(join(repoRoot, '.env.local'), 'utf8').split('\n');
  } catch {
    return [];
  }
})()) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

async function clientConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } };
  }
  const host = process.env.PULSE_DB_HOST;
  const accessKeyId = process.env.PULSE_AWS_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.PULSE_AWS_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;
  const signer = new Signer({
    hostname: host,
    port: Number(process.env.PULSE_DB_PORT ?? 5432),
    username: process.env.PULSE_DB_USER ?? 'postgres',
    region: process.env.PULSE_AWS_REGION ?? process.env.AWS_REGION ?? 'eu-west-1',
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  });
  return {
    host,
    port: Number(process.env.PULSE_DB_PORT ?? 5432),
    user: process.env.PULSE_DB_USER ?? 'postgres',
    database: process.env.PULSE_DB_NAME ?? 'postgres',
    password: await signer.getAuthToken(),
    ssl: { rejectUnauthorized: false },
  };
}

// --- demo dataset ------------------------------------------------------
const PRODUCTS = [
  // id, name, category, price, store, stock
  ['p_ankara_slides', 'Ankara Print Slides', 'Fashion', 4500, 'BoriThreads', 'IN_STOCK'],
  ['p_iphone13', 'Refurbished iPhone 13', 'Electronics', 285000, 'TechSwift', 'IN_STOCK'],
  ['p_shea', 'Organic Shea Butter 250g', 'Beauty', 3200, 'BellaSkin NG', 'IN_STOCK'],
  ['p_adire_pillow', 'Adire Throw Pillow Cover', 'Home', 5800, 'AbujaCrafts', 'IN_STOCK'],
  ['p_earbuds', 'Wireless Earbuds X3', 'Electronics', 18000, 'TechSwift', 'OUT_OF_STOCK'],
  ['p_body_cream', 'Premium Body Cream 500ml', 'Beauty', 6500, 'GlowQueen', 'OUT_OF_STOCK'],
  ['p_raffia_tote', 'Hand-woven Raffia Tote', 'Fashion', 12000, 'AbujaWeaves', 'OUT_OF_STOCK'],
  ['p_jollof_spice', 'Jollof Rice Spice Mix', 'Food', 1500, 'NaijaKitchen', 'IN_STOCK'],
  ['p_sneakers', 'Leather Sneakers', 'Fashion', 22000, 'BoriThreads', 'IN_STOCK'],
  ['p_powerbank', '20000mAh Power Bank', 'Electronics', 14000, 'TechSwift', 'IN_STOCK'],
  ['p_black_soap', 'African Black Soap', 'Beauty', 2500, 'BellaSkin NG', 'IN_STOCK'],
  ['p_wall_art', 'Ankara Wall Art', 'Home', 9500, 'AbujaCrafts', 'IN_STOCK'],
];

// productId -> { favorites, shares, views } over the last 24h
const ENGAGEMENT = {
  p_ankara_slides: [142, 38, 63],
  p_shea: [58, 41, 34],
  p_iphone13: [71, 22, 41],
  p_adire_pillow: [49, 19, 29],
  p_jollof_spice: [25, 30, 50],
  p_sneakers: [30, 15, 20],
  p_black_soap: [18, 12, 15],
};

// products currently out of stock (their stock_event is recent)
const OOS = [
  ['p_earbuds', 2],
  ['p_body_cream', 5],
  ['p_raffia_tote', 8],
];

// cosell listings: productId, markupPct (category avg emerges from these)
const COSELL = [
  ['p_shea', 18.4], ['p_body_cream', 19.2], ['p_black_soap', 17.6], // Beauty ~18
  ['p_ankara_slides', 14.0], ['p_sneakers', 15.1], ['p_raffia_tote', 13.5], // Fashion ~14
  ['p_adire_pillow', 12.7], ['p_wall_art', 12.7], // Home ~12.7
  ['p_iphone13', 7.3], ['p_powerbank', 7.3], // Electronics ~7.3
  ['p_jollof_spice', 6.1], // Food
];

const client = new pg.Client(await clientConfig());
try {
  await client.connect();
  console.log('Connected. Seeding ...');

  await client.query(
    'TRUNCATE products, price_snapshots, stock_events, engagement_events, cosell_listings RESTART IDENTITY CASCADE',
  );

  for (const [id, name, cat, price, store, stock] of PRODUCTS) {
    await client.query(
      `INSERT INTO products (id, name, currency, price, category_id, store_id, stock_status)
       VALUES ($1,$2,'NGN',$3,$4,$5,$6)`,
      [id, name, price, cat, store, stock],
    );
    await client.query(
      `INSERT INTO price_snapshots (product_id, price, currency) VALUES ($1,$2,'NGN')`,
      [id, price],
    );
    await client.query(
      `INSERT INTO stock_events (product_id, stock_status, captured_at)
       VALUES ($1,$2, now() - interval '36 hours')`,
      [id, stock === 'OUT_OF_STOCK' ? 'IN_STOCK' : stock],
    );
  }
  console.log(`  products: ${PRODUCTS.length}`);

  // engagement (spread across the last ~22h)
  let evCount = 0;
  for (const [pid, [fav, sh, vw]] of Object.entries(ENGAGEMENT)) {
    for (const [kind, n] of [['favorite', fav], ['share', sh], ['view', vw]]) {
      await client.query(
        `INSERT INTO engagement_events (product_id, kind, captured_at)
         SELECT $1, $2, now() - (random() * interval '22 hours') FROM generate_series(1, $3)`,
        [pid, kind, n],
      );
      evCount += n;
    }
  }
  console.log(`  engagement_events: ${evCount}`);

  // recent out-of-stock transitions
  for (const [pid, hrsAgo] of OOS) {
    await client.query(
      `INSERT INTO stock_events (product_id, stock_status, captured_at)
       VALUES ($1,'OUT_OF_STOCK', now() - ($2 || ' hours')::interval)`,
      [pid, hrsAgo],
    );
  }
  console.log(`  stock_events (OOS): ${OOS.length}`);

  // cosell listings (within last 30 days)
  let cosellN = 0;
  for (const [pid, markup] of COSELL) {
    const prod = PRODUCTS.find(p => p[0] === pid);
    const marked = Math.round(prod[3] * (1 + markup / 100));
    // a few listings per product so counts look real
    for (let k = 0; k < 1 + (cosellN % 3); k++) {
      await client.query(
        `INSERT INTO cosell_listings (id, product_id, seller_id, markup_pct, marked_up_price, is_active, created_at)
         VALUES ($1,$2,$3,$4,$5,true, now() - (random() * interval '25 days'))`,
        [`${pid}_cs_${k}_${cosellN}`, pid, `seller_${(cosellN % 5) + 1}`, markup, marked],
      );
      cosellN++;
    }
  }
  console.log(`  cosell_listings: ${cosellN}`);

  const t = await client.query('SELECT * FROM v_trending_24h ORDER BY (favorites_delta+shares_delta+velocity_delta) DESC LIMIT 3');
  console.log('\nTop trending (live from Aurora view):');
  for (const r of t.rows) console.log(`  ${r.name}: fav+${r.favorites_delta} share+${r.shares_delta}`);
  console.log('\nSeed complete.');
} catch (e) {
  console.error('Seed failed:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await client.end();
}
