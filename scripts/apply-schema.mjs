/**
 * apply-schema.mjs — apply docs/schema.sql to the Pulse Postgres cluster
 * over a direct `pg` connection. Run once after the cluster is up.
 *
 * Reads DATABASE_URL from the environment, or from a local `.env.local`
 * file in the repo root (gitignored — the password never enters git or
 * any chat transcript).
 *
 *   .env.local:
 *     DATABASE_URL=postgresql://postgres:<pw>@pulse.cluster-xxxx.eu-west-1.rds.amazonaws.com:5432/postgres?sslmode=require
 *
 *   node scripts/apply-schema.mjs
 *
 * Uses `pg` (already a project dependency). The connection string —
 * which contains the password — is never logged.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

// --- resolve DATABASE_URL (env first, then .env.local) ----------------
function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const envFile = readFileSync(join(repoRoot, '.env.local'), 'utf8');
    for (const line of envFile.split('\n')) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* no .env.local — fall through */
  }
  return null;
}

const connectionString = resolveDatabaseUrl();
if (!connectionString) {
  console.error(
    'DATABASE_URL not found. Set it in the environment or in kajota-pulse/.env.local.',
  );
  process.exit(1);
}

function splitStatements(sql) {
  return sql
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const statements = splitStatements(readFileSync(join(repoRoot, 'docs', 'schema.sql'), 'utf8'));

try {
  await client.connect();
  console.log(`Connected. Applying ${statements.length} statements ...`);
  for (const stmt of statements) {
    const preview = stmt.split('\n')[0].slice(0, 64);
    process.stdout.write(`  -> ${preview} ... `);
    await client.query(stmt);
    console.log('ok');
  }

  const { rows } = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name",
  );
  console.log('\nTables created:', rows.map(r => r.table_name).join(', ') || '(none)');
  console.log('Done. Set DATABASE_URL on Vercel + redeploy → dashboard flips to live.');
} catch (e) {
  console.error('\nFailed:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await client.end();
}
