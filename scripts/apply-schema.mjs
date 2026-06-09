/**
 * apply-schema.mjs — apply docs/schema.sql to the Aurora cluster via the
 * RDS Data API. Run once after the cluster reaches "Available" and you've
 * captured the two ARNs.
 *
 * Usage:
 *   export AURORA_RESOURCE_ARN="arn:aws:rds:eu-west-1:...:cluster:pulse"
 *   export AURORA_SECRET_ARN="arn:aws:secretsmanager:eu-west-1:...:secret:rds!cluster-..."
 *   export AURORA_DATABASE="pulse"
 *   export AWS_REGION="eu-west-1"
 *   export AWS_ACCESS_KEY_ID="..."
 *   export AWS_SECRET_ACCESS_KEY="..."
 *   node scripts/apply-schema.mjs
 *
 * Reuses @aws-sdk/client-rds-data (already a project dependency).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ExecuteStatementCommand,
  RDSDataClient,
} from '@aws-sdk/client-rds-data';

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, '..', 'docs', 'schema.sql');

const resourceArn = process.env.AURORA_RESOURCE_ARN;
const secretArn = process.env.AURORA_SECRET_ARN;
const database = process.env.AURORA_DATABASE ?? 'pulse';

if (!resourceArn || !secretArn) {
  console.error('Set AURORA_RESOURCE_ARN and AURORA_SECRET_ARN first. See docs/aws-setup.md.');
  process.exit(1);
}

const client = new RDSDataClient({});

/** Split a SQL file into individual statements, stripping line comments. */
function splitStatements(sql) {
  const noComments = sql.replace(/--[^\n]*/g, '');
  return noComments
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
}

async function run(sql) {
  await client.send(
    new ExecuteStatementCommand({ resourceArn, secretArn, database, sql }),
  );
}

const statements = splitStatements(readFileSync(schemaPath, 'utf8'));
console.log(`Applying ${statements.length} statements to "${database}" ...`);

for (const stmt of statements) {
  const preview = stmt.split('\n')[0].slice(0, 64);
  process.stdout.write(`  -> ${preview} ... `);
  try {
    await run(stmt);
    console.log('ok');
  } catch (e) {
    console.log('FAILED');
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

console.log('\nVerifying tables ...');
const res = await client.send(
  new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
  }),
);
const tables = (res.records ?? []).map(r => r[0]?.stringValue).filter(Boolean);
console.log('Tables created:', tables.join(', ') || '(none)');
console.log('\nDone. Next: set the 6 env vars on Vercel and flip dashboard/page.tsx to getDashboardData().');
