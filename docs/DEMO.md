# Kajota Pulse — 90-second demo script

For recording a screencast to paste into the **Hack the Zero Stack** (AWS / Vercel) submission. Target: **90 seconds.** Each beat below = ~15-25 seconds of screen time. The whole thing runs against the **live** deployment — every number is real AWS Aurora data.

> The shape of this script mirrors the 0G / Witness demo (`kajota-witness/docs/DEMO.md`): show real surfaces doing load-bearing work, name the latency instead of apologising for it, and end on a one-command "anyone can verify this" proof.

---

## Before you hit record

- [ ] **Pre-warm Aurora AND the advisor.** Aurora Serverless v2 scales to zero — the first request after idle cold-starts ~8s and the dashboard will briefly show the grey *"Mock data"* badge. Two minutes before recording, run:
      ```bash
      cd ~/Documents/kajota-pulse
      curl -s -o /dev/null -w 'dashboard %{http_code}\n' https://kajota-pulse.vercel.app/dashboard
      curl -s -X POST https://kajota-pulse.vercel.app/api/recommend | python3 -m json.tool | head -3
      ```
      Repeat the dashboard curl until the badge is green and the advisor returns `"source": "aurora"`. Now the cluster stays warm for your take.
- [ ] **(Optional) Reset to a camera-clean seed** so the numbers are tidy: `node scripts/seed.mjs` (12 products / 822 engagement / 33 cosell). Ask Claude to run this for you — it's the hackathon DB, not production.
- [ ] Open **https://kajota-pulse.vercel.app** in a fresh tab (the landing pitch).
- [ ] Open **https://kajota-pulse.vercel.app/dashboard** in a second tab (you'll start on the landing tab and click through).
- [ ] Have a **terminal** ready in `~/Documents/kajota-pulse` for the verify beat at 01:10. Pre-type `node scripts/verify-live.mjs` but **don't hit enter** until the beat.
- [ ] Browser at ~110-125% zoom; window 1280×800.
- [ ] Mute Slack / Discord / notifications.
- [ ] Use Loom, OBS, or QuickTime (anything that captures system audio + mic).
- [ ] **DON'T have `.env.local` open in any visible editor or terminal** — it holds the AWS secret key + ingest secret. Don't `cat` it on camera.

---

## Script

### **00:00 – 00:15 — The problem (15s)**

**Show:** The landing page at `kajota-pulse.vercel.app`.

**Say:**
> "Across African micro-commerce, sellers buy stock from wholesalers and resell to their network for a markup. The hard part isn't writing the listing — it's knowing *what to sell*. Kajota Pulse is the Bloomberg terminal that answers it."

**Action:** Click **Open the dashboard**.

### **00:15 – 00:30 — This is live AWS data, not a mock (15s)**

**Show:** The dashboard. Point at the top-right badge.

**Say:**
> "Everything you're seeing is live. That green badge — `Live · Aurora` — means every card is a SQL query running right now against AWS Aurora Serverless v2. No mock data, no fixtures."

**Action:** Hover the green **`Live · Aurora`** badge for a beat.

### **00:30 – 00:55 — The money shot: the advisor (25s) ← the punchline**

**Show:** The hero card at the top — **"What should I stock this week?"**

**Say:**
> "Here's where Pulse stops being a dashboard and becomes an advisor. One click."

**Action:** Click **Ask the advisor**. The button shows *"Reading your signals…"* for ~3s.

**Say (while it loads):**
> "Gemini is reading the live Aurora signals — trending demand, category margins, competitor stock-outs, and price position — and ranking what to buy."

**Action:** The ranked buy-list appears. Read the top pick aloud.

**Say:**
> "Top pick: Organic Shea Butter — stock ten to fifteen units before the weekend. And the *why* is specific: favorites up twenty-eight, it's in the high-margin Beauty category at eighteen percent, and a competitor just ran out of stock. That's demand times margin times opportunity, in one sentence. It doesn't show me numbers and make me guess — it tells me what to do."

**Action:** Point at the small line: *"Synthesised from live Aurora data in ~2900 ms."*

### **00:55 – 01:10 — The signals behind the advice (15s)**

**Show:** The **Trending — last 24h** card.

**Action:** Tap the chevron next to "Ankara Print Slides".

**Say:**
> "Every recommendation is backed by signals you can interrogate. Tap any trending product and a second Gemini call explains exactly why it's moving — a favorites spike on WhatsApp, an influencer feature — and what to do about it."

### **01:10 – 01:25 — Verify it's all real, one command (15s)**

**Show:** Switch to your terminal.

**Action:** Hit enter on `node scripts/verify-live.mjs`.

**Say:**
> "And a judge doesn't have to take my word for it. This one command checks the whole live stack: the landing page, the `Live · Aurora` badge, the Gemini endpoint, the ingestion auth gate, and a real IAM-authenticated row count straight out of Aurora."

**Action:** The five green checks print. Let them land on screen.

**Say:**
> "Five for five. All live."

### **01:25 – 01:30 — Architecture + the bigger picture (close)**

**Show:** Back to the dashboard.

**Say:**
> "No servers, no VPC, no stored database password — Vercel talks to Aurora with short-lived IAM tokens. And Pulse is one of three live Kajota apps: Coach drafts the listing, Pulse tells you what to stock, Mesh settles the deal on-chain. Built on the zero stack."

---

## Things NOT to do on camera

- **Don't `cat` or open `.env.local`** — it leaks the AWS secret key + the ingest secret.
- **Don't click the advisor cold.** If you skipped the pre-warm, the first call is ~8s and may fall back to the heuristic ranking (the badge will read `heuristic` instead of `gemini-2.5-flash`). Pre-warm so it's a crisp ~3s real-Gemini call.
- **Don't refresh after the advice loads** — you'll lose the buy-list and have to re-ask.
- **Don't apologise for the ~3s advisor latency** — name it ("this is a real Gemini call over live Aurora data").
- **Don't read every pick** — read the #1 pick well; let the rest sit on screen.

## If something breaks during recording

- **Badge says "Mock data":** Aurora cold-started or briefly unreachable. Refresh the dashboard once or twice — it goes green within a few seconds once the cluster wakes. (This is exactly why you pre-warm.)
- **Advisor badge says `heuristic`, not `gemini`:** Gemini returned an error/rate-limit and the card fell back to the deterministic ranking. The demo still works — but for the clean take, wait ~20s and click **Refresh advice**.
- **`verify-live.mjs` shows a transient Aurora failure:** Serverless v2 mid-scale. Re-run it once — it'll go 5/5.

## Reference artifacts to mention / pin

- Live app: **https://kajota-pulse.vercel.app**
- Repo: **https://github.com/KaJota-inc/kajota-pulse**
- AWS Aurora Serverless v2 (PostgreSQL) · eu-west-1 · passwordless IAM-token auth
- Gemini 2.5 Flash — two surfaces: `/api/recommend` (advisor) + `/api/explain`
- One-command health check: `node scripts/verify-live.mjs` (5/5)

## What to caption / pin in the video description

```
Kajota Pulse — the Bloomberg terminal for African micro-commerce.
Built on the Zero Stack: Next.js on Vercel + AWS Aurora Serverless v2.

It doesn't just monitor the market — Gemini reads the live Aurora signals
and tells the seller what to stock this week.

Live: https://kajota-pulse.vercel.app
Repo: https://github.com/KaJota-inc/kajota-pulse

Stack: Next.js 16 (Vercel) + Aurora Serverless v2 (passwordless IAM tokens)
+ Gemini 2.5 Flash + MongoDB Atlas Triggers → /api/ingest. Zero servers,
zero VPC, zero stored DB password.
```
