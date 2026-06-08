# AWS provisioning — Pulse data layer

Steps to stand up Aurora Serverless v2 (Postgres) + wire it to the
Mongo Atlas Triggers that feed Pulse. ~20 minutes of clicks total. All
links assume your AWS console region matches `AWS_REGION` in
`.env.local`.

## 1. Create the Aurora cluster

1. Console → **RDS** → **Create database**.
2. Choose **Aurora (PostgreSQL Compatible)**, version **15.4** or newer.
3. Templates → **Production** (Serverless v2's pricing model only needs
   "Provisioned" mode — yes, the naming is confusing).
4. Settings:
   - DB cluster identifier: `pulse`
   - Master username: `pulse_admin`
   - **Manage master credentials in AWS Secrets Manager** ← tick this.
     We'll need the secret ARN later.
5. Cluster storage configuration → **Aurora Standard**.
6. Instance configuration → **Serverless v2**, capacity range
   **0.5 ACU min / 2 ACU max** (cheap for hackathon traffic; idle drops
   to 0 in ~5 minutes).
7. Connectivity:
   - **Public access: No** (Data API does not need it).
   - VPC: default.
   - Existing security group: default-vpc.
8. **Additional configuration** → **RDS Data API: enabled**. Critical.
9. Initial database name: `pulse`.
10. Create database. Takes ~5 minutes.

## 2. Capture the two ARNs

After the cluster is `Available`:

- Cluster ARN: console → cluster page → **Configuration** tab → **ARN**
  → copy. Looks like `arn:aws:rds:...:cluster:pulse`.
- Secret ARN: console → **Secrets Manager** → find the secret named
  `rds!cluster-...` → copy its ARN.

Set both in `.env.local`:
```
AURORA_RESOURCE_ARN=arn:aws:rds:eu-west-1:111111111111:cluster:pulse
AURORA_SECRET_ARN=arn:aws:secretsmanager:eu-west-1:111111111111:secret:rds!cluster-...
AURORA_DATABASE=pulse
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

For Vercel: set the same four vars in the project dashboard
(Settings → Environment Variables) for the **Production** and
**Preview** environments.

## 3. Apply the schema

The Data API supports running arbitrary SQL. From any machine with the
AWS CLI configured and the env vars above:

```bash
aws rds-data execute-statement \
  --resource-arn   "$AURORA_RESOURCE_ARN" \
  --secret-arn     "$AURORA_SECRET_ARN" \
  --database       pulse \
  --sql "$(cat docs/schema.sql)"
```

Or paste `docs/schema.sql` into the **RDS Query Editor** in the AWS
console (RDS → Query Editor → connect with Secret Manager).

## 4. Configure IAM for the Data API

The IAM user / Vercel role needs these actions on the cluster +
secret:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rds-data:BatchExecuteStatement",
        "rds-data:ExecuteStatement",
        "rds-data:BeginTransaction",
        "rds-data:CommitTransaction",
        "rds-data:RollbackTransaction"
      ],
      "Resource": "arn:aws:rds:*:*:cluster:pulse"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:rds!cluster-*"
    }
  ]
}
```

Attach this to either a dedicated IAM user (whose access key goes into
Vercel's env) or to a Vercel-OIDC role (cleaner; supports per-deploy
ephemeral credentials).

## 5. Wire up Mongo Atlas Triggers

For each of the three collections we ingest from, create one Atlas
Trigger pointed at the deployed Pulse `/api/ingest` endpoint:

1. Atlas console → **Triggers** → **Add Trigger**.
2. Trigger type: **Database**.
3. Cluster: the same one Kajota uses (production cluster).
4. Database: `kajota`. Collection: `products`. Operation type: tick
   **Insert**, **Update**, **Replace**.
5. **Full document on update**: yes.
6. Event Type: **EventBridge** is the long-term right answer, but for
   hackathon speed pick **Function** and have the function POST to
   the webhook:
   ```js
   exports = async function (changeEvent) {
     const url = "https://kajota-pulse.vercel.app/api/ingest";
     await context.http.post({
       url,
       headers: {
         "Content-Type": ["application/json"],
         "X-Pulse-Ingest-Secret": [context.values.get("PulseIngestSecret")]
       },
       body: changeEvent,
       encodeBodyAsJSON: true
     });
   };
   ```
7. Store the shared secret in Atlas → **App Services** → **Values**
   as `PulseIngestSecret`. Set the same value as `PULSE_INGEST_SECRET`
   in Vercel.
8. Repeat for `cosellproducts` and `orders`.

Verify ingestion with the Atlas Trigger logs + Pulse's Vercel function
logs. A successful event shows `{ok:true,handled:"product"}` (or
similar) at HTTP 200.

## 6. Smoke test

Once Aurora has data:
```bash
aws rds-data execute-statement \
  --resource-arn "$AURORA_RESOURCE_ARN" \
  --secret-arn   "$AURORA_SECRET_ARN" \
  --database     pulse \
  --sql "SELECT COUNT(*) FROM products"
```
Should be non-zero after a few minutes of live Atlas-Trigger traffic.

Then flip `src/app/dashboard/page.tsx` from `getMockDashboardData()` to
`await getDashboardData(sellerId)` (one-line change) and redeploy.
