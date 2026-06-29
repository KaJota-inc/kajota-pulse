/**
 * watch-cosell.mjs — poll Aurora until the demo cosell row lands.
 *
 * The companion to `bash scripts/demo-cosell-insert.sh`. Run this right
 * after the insert and it watches Aurora (via the same passwordless IAM
 * token the app uses) until the `seller_pulse_demo` row appears — proof
 * that the live pipeline fired: Mongo write → Atlas Trigger → /api/ingest
 * → Aurora. Exits as soon as it lands (or after 90s).
 *
 *   node scripts/watch-cosell.mjs
 *
 * Note: cosell demo rows don't surface on the dashboard cards (they join
 * against `products`, and the demo product isn't one), so this direct
 * query is the way to *see* it land.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const line of (() => {
  try { return readFileSync(join(repoRoot, '.env.local'), 'utf8').split('\n'); } catch { return []; }
})()) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { Signer } = await import('@aws-sdk/rds-signer');
const pg = (await import('pg')).default;

const host = process.env.PULSE_DB_HOST;
const region = process.env.PULSE_AWS_REGION ?? process.env.AWS_REGION ?? 'eu-west-1';
const accessKeyId = process.env.PULSE_AWS_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.PULSE_AWS_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;
const user = process.env.PULSE_DB_USER ?? 'postgres';

if (!host || !accessKeyId) {
  console.error('Missing PULSE_DB_HOST / AWS creds — run from ~/Documents/kajota-pulse with .env.local present.');
  process.exit(1);
}

async function queryDemoRow() {
  const signer = new Signer({ hostname: host, port: 5432, username: user, region, credentials: { accessKeyId, secretAccessKey } });
  const c = new pg.Client({ host, port: 5432, user, database: process.env.PULSE_DB_NAME ?? 'postgres', password: await signer.getAuthToken(), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const r = await c.query(
      `SELECT id, product_id, seller_id, markup_pct, marked_up_price, created_at
         FROM cosell_listings
        WHERE seller_id = 'seller_pulse_demo'
        ORDER BY created_at DESC LIMIT 1`,
    );
    return r.rows[0] ?? null;
  } finally {
    await c.end();
  }
}

console.log('\n⏳ Watching Aurora for the demo cosell row (seller_pulse_demo)…  (Ctrl-C to stop)\n');
const TOTAL_SECONDS = 90;
for (let elapsed = 0; elapsed < TOTAL_SECONDS; elapsed += 3) {
  try {
    const row = await queryDemoRow();
    if (row) {
      console.log('✅ LANDED IN AURORA via the live trigger:\n');
      console.log(`   id              ${row.id}`);
      console.log(`   product_id      ${row.product_id}`);
      console.log(`   seller_id       ${row.seller_id}`);
      console.log(`   markup          ${row.markup_pct}%  →  NGN ${row.marked_up_price}`);
      console.log(`   created_at      ${new Date(row.created_at).toISOString()}\n`);
      process.exit(0);
    }
    process.stdout.write(`   waiting… ${elapsed + 3}s\r`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/ENOTFOUND|EAI_AGAIN|ETIMEDOUT/.test(msg)) {
      process.stdout.write(`   local DNS hiccup — is the VPN off? retrying… ${elapsed + 3}s\r`);
    } else {
      console.log('\n   query error:', msg);
    }
  }
  await new Promise(res => setTimeout(res, 3000));
}
console.log('\n\n⏳ No demo row after 90s. Did the insert print INSERTED_ID? Is the VPN off? Re-run the insert and try again.\n');
process.exit(1);
