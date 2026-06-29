# Devpost submission — Kajota Pulse (paste-ready)

Copy each block into the matching Devpost field. Links at the bottom go in the sidebar.

---

## Project name
**Kajota Pulse**

## Tagline (one line)
The Bloomberg terminal for African micro-commerce — Gemini tells co-sellers *what to stock*, off live AWS Aurora data.

## Elevator pitch / What it does
Across African micro-commerce, "co-sellers" buy stock from wholesalers and resell to their network for a markup. There are plenty of tools for *writing the listing* — almost none for the question that actually decides whether they make money: **what should I stock this week?**

Kajota Pulse answers it. It's a live dashboard whose every card is a SQL query against **AWS Aurora Serverless v2**, and its headline feature is a one-click **Gemini advisor**: it reads the live signals — trending demand, category margins, competitor stock-outs, price position — and returns a ranked buy-list with a quantified action and a one-line reason for each pick ("Stock 10–15 units — +27 favorites, 18% Beauty margin, and a rival just sold out"). Tap any trending product and a second Gemini call explains *why* it's moving. It doesn't show you numbers and make you guess — it tells you what to do.

## How we built it
Built entirely on the **zero stack**:
- **Vercel** — Next.js 16 (App Router), shadcn/v0 UI, Recharts. `/dashboard` is a dynamic server component; `/api/recommend` + `/api/explain` (Gemini) and `/api/ingest` are serverless functions.
- **AWS Aurora Serverless v2 (PostgreSQL)** — every dashboard number is real SQL (a `v_trending_24h` window-function view, a `percentile_cont` median for the price waterfall, a `DISTINCT ON` latest-stock view, a 30-day margin aggregate). Scales to zero on idle.
- **Gemini 2.5 Flash** — the advisor uses **structured JSON output** (`responseSchema`) with a **deterministic heuristic fallback**, so the card is never empty; plus per-product "Explain why".
- **MongoDB Atlas Database Triggers** — three live triggers stream the real Kajota catalogue (`products`, `cosell_products`, `orders`) into Aurora via `/api/ingest` as it changes.
- **Passwordless** — Vercel reaches Aurora with short-lived **IAM auth tokens** (`@aws-sdk/rds-signer`); no stored DB password anywhere.

## Challenges we ran into
- **The new Aurora networking model forces IAM auth.** Static passwords were rejected; the RDS Data API isn't supported either. We mint a fresh 15-minute IAM token per connection via `pg`'s async-password callback. (Better security posture, as it turns out — no long-lived password.)
- **Vercel's Lambda shadows your AWS credentials.** The Lambda runtime injects its own `AWS_ACCESS_KEY_ID/SECRET` that override yours, so the signer minted tokens with the wrong identity. Fixed by reading creds from custom `PULSE_AWS_*` env names and passing them explicitly to the signer.
- **Real change-streams are messier than seed data.** Wiring the live Atlas triggers surfaced three bugs a fixture never would: MongoDB Extended JSON (`{"$oid"}`, `{"$numberInt"}`) needed decoding; the real collection is `cosell_products` (underscore) not `cosellproducts`; and out-of-order events tripped foreign keys — so we treat each table as an independent event-streamed projection.
- **Free-tier Gemini rate-limits** under bursty use; we added bounded retry-on-429 before the heuristic fallback so a single click is reliable.

## Accomplishments we're proud of
- A genuinely live, passwordless, AWS-Aurora-backed dashboard on Vercel — no servers, no VPC, no stored DB password.
- A Gemini advisor that turns a dashboard into an actual decision tool, with structured output + a never-empty fallback.
- Ingesting **real production data** through MongoDB change streams, with the robustness bugs that only real data exposes already found and fixed.
- One-command verifiability: `node scripts/verify-live.mjs` checks the whole live stack — 5/5.

## What we learned
1. The new Aurora model *forces* passwordless IAM auth — lean into it; it's a few lines once you handle the Lambda credential-shadowing quirk.
2. If you want to know whether your pipeline works, point it at *real* data, not a seed.
3. For an LLM feature in a live demo, use structured output and always ship a deterministic fallback. "Never empty" beats "usually impressive."

## What's next
Pulse is the **monitor** pillar of the 3-app Kajota AI Stack — Coach drafts the listing, Pulse says what to stock, Mesh settles the deal on-chain. Next: unify the three into a single "Build with Gemini" XPRIZE submission, and put the advisor in front of real co-sellers.

## Built With
`next.js` · `vercel` · `aws` · `amazon-aurora` · `postgresql` · `google-gemini` · `mongodb` · `mongodb-atlas` · `typescript` · `tailwindcss` · `recharts` · `shadcn-ui` · `node.js`

## Links (sidebar)
- **Try it out (live):** https://kajota-pulse.vercel.app
- **Dashboard:** https://kajota-pulse.vercel.app/dashboard
- **Demo video:** https://youtu.be/5RY1eXo3Pb0
- **GitHub repo:** https://github.com/KaJota-inc/kajota-pulse
