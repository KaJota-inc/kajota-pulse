/**
 * apply-schema.mjs — apply docs/schema.sql to the Pulse Aurora cluster.
 *
 * The cluster requires IAM database authentication (internet-access-
 * gateway model), so we mint a short-lived IAM auth token instead of
 * using a password. Reads config from the environment or a gitignored
 * `.env.local` in the repo root.
 *
 *   .env.local:
 *     PULSE_DB_HOST=pulse.cluster-xxxx.eu-west-1.rds.amazonaws.com
 *     PULSE_DB_USER=postgres
 *     PULSE_DB_NAME=postgres
 *     AWS_REGION=eu-west-1
 *     AWS_ACCESS_KEY_ID=...
 *     AWS_SECRET_ACCESS_KEY=...
 *
 *   node scripts/apply-schema.mjs
 *
 * (If DATABASE_URL is set instead, it's used verbatim — plain password
 * auth, for a non-IAM Postgres.)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Signer } from '@aws-sdk/rds-signer';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

// --- load .env.local into process.env (only keys not already set) -----
function loadEnvLocal() {
  try {
    const txt = readFileSync(join(repoRoot, '.env.local'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    /* no .env.local */
  }
}
loadEnvLocal();

// --- build a pg client config (IAM token or DATABASE_URL) -------------
async function buildClientConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } };
  }
  const host = process.env.PULSE_DB_HOST;
  if (!host) {
    console.error('Set PULSE_DB_HOST + AWS creds (or DATABASE_URL) in .env.local.');
    process.exit(1);
  }
  const port = Number(process.env.PULSE_DB_PORT ?? 5432);
  const user = process.env.PULSE_DB_USER ?? 'postgres';
  const database = process.env.PULSE_DB_NAME ?? 'postgres';
  const region = process.env.PULSE_AWS_REGION ?? process.env.AWS_REGION ?? 'eu-west-1';
  const accessKeyId = process.env.PULSE_AWS_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.PULSE_AWS_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;
  const signer = new Signer({
    hostname: host,
    port,
    username: user,
    region,
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  });
  const token = await signer.getAuthToken();
  return { host, port, user, database, password: token, ssl: { rejectUnauthorized: false } };
}

function splitStatements(sql) {
  return sql
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
}

const statements = splitStatements(readFileSync(join(repoRoot, 'docs', 'schema.sql'), 'utf8'));
const client = new pg.Client(await buildClientConfig());

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
  console.log('Done. Set the same env vars on Vercel + redeploy → dashboard flips to live.');
} catch (e) {
  console.error('\nFailed:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await client.end();
}
