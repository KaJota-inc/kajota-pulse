# Pulse provisioning checklist

Fill the blanks as you go. Everything downstream copy-pastes from here.

## Captured values

```
AWS_REGION            = eu-west-1            # or your choice — lock at cluster creation
AURORA_RESOURCE_ARN   = ____________________ # RDS → cluster "pulse" → Configuration → ARN
AURORA_SECRET_ARN     = ____________________ # Secrets Manager → rds!cluster-... → ARN
AURORA_DATABASE       = pulse
AWS_ACCESS_KEY_ID     = ____________________ # IAM → new user → Security credentials → access key
AWS_SECRET_ACCESS_KEY = ____________________ # shown once at key creation
PULSE_INGEST_SECRET   = ____________________ # invent a long random string, e.g. `openssl rand -hex 24`
GEMINI_API_KEY        = ____________________ # same key Coach Agent v2 uses on Render (rotate first!)
GEMINI_MODEL          = gemini-2.5-flash
```

---

## Step 1 — Aurora cluster (~10 min)  ☐
RDS → Create database:
- Aurora (PostgreSQL Compatible) 15.4+
- Template: Production
- Cluster id: `pulse` · Master user: `pulse_admin`
- ✅ Manage master credentials in AWS Secrets Manager
- Aurora Standard storage
- **Serverless v2**, 0.5–2 ACU
- Public access: No
- ✅ **Additional config → RDS Data API: enabled**
- Initial DB name: `pulse`
→ Create. Wait for **Available** (~5 min).

## Step 2 — Capture ARNs (~1 min)  ☐
- Cluster ARN: cluster page → Configuration → ARN → paste above.
- Secret ARN: Secrets Manager → `rds!cluster-…` → paste above.

## Step 3 — IAM user + key (~3 min)  ☐
IAM → Users → Create user `pulse-vercel`:
- No console access.
- Attach policy inline → paste `docs/aws-iam-policy.json`.
- Create access key (type: "Application running outside AWS") → paste both above.

## Step 4 — Apply schema (~1 min)  ☐
From the repo root, with the values exported:
```bash
export AURORA_RESOURCE_ARN AURORA_SECRET_ARN AURORA_DATABASE AWS_REGION \
       AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
node scripts/apply-schema.mjs
```
Expect: `Tables created: cosell_listings, engagement_events, price_snapshots, products, stock_events`.

## Step 5 — Vercel env vars (~2 min)  ☐
Vercel → kajota-pulse → **Environment Variables** (outer sidebar, NOT Settings→Environments):
add all 8 vars above, ticking **Production + Preview + Development** for each.
Then redeploy (any push, or Deployments → ⋯ → Redeploy).

## Step 6 — Flip dashboard to real data + Atlas Triggers (~5 min)  ☐
- One-line change in `src/app/dashboard/page.tsx` (I'll do this on your signal):
  `getMockDashboardData()` → `await getDashboardData()`.
- Atlas → Triggers → 3 Database Triggers (`products`, `cosellproducts`,
  `orders`) → Function that POSTs the changeEvent to
  `https://kajota-pulse.vercel.app/api/ingest` with header
  `X-Pulse-Ingest-Secret: <PULSE_INGEST_SECRET>`. Full snippet in
  `docs/aws-setup.md` §5.

## Smoke test  ☐
```bash
aws rds-data execute-statement --resource-arn "$AURORA_RESOURCE_ARN" \
  --secret-arn "$AURORA_SECRET_ARN" --database pulse \
  --sql "SELECT COUNT(*) FROM products"
```
Non-zero after a few minutes of live Atlas-Trigger traffic → real data is flowing.
