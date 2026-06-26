# Pulse provisioning checklist

Fill the blanks as you go. Everything downstream copy-pastes from here.

## Captured values

**ARCHITECTURE NOTE (revised Jun 26):** the cluster turned out to be the
new VPC-less / internet-access-gateway Aurora Serverless v2, which does
NOT support the RDS Data API. But it IS internet-reachable, so we use a
**direct `pg` connection** — simpler: no Data API, no Secrets Manager,
no IAM key in the Vercel runtime. Just `DATABASE_URL`.

```
DATABASE_URL        = postgresql://postgres:<password>@pulse.cluster-cnussimqwhoc.eu-west-1.rds.amazonaws.com:5432/postgres?sslmode=require
PULSE_INGEST_SECRET = ____________________ # invent a long random string, e.g. `openssl rand -hex 24`
GEMINI_API_KEY      = ____________________ # same key Coach Agent v2 uses on Render (rotate first!)
GEMINI_MODEL        = gemini-2.5-flash
```

Cluster facts: engine Aurora PostgreSQL **17.7** · master user **`postgres`** ·
endpoint `pulse.cluster-cnussimqwhoc.eu-west-1.rds.amazonaws.com:5432` ·
default database `postgres` (no `pulse` DB was created — we use `postgres`).

---

## Step 1 — Aurora cluster (~10 min)  ☐
RDS → Create database:
✅ Cluster already created (Aurora PostgreSQL 17.7, Serverless v2 0.5–2 ACU,
internet-access-gateway networking).

## Step 1 — Set a known master password (CloudShell)  ☐
The cluster was created self-managed, so reset the password to one you choose:
```bash
openssl rand -base64 18 | tr -dc 'A-Za-z0-9'     # copy the output
aws rds modify-db-cluster --db-cluster-identifier pulse \
  --master-user-password '<PASSWORD>' --apply-immediately --region eu-west-1
```
Build your URL (don't paste it anywhere public):
```
postgresql://postgres:<PASSWORD>@pulse.cluster-cnussimqwhoc.eu-west-1.rds.amazonaws.com:5432/postgres?sslmode=require
```

## Step 2 — Apply schema (~1 min)  ☐
Put the URL in `kajota-pulse/.env.local` (gitignored):
```
DATABASE_URL=postgresql://postgres:<PASSWORD>@pulse.cluster-cnussimqwhoc.eu-west-1.rds.amazonaws.com:5432/postgres?sslmode=require
```
Then from the repo root:
```bash
node scripts/apply-schema.mjs
```
Expect: `Tables created: cosell_listings, engagement_events, price_snapshots, products, stock_events`.

## Step 3 — Vercel env vars (~2 min)  ☐
Vercel → kajota-pulse → **Environment Variables** (outer sidebar, NOT Settings→Environments).
Add, ticking **Production + Preview + Development** for each:
- `DATABASE_URL` (the full URL)
- `PULSE_INGEST_SECRET` (random string)
- `GEMINI_API_KEY` + `GEMINI_MODEL=gemini-2.5-flash`
Then redeploy (any git push, or Deployments → ⋯ → Redeploy). Dashboard
auto-switches to live data — the header badge turns green "Live · Aurora".

## Step 4 — Atlas Triggers (~5 min)  ☐
Atlas → Triggers → 3 Database Triggers (`products`, `cosellproducts`,
`orders`) → Function = paste `docs/atlas-trigger.js`. Store the shared
secret as Atlas Value `PulseIngestSecret` (= your `PULSE_INGEST_SECRET`).

## Smoke test  ☐
```bash
node -e "const{Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});c.connect().then(()=>c.query('SELECT COUNT(*) FROM products')).then(r=>{console.log('products:',r.rows[0].count);return c.end()})"
```
Non-zero after a few minutes of live Atlas-Trigger traffic → real data is flowing.
