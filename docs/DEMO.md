# Kajota Pulse — 3–5 minute narrated demo script

For the **Hack the Zero Stack** submission video (spec: **3–5 minutes**). This is a *narrated screen recording* — your voice over the live app. The silent captioned clip (`docs/media/kajota-pulse-demo.mp4`) is the README/gallery asset; **this** is the judged demo video.

Target: **~4:00.** Each beat lists what to **Show**, what to **Say** (read it aloud, lightly paraphrase), and any **Action**. Timings are cumulative.

> Shape borrowed from the 0G / Witness demo (`kajota-witness/docs/DEMO.md`): show real surfaces doing load-bearing work, name the latency instead of apologising for it, and end on a one-command "anyone can verify this" proof.

---

## Before you hit record

- [ ] **Pre-warm Aurora + the advisor** (Serverless v2 scales to zero; first call cold-starts ~8s). ~2 min before recording:
      ```bash
      cd ~/Documents/kajota-pulse
      curl -s -o /dev/null -w 'dashboard %{http_code}\n' https://kajota-pulse.vercel.app/dashboard
      curl -s -X POST https://kajota-pulse.vercel.app/api/recommend | python3 -m json.tool | head -3
      ```
      Repeat until the badge is green and the advisor returns `"source":"aurora"` + `"model":"gemini-2.5-flash"`.
- [ ] **(Optional) Reset to a clean seed** so numbers are tidy: `node scripts/seed.mjs` (ask Claude — it's the hackathon DB, not production).
- [ ] Tabs open: **landing** (`/`), **dashboard** (`/dashboard`). A **terminal** in `~/Documents/kajota-pulse` for the live-ingestion + verify beats.
- [ ] Browser ~110–125% zoom, window 1280×800. Mute notifications.
- [ ] Recorder: Loom / OBS / QuickTime (system audio + mic).
- [ ] **Do NOT show `.env.local`** on screen — it holds the AWS secret + ingest secret.

---

## Script

### 0:00 – 0:25 — The problem + the stack (25s)
**Show:** Landing page.
**Say:**
> "Across African micro-commerce, sellers — we call them co-sellers — buy stock from wholesalers and resell to their network for a markup. The hard part isn't writing the listing. It's *knowing what to sell*. Kajota Pulse is the Bloomberg terminal that answers that question — and it's one of three live apps in our stack: Coach drafts the listing, Pulse tells you what to stock, Mesh settles the deal on-chain."
**Action:** Click **Open the dashboard**.

### 0:25 – 0:50 — This is live AWS data (25s)
**Show:** Dashboard; point at the top-right badge.
**Say:**
> "Everything here is live. That green `Live · Aurora` badge means every card you're about to see is a SQL query running right now against AWS Aurora Serverless v2 — no mock data, no fixtures. It's built on the zero stack: Next.js on Vercel, a shadcn/v0 UI, Recharts — and Aurora that scales to zero when nobody's looking."

### 0:50 – 1:40 — The advisor: the hero feature (50s)
**Show:** The "What should I stock this week?" card.
**Say:**
> "Here's where Pulse stops being a dashboard you read and becomes an advisor that tells you what to do. One click."
**Action:** Click **Ask the advisor** (~3s).
**Say (while loading):**
> "Gemini is reading the live Aurora signals — trending demand, category margins, competitor stock-outs, and price position."
**Action:** Result appears. Read the top pick.
**Say:**
> "It ranks what to stock this week, and every pick fuses three things: demand, margin, and opportunity. Look at this one — Organic Shea Butter: twenty-seven new favorites, it's in the high-margin Beauty category at eighteen percent, *and* a competitor just ran out of a similar cream. So: stock ten to fifteen units before the weekend. It doesn't show me numbers and make me guess — it tells me what to do, and why. Under the hood that's Gemini 2.5 Flash returning structured JSON, with a deterministic fallback if the model's ever unavailable, so the card never breaks in front of a customer."
**Action:** Point at *"Synthesised from live Aurora data in ~2.5s."*

### 1:40 – 2:05 — Explain why (25s)
**Show:** Trending card; tap the chevron on "Ankara Print Slides".
**Say:**
> "And every signal is interrogable. Tap any trending product and a second Gemini call explains *why* it's moving — a favorites spike on WhatsApp, an influencer feature — and what to do about it. So the advice up top is never a black box; you can drill into the evidence behind it."

### 2:05 – 3:00 — Tour the four signals (55s)
**Say (Trending, ~12s):**
> "Let me walk the four signals. Trending is a composite of favorites, shares, and views over a rolling 24-hour window — computed in SQL as a view."
**Action:** Gesture to the price waterfall.
**Say (Price waterfall, ~13s):**
> "Price waterfall: your price versus the category median — a *true* median via Postgres `percentile_cont` — versus the lowest competitor. Grey bars mean you're not selling in that category yet — a gap to fill."
**Action:** Scroll down to the bottom row.
**Say (Stock alerts, ~13s):**
> "Stock alerts: the moment a competitor goes out of stock in a category you sell, it surfaces here. That's your window to capture their demand before they restock."
**Say (Margin leaderboard, ~14s):**
> "And the margin leaderboard ranks categories by realised co-sell markup — Beauty at eighteen percent, Fashion at fourteen — so you stock where the margin actually is, not just where there's noise."

### 3:00 – 3:40 — It's REAL data, live (40s) ← the credibility beat
**Show:** Switch to your terminal.
**Say:**
> "Now — is this real, or did I seed it? Watch. I'll write one product into our live MongoDB production database."
**Action:** Run `bash scripts/demo-cosell-insert.sh` (prints `INSERTED_ID=…`).
**Say:**
> "Three MongoDB Atlas Database Triggers are watching the real Kajota catalogue. That write just fired one — it POSTs the change event to our ingest endpoint on Vercel, which upserts it into Aurora over a passwordless IAM connection."
**Action:** Run the watch one-liner (ask Claude for it) or refresh the dashboard.
**Say:**
> "And there it is, landed in Aurora seconds later. This isn't a fixture — it's a live change-data pipeline from production Mongo into AWS."

### 3:40 – 4:05 — Verify + architecture (25s)
**Action:** Run `node scripts/verify-live.mjs`.
**Say:**
> "And you don't have to take my word for any of it. One command checks the whole live stack — the landing page, the Aurora badge, both Gemini endpoints, the ingest auth gate, and a real IAM-authenticated row count straight out of Aurora. Five for five. No servers, no VPC, no stored database password — Vercel talks to Aurora with short-lived IAM tokens."

### 4:05 – 4:20 — Close (15s)
**Show:** Back to the dashboard.
**Say:**
> "Kajota Pulse: a live, AWS-Aurora-backed, Gemini-powered advisor for African micro-commerce, built end-to-end on the zero stack. Coach drafts, Pulse advises, Mesh settles. It's live at kajota-pulse.vercel.app. Thanks for watching."

---

## Trim to 3:00 if needed
Cut the four-signal tour (2:05–3:00) to ~25s ("four more live signals — trending velocity, price position, competitor stock-outs, and category margins") and keep the advisor + live-ingestion beats. Those two are the differentiators.

## Things NOT to do on camera
- Don't `cat`/open `.env.local` — leaks the AWS secret + ingest secret.
- Don't click the advisor cold (pre-warm, else ~8s + possible heuristic fallback). If the badge says `heuristic`, click **Refresh advice** once.
- Don't refresh after the advice loads (you'll lose the buy-list).
- Don't apologise for the ~2.5s advisor latency — name it ("a real Gemini call over live Aurora").

## If something breaks
- Badge says **Mock data** → Aurora cold-started; refresh once or twice.
- Advisor badge says **heuristic** → Gemini hiccup; wait ~20s, click **Refresh advice**.
- `verify-live.mjs` Aurora line fails with `ENOTFOUND` → local DNS (phone hotspot/VPN); it auto-retries 5×, else record that beat on stable Wi-Fi.
- Live-ingestion write errors on a unique index → already handled; the script supplies all three index fields. `--clean` removes the demo doc afterwards.

## Reference artifacts to pin
- Live: **https://kajota-pulse.vercel.app** · Repo: **https://github.com/KaJota-inc/kajota-pulse**
- AWS Aurora Serverless v2 (Postgres) · eu-west-1 · passwordless IAM-token auth
- Gemini 2.5 Flash: `/api/recommend` (advisor) + `/api/explain`
- 3 live MongoDB Atlas triggers → `/api/ingest`
- `node scripts/verify-live.mjs` (5/5)
