# Kajota Pulse — teleprompter (read straight through)

Spoken lines only, in order. Bracketed cues `[…]` are actions, not read aloud. Full detail + checklist: [`DEMO.md`](DEMO.md). Target ~4:00. **Only record once the advisor badge shows `gemini-2.5-flash`, not `heuristic`.**

---

**[Landing page]**

Across African micro-commerce, sellers — we call them co-sellers — buy stock from wholesalers and resell to their network for a markup. The hard part isn't writing the listing. It's *knowing what to sell*. Kajota Pulse is the Bloomberg terminal that answers that question — and it's one of three live apps in our stack: Coach drafts the listing, Pulse tells you what to stock, Mesh settles the deal on-chain.

**[Click "Open the dashboard". Point at the green badge.]**

Everything here is live. That green "Live · Aurora" badge means every card is a SQL query running right now against AWS Aurora Serverless v2 — no mock data, no fixtures. It's built on the zero stack: Next.js on Vercel, a shadcn/v0 UI, Recharts — over Aurora that scales to zero when nobody's looking.

**[Click "Ask the advisor".]**

Here's where Pulse stops being a dashboard you read and becomes an advisor that tells you what to do. One click. Gemini is reading the live Aurora signals — trending demand, category margins, competitor stock-outs, and price position.

**[Result appears — read the actual top pick on screen.]**

It ranks what to stock this week, and every pick fuses three things: demand, margin, and opportunity. Take the top pick here — [read product + reason + "stock N units"]. It tells me exactly how many units to stock, and why — it doesn't show me numbers and make me guess. Under the hood that's Gemini 2.5 Flash returning structured JSON, with a deterministic fallback if the model's ever unavailable, so the card never breaks.

**[Tap the chevron on a trending product.]**

And every signal is interrogable. Tap any trending product and a second Gemini call explains *why* it's moving — a favorites spike on WhatsApp, an influencer feature — and what to do about it. The advice up top is never a black box.

**[Gesture across the four cards as you go.]**

Let me walk the four signals. Trending is a composite of favorites, shares, and views over a rolling 24-hour window — computed in SQL. Price waterfall: your price versus the category median — a *true* median via Postgres percentile_cont — versus the lowest competitor; grey bars mean you're not in that category yet. **[Scroll down.]** Stock alerts: the moment a competitor goes out of stock in a category you sell, it surfaces here — your window to capture their demand. And the margin leaderboard ranks categories by realised co-sell markup, so you stock where the margin actually is.

**[Switch to the terminal. Run `bash scripts/demo-cosell-insert.sh`.]**

Now — is this real, or did I seed it? Watch. I'll write one product into our live MongoDB production database. Three Atlas Database Triggers are watching the real catalogue — that write just fired one. It POSTs the change event to our ingest endpoint on Vercel, which upserts it into Aurora over a passwordless IAM connection. **[Run the watch one-liner / refresh.]** And there it is, landed in Aurora seconds later. This isn't a fixture — it's a live change-data pipeline from production Mongo into AWS.

**[Run `node scripts/verify-live.mjs`.]**

And you don't have to take my word for it. One command checks the whole live stack — the landing page, the Aurora badge, both Gemini endpoints, the ingest auth gate, and a real IAM-authenticated row count straight out of Aurora. Five for five. No servers, no VPC, no stored database password — Vercel talks to Aurora with short-lived IAM tokens.

**[Back to the dashboard.]**

Kajota Pulse: a live, AWS-Aurora-backed, Gemini-powered advisor for African micro-commerce, built end-to-end on the zero stack. Coach drafts, Pulse advises, Mesh settles. It's live at kajota-pulse.vercel.app. Thanks for watching.
