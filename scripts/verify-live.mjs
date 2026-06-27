/**
 * verify-live.mjs — one-command health check of the live Pulse stack.
 *
 *   node scripts/verify-live.mjs
 *
 * HTTP checks always run (no creds needed — a judge can run them).
 * The Aurora row-count check runs only when DB creds are present in the
 * environment / .env.local.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const l of (() => { try { return readFileSync(join(repoRoot, '.env.local'), 'utf8').split('\n'); } catch { return []; } })()) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const BASE = process.env.PULSE_BASE_URL ?? 'https://kajota-pulse.vercel.app';
let pass = 0;
let fail = 0;
const ok = (m) => { console.log(`  ✅ ${m}`); pass++; };
const no = (m) => { console.log(`  ❌ ${m}`); fail++; };

console.log(`\nKajota Pulse — live verification (${BASE})\n`);

// 1. landing
{
  const r = await fetch(`${BASE}/`);
  const t = await r.text();
  r.ok && /Bloomberg terminal/.test(t) ? ok('landing renders') : no(`landing HTTP ${r.status}`);
}

// 2. dashboard reads Aurora
{
  const r = await fetch(`${BASE}/dashboard`);
  const t = await r.text();
  if (/Live · Aurora/.test(t)) ok('dashboard badge: Live · Aurora (reading AWS)');
  else if (/Mock data/.test(t)) no('dashboard is serving MOCK (Aurora env not set on Vercel?)');
  else no(`dashboard HTTP ${r.status}`);
}

// 3. Gemini explain
{
  const r = await fetch(`${BASE}/api/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productName: 'Verify Probe', category: 'Beauty', score: 80, signals: { favoritesDelta: 50, sharesDelta: 10, velocityDelta: 2 } }),
  });
  const d = await r.json();
  if (d.model && d.model.startsWith('gemini') && (d.explanation ?? '').length > 80) ok(`Gemini /api/explain (${d.model}, ${d.explanation.length} chars)`);
  else no(`/api/explain weak/unconfigured: model=${d.model}`);
}

// 4. ingest auth gate
{
  const r = await fetch(`${BASE}/api/ingest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  r.status === 401 ? ok('/api/ingest rejects unauthenticated (401)') : no(`/api/ingest auth gate HTTP ${r.status} (expected 401)`);
}

// 5. Aurora row counts (optional — needs creds)
if (process.env.PULSE_DB_HOST && (process.env.PULSE_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID)) {
  try {
    const { Signer } = await import('@aws-sdk/rds-signer');
    const pg = (await import('pg')).default;
    const accessKeyId = process.env.PULSE_AWS_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.PULSE_AWS_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;
    const signer = new Signer({ hostname: process.env.PULSE_DB_HOST, port: 5432, username: process.env.PULSE_DB_USER ?? 'postgres', region: process.env.PULSE_AWS_REGION ?? process.env.AWS_REGION ?? 'eu-west-1', credentials: { accessKeyId, secretAccessKey } });
    const c = new pg.Client({ host: process.env.PULSE_DB_HOST, port: 5432, user: process.env.PULSE_DB_USER ?? 'postgres', database: process.env.PULSE_DB_NAME ?? 'postgres', password: await signer.getAuthToken(), ssl: { rejectUnauthorized: false } });
    await c.connect();
    const r = await c.query('SELECT count(*)::int AS n FROM products');
    r.rows[0].n > 0 ? ok(`Aurora reachable via IAM token — products: ${r.rows[0].n} rows`) : no('Aurora reachable but products table empty (run scripts/seed.mjs)');
    await c.end();
  } catch (e) {
    no(`Aurora check failed: ${e instanceof Error ? e.message : e}`);
  }
} else {
  console.log('  ·  Aurora row-count check skipped (no DB creds in env)');
}

console.log(`\n${fail === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${fail} check(s) failed`} — ${pass} passed\n`);
process.exit(fail === 0 ? 0 : 1);
