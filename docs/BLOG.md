# Building a passwordless, Gemini-advised dashboard on the "zero stack" in a weekend

*I built Kajota Pulse and wrote this article as my entry for the **AWS × Vercel "H0: Hack the Zero Stack"** hackathon (**#H0Hackathon**). Live app: [kajota-pulse.vercel.app](https://kajota-pulse.vercel.app) · Code: [github.com/KaJota-inc/kajota-pulse](https://github.com/KaJota-inc/kajota-pulse)*

---

## The problem nobody builds for

Across African micro-commerce, "co-sellers" buy stock from wholesalers and resell to their network for a markup. There's a whole industry of tools for *writing the listing*. There's almost nothing for the question that actually decides whether a co-seller makes money: **what should I stock this week?**

So we built **Kajota Pulse** — a Bloomberg-terminal-style dashboard that watches the marketplace and, in one click, tells a seller what to buy and why. It's the "monitor" pillar of a three-app stack: **Coach** drafts the listing, **Pulse** says what to stock, **Mesh** settles the deal on-chain.

The hackathon constraint was the fun part: build it on the **zero stack** — Vercel for compute, an AWS database for state, no servers to manage. Here's what that actually took.

## Architecture in one breath

Next.js 16 (App Router) on Vercel → **AWS Aurora Serverless v2 (PostgreSQL)** for every number on the dashboard → **Gemini 2.5 Flash** for the advice → **MongoDB Atlas Database Triggers** streaming the real Kajota catalogue in. Five Postgres tables, two SQL views, two Gemini endpoints, one ingest endpoint. No VPC, no connection pooler, no server.

The interesting engineering wasn't the UI. It was three things that don't show up in tutorials.

## Gotcha 1 — Serverless + Aurora forces *passwordless* auth (and that's a feature)

We provisioned Aurora Serverless v2 with the new internet-access-gateway networking model so Vercel could reach it without VPC plumbing. Then every password connection failed with `PAM authentication failed`.

The new model **mandates IAM database authentication** — and as a bonus, it doesn't support the RDS Data API either. So instead of a stored password, every connection mints a short-lived (15-minute) IAM auth token:

```ts
const signer = new Signer({ hostname, port, username, region, credentials });
pool = new Pool({
  host, port, user, database,
  password: () => signer.getAuthToken(), // fresh token at each handshake
  ssl: { rejectUnauthorized: false },
});
```

`pg` supports an async `password` callback, so this is clean. And the security property is genuinely nice: **there is no long-lived database password anywhere** — not in Vercel, not in the repo, not in a secret manager.

## Gotcha 2 — Vercel's Lambda shadows your AWS credentials

This one cost an hour. The IAM signer needs AWS credentials to sign the token. We set `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in Vercel… and it still failed.

Vercel functions run on Lambda, and **the Lambda runtime injects its *own* execution-role `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`**, which shadow yours. The signer was minting tokens with the wrong (no-`rds-db:connect`) identity.

The fix: use custom env names and pass them explicitly to the signer.

```ts
function signerCredentials() {
  const accessKeyId = process.env.PULSE_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.PULSE_AWS_SECRET_ACCESS_KEY;
  return accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined;
}
```

A dedicated IAM user with *only* `rds-db:connect` on the cluster's dbuser resource, surfaced under `PULSE_AWS_*`, and the shadowing problem disappears.

## Gotcha 3 — Real change-streams are messier than seed data

The dashboard is only as good as its data, so we wired **three MongoDB Atlas Database Triggers** on the real Kajota collections (`products`, `cosell_products`, `orders`). Each trigger POSTs its change event to `/api/ingest`, which upserts into Aurora. Hooking this to *production* data immediately surfaced three bugs that a seed file would never reveal:

1. **Extended JSON.** Atlas serializes change events as EJSON, so a Mongo `_id` arrives as `{"$oid":"…"}` and a price as `{"$numberInt":"9500"}` — not as a string and a number. Without decoders you get `id="[object Object]"` and `price=NaN` in your database. Two small helpers (`ejsonId`, `ejsonNum`) fixed it.
2. **Collection naming.** The real collection is `cosell_products` (underscore), but our router matched `cosellproducts`. Events silently fell through as "ignored." Now the router normalizes names.
3. **Foreign keys vs. event ordering.** Change-stream events arrive *out of order* — a co-sell listing can land before the product it references. Our FK constraints silently dropped those rows. The fix is counterintuitive but correct for event-streamed ingestion: **drop the FKs** and treat each table as an independent projection.

None of these reproduce against fixtures. They only appear when real production writes hit your pipeline — which is exactly why we wired it to live data instead of demoing on a seed.

## The feature that makes it an advisor, not a dashboard

A dashboard shows you numbers and makes you do the synthesis. We wanted Pulse to *answer the question*. So `/api/recommend` pulls the live signals — trending demand, category margins, competitor stock-outs, price position — and hands them to Gemini 2.5 Flash with a **structured-output schema**:

> **Organic Shea Butter** → *Stock 10–15 units before the weekend.*
> *"+27 favorites, sits in the high-margin Beauty category (18%), and a competitor just ran out of a similar cream."*

Two details that matter for a demo that can't break:
- **Structured JSON output** (`responseMimeType: "application/json"` + a `responseSchema`) means we render a clean ranked list, not parse prose.
- **A deterministic fallback.** If Gemini is ever unavailable, a heuristic ranking (demand × margin × opportunity) runs instead, so the card is never empty in front of a judge — or a customer.

## What "zero stack" actually bought us

- **No servers.** Vercel functions for the API, Aurora for state. Nothing to patch or scale.
- **Scale to zero.** Aurora Serverless v2 idles to zero ACUs; the cold-start (~8s) is the only tax, and it's easy to pre-warm.
- **One-command verification.** `node scripts/verify-live.mjs` checks the live landing page, the Aurora badge, both Gemini endpoints, the ingest auth gate, and a real IAM-authenticated row count — 5/5. Anyone can run it.

## Takeaways

1. The new Aurora networking model *forces* passwordless IAM auth. Lean into it — it's a better security posture than a stored password, and once you handle the Lambda credential-shadowing quirk, it's a few lines.
2. If you want to know whether your data pipeline works, point it at *real* data, not a seed. The three ingestion bugs we found were all invisible until production writes hit them.
3. For an LLM feature in a live demo, use structured output and always ship a deterministic fallback. "Never empty" beats "usually impressive."

**Live:** [kajota-pulse.vercel.app](https://kajota-pulse.vercel.app) · **Code:** [github.com/KaJota-inc/kajota-pulse](https://github.com/KaJota-inc/kajota-pulse) · Built on Next.js 16 (Vercel) + Aurora Serverless v2 + Gemini 2.5 Flash.

---

### Adapting this post
- **Dev.to / Hashnode / Medium:** publish as-is (add a cover image — the demo GIF works).
- **LinkedIn:** lead with "The new Aurora model won't let you use a password — here's why that's a good thing," then the three gotchas, then the link.
- **X/Bluesky thread:** one gotcha per post (passwordless IAM → Lambda shadowing → EJSON/FK), close with the live link + GIF.
