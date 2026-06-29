# Kajota Pulse — Hack the Zero Stack submission

**Live:** https://kajota-pulse.vercel.app · **Dashboard:** https://kajota-pulse.vercel.app/dashboard
**Repo:** https://github.com/KaJota-inc/kajota-pulse
**Hackathon:** AWS / Vercel — Hack the Zero Stack ($80K, deadline Jun 29, 2026)

---

## Elevator pitch

**The Bloomberg terminal for African micro-commerce.** Across emerging markets, micro-retailers ("co-sellers") buy stock from wholesalers and resell to their network for a markup. The hard part isn't writing listings — it's *knowing what to sell*. Pulse is the real-time pricing-intelligence dashboard that answers it: what's trending, whether your price is competitive, when a competitor's hot item goes out of stock, and which categories carry the best margin.

## How it uses the prescribed stack

| Requirement | How Pulse uses it |
|---|---|
| **AWS Database** | **Aurora Serverless v2 (PostgreSQL 17)** in eu-west-1. 5 tables + 2 SQL views power every card (trending uses a `v_trending_24h` window-function view; price waterfall uses `percentile_cont` median; stock alerts use a `DISTINCT ON` latest-state view; margins use a 30-day aggregate). Scales to zero on idle. |
| **Vercel** | Next.js 16 App Router deployed on Vercel. `/dashboard` is a dynamic server component reading Aurora per request; `/api/ingest` and `/api/explain` are serverless functions. |
| **Zero-ops / serverless** | No servers, no VPC, no connection pooler. Vercel Lambda → Aurora directly over TLS using **short-lived IAM auth tokens** (no stored DB password anywhere). |

## What makes it technically interesting

1. **Passwordless DB auth from serverless.** The Aurora cluster runs the new internet-access-gateway model, which *mandates* IAM database authentication. Every connection mints a fresh 15-minute IAM token via `@aws-sdk/rds-signer` (pg async-password callback). Credentials use custom `PULSE_AWS_*` env names and are passed explicitly to the signer so Vercel's own Lambda execution-role credentials can't shadow them — a subtle but real serverless-on-AWS gotcha, solved.
2. **Graceful degradation.** `loadDashboard()` serves live Aurora data when reachable and falls back to a curated mock on any error, so a paused cluster never produces a 500 in a demo.
3. **Real relational analytics, not a toy.** The trending score is `favorites + shares + 0.1·views` over a 24h window, computed in SQL; the price waterfall is a true median via `percentile_cont`.

## The headline feature: a Gemini *advisor*, not just a dashboard

The hard part of co-selling isn't writing listings — it's **knowing what to sell**. So Pulse doesn't stop at showing signals; it answers the question. One tap on **"What should I stock this week?"** → `POST /api/recommend` reads the **live Aurora signals** (trending demand × category margin × competitor stock-outs × price position) and asks **Gemini 2.5 Flash** (structured JSON output) for a ranked buy-list — each pick a concrete, quantified action with a one-line justification that cites the actual numbers. Live example:

> **Organic Shea Butter 250g** → *Stock 10-15 units before the weekend.*
> *"Trending with +28 favorites and +15 shares, sits in the high-margin Beauty category (18.4% markup), and a competitor just ran out of Premium Body Cream."*

That's the demo's wow moment: a passive dashboard becomes an active advisor in one click. It degrades to a deterministic heuristic ranking if Gemini is ever unreachable, so the card is never empty.

## XPRIZE / Gemini angle (also Aug 17 submission)

Two Gemini surfaces, both reading live Aurora data:
- **`POST /api/recommend`** — the stocking advisor above (the headline Gemini story).
- **`POST /api/explain`** — every trending product has an **"Explain why"** button that calls **Gemini 2.5 Flash** with the product's live signal breakdown and returns a 2-3 sentence explanation plus a concrete next action. Example, live:

> *"Your Ankara Print Slides are trending due to a significant spike in new favorites… consider launching a limited-time flash sale to convert this high interest into immediate sales."*

## The Kajota AI Stack (why this is bigger than one dashboard)

Pulse is the **monitor** pillar of a 3-app stack — all live:
- **Coach** (`kajota-coach`) — snap a photo → AI drafts a full co-sell listing. On Render.
- **Pulse** (this repo) — monitors the marketplace for what to sell. On Vercel + Aurora.
- **Mesh** (`kajota-mesh`) — settles the co-sell deal on-chain (Ethereum Sepolia).

## 60-second demo script

1. Open **https://kajota-pulse.vercel.app** → the landing pitch. Click **Open the dashboard**.
2. Point out the green **`Live · Aurora`** badge (top-right) — this is real data from AWS, not mock.
3. **The money shot — the advisor.** Tap **"What should I stock this week?"** → Gemini reads the live Aurora signals and returns a ranked buy-list with quantified actions and reasons. *This is the product.*
4. **Trending** card: tap the chevron on "Ankara Print Slides" → Gemini explains *why* it's trending. (The signals behind the advice.)
5. **Price waterfall**: your price vs. category median vs. lowest competitor (Recharts).
6. **Stock alerts**: a competitor just went out of stock in a category you sell — your window.
7. **Margin leaderboard**: categories ranked by realised co-sell markup.
8. (Architecture beat) "Every number — and every signal the advisor reasons over — is a SQL query against Aurora Serverless v2, reached from Vercel with passwordless IAM tokens."

## Reproduce / verify

```bash
node scripts/verify-live.mjs   # one-command health check of the live stack
```
Checks landing, the dashboard's `Live · Aurora` badge, Gemini `/api/explain`, the
`/api/ingest` auth gate, and Aurora IAM connectivity. All 5 pass.

See [`README.md`](README.md) (run locally) and [`docs/provisioning-checklist.md`](docs/provisioning-checklist.md) (stand up the AWS side). Schema: [`docs/schema.sql`](docs/schema.sql). Seed: `node scripts/seed.mjs`.

**Ingestion is live and proven:** a real MongoDB Atlas **Database Trigger**
(`Pulse_Trigger`, watching the `products` collection) is wired to `/api/ingest`.
A real Mongo write fires the trigger → POSTs the change-event → upserts into
Aurora — verified end-to-end. The handler decodes MongoDB Extended JSON
(`{"$oid":…}`, `{"$numberInt":…}`) so real catalogue documents land correctly.

## Status

- ✅ Live on Vercel reading live from Aurora (IAM-token auth)
- ✅ **Gemini advisor — "What should I stock this week?"** (`/api/recommend`, ranked buy-list over live signals)
- ✅ shadcn/ui component system (the Vercel v0 stack) + Recharts visualisations
- ✅ Gemini 2.5 Flash "Explain why"
- ✅ Ingestion pipeline proven end-to-end in production — **all 3 Atlas Triggers** (`products`, `cosell_products`, `orders`) verified landing real Mongo writes in Aurora
- ✅ `scripts/verify-live.mjs` — 5/5 checks pass
- ⬜ Optional: open v0.dev to regenerate individual cards (project is v0-ready)
