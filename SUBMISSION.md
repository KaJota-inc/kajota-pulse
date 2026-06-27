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

## XPRIZE / Gemini angle (also Aug 17 submission)

Each trending product has an **"Explain why"** button → `POST /api/explain` calls **Gemini 2.5 Flash** with the product's live signal breakdown and returns a 2-3 sentence explanation plus a concrete next action ("launch a flash sale to convert this favorites spike"). Example, live:

> *"Your Ankara Print Slides are trending due to a significant spike in new favorites… consider launching a limited-time flash sale to convert this high interest into immediate sales."*

## The Kajota AI Stack (why this is bigger than one dashboard)

Pulse is the **monitor** pillar of a 3-app stack — all live:
- **Coach** (`kajota-coach`) — snap a photo → AI drafts a full co-sell listing. On Render.
- **Pulse** (this repo) — monitors the marketplace for what to sell. On Vercel + Aurora.
- **Mesh** (`kajota-mesh`) — settles the co-sell deal on-chain (Ethereum Sepolia).

## 60-second demo script

1. Open **https://kajota-pulse.vercel.app** → the landing pitch. Click **Open the dashboard**.
2. Point out the green **`Live · Aurora`** badge (top-right) — this is real data from AWS, not mock.
3. **Trending** card: tap the chevron on "Ankara Print Slides" → Gemini explains *why* it's trending and what to do. (Gemini + AWS data in one view.)
4. **Price waterfall**: your price vs. category median vs. lowest competitor (Recharts).
5. **Stock alerts**: a competitor just went out of stock in a category you sell — your window.
6. **Margin leaderboard**: categories ranked by realised co-sell markup.
7. (Architecture beat) "Every number is a SQL query against Aurora Serverless v2, reached from Vercel with passwordless IAM tokens."

## Reproduce / run

See [`README.md`](README.md) (run locally) and [`docs/provisioning-checklist.md`](docs/provisioning-checklist.md) (stand up the AWS side). Schema: [`docs/schema.sql`](docs/schema.sql). Seed: `node scripts/seed.mjs`.

## Status

- ✅ Live on Vercel reading live from Aurora
- ✅ Recharts visualisations
- ✅ Gemini "Explain why"
- ⬜ Optional: wire Atlas Triggers for continuous real Kajota production data (`docs/atlas-trigger.js` ready)
- ⬜ Optional: Vercel v0 pass to regenerate cards
