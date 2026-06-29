/**
 * POST /api/recommend — "What should I stock this week?" advisor.
 *
 * This is the feature that turns Pulse from a passive *monitor* into an
 * active *advisor* — fulfilling the product's headline promise that the
 * hard part of co-selling isn't writing listings, it's knowing what to
 * sell. It reads the same live Aurora signals the dashboard cards do
 * (trending demand, category margins, competitor stock-outs, price
 * position), hands them to Gemini, and gets back a ranked buy-list with
 * a one-line justification per pick that ties demand × margin ×
 * opportunity together.
 *
 * Data: reuses `loadDashboard()` so it auto-switches Aurora ↔ mock and
 * inherits the exact same tested SQL the cards use — no new queries.
 *
 * Response: { headline, recommendations[], model, source, latencyMs }.
 * Falls back to a deterministic heuristic ranking if Gemini is
 * unconfigured or unreachable, so the card is never empty in a demo.
 *
 * Auth: none — the advice is synthesised from public catalogue signals,
 * not seller-private inventory. (Gate behind the Kajota JWT if that ever
 * changes.)
 */
import { NextResponse } from 'next/server';

import { loadDashboard } from '@/lib/data';
import type {
  AdvisorResponse,
  DashboardData,
  StockRecommendation,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s';

const SYSTEM_INSTRUCTION = `You are the stocking advisor inside Kajota Pulse — a pricing
intelligence dashboard for African micro-retailers ("co-sellers") who buy stock
from wholesalers and resell to their network for a markup.

The seller's question is always the same: "What should I stock this week?"

You are given four live signals from the marketplace:
  - TRENDING: products gaining favorites / shares / views in the last 24h (demand)
  - MARGINS: average realised co-sell markup per category (profitability)
  - STOCK GAPS: products a competitor just ran out of (your opening to capture demand)
  - PRICE POSITION: the seller's price vs the category median and the lowest competitor

Produce a ranked list of 3-4 concrete picks. Rank by combining DEMAND × MARGIN ×
OPPORTUNITY: a product that is trending, sits in a high-margin category, and has a
competitor stock-out is the strongest pick. For each pick give:
  - product: the product or category to stock
  - action: a specific, quantified move ("Stock 15-20 units before the weekend")
  - reason: ONE sentence that explicitly cites the numbers that justify it
    (e.g. "favorites up 8 in 24h, 18% category margin, and a competitor just went
    out of stock").

Only reason about the numbers you are given — never invent prices, products, or
signals. Be specific and decisive; this seller acts on what you say.`;

/* ----------------------------------------------------------------- */
/*  Prompt construction from live dashboard signals                  */
/* ----------------------------------------------------------------- */

function fmtMoney(currency: string, n: number): string {
  return `${currency} ${Math.round(n).toLocaleString('en-NG')}`;
}

function buildContext(data: DashboardData): string {
  const lines: string[] = [];

  lines.push('TRENDING (last 24h — demand):');
  if (data.trending.length === 0) lines.push('  (no movement yet)');
  for (const t of data.trending) {
    lines.push(
      `  - ${t.product.name} [category ${t.product.categoryId ?? 'uncategorised'}]: ` +
        `score ${t.score.toFixed(1)} | +${t.signals.favoritesDelta} favorites, ` +
        `+${t.signals.sharesDelta} shares, +${t.signals.velocityDelta.toFixed(1)} velocity`,
    );
  }

  lines.push('');
  lines.push('CATEGORY MARGINS (avg realised co-sell markup, 30d — profitability):');
  if (data.marginLeaderboard.length === 0) lines.push('  (no co-sell activity yet)');
  for (const m of data.marginLeaderboard) {
    lines.push(
      `  - ${m.category}: ${m.realisedMarkupPct.toFixed(1)}% over ${m.cosellCount} listings`,
    );
  }

  lines.push('');
  lines.push('STOCK GAPS (competitor went out of stock in last 24h — your opening):');
  if (data.stockAlerts.length === 0) lines.push('  (none right now)');
  for (const s of data.stockAlerts) {
    lines.push(`  - ${s.productName} [${s.category}] — ${s.competitorStoreName} is out of stock`);
  }

  lines.push('');
  lines.push('PRICE POSITION (your price vs market):');
  if (data.priceWaterfall.length === 0) lines.push('  (no price data yet)');
  for (const p of data.priceWaterfall) {
    const you = p.yourPrice == null ? 'not selling' : fmtMoney(p.currency, p.yourPrice);
    lines.push(
      `  - ${p.category}: you ${you} | median ${fmtMoney(p.currency, p.median)} | ` +
        `lowest ${fmtMoney(p.currency, p.lowestCompetitor)}`,
    );
  }

  return lines.join('\n');
}

/* ----------------------------------------------------------------- */
/*  Heuristic fallback — used when Gemini is unavailable             */
/* ----------------------------------------------------------------- */

function heuristicRecommendations(data: DashboardData): {
  headline: string;
  recommendations: StockRecommendation[];
} {
  const marginByCat = new Map(
    data.marginLeaderboard.map(m => [m.category, m.realisedMarkupPct]),
  );
  const stockGapCats = new Set(data.stockAlerts.map(s => s.category));

  const ranked = [...data.trending]
    .map(t => {
      const cat = t.product.categoryId ?? 'uncategorised';
      const margin = marginByCat.get(cat) ?? 0;
      const gap = stockGapCats.has(cat) ? 1 : 0;
      // demand × margin × opportunity, lightly weighted.
      const rank = t.score * (1 + margin / 100) * (1 + gap);
      return { t, cat, margin, gap, rank };
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 4);

  const recommendations: StockRecommendation[] = ranked.map(({ t, margin, gap }) => ({
    product: t.product.name,
    action: `Stock more ${t.product.name} this week`,
    reason:
      `Trending at score ${t.score.toFixed(1)} (+${t.signals.favoritesDelta} favorites)` +
      (margin > 0 ? `, ${margin.toFixed(1)}% category margin` : '') +
      (gap ? ', and a competitor just went out of stock' : '') +
      '.',
  }));

  const headline =
    recommendations.length > 0
      ? `${recommendations[0].product} is your strongest pick this week.`
      : 'Not enough signal yet — check back once today’s activity lands.';

  return { headline, recommendations };
}

/* ----------------------------------------------------------------- */
/*  Gemini structured-output call                                    */
/* ----------------------------------------------------------------- */

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING' },
    recommendations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          product: { type: 'STRING' },
          action: { type: 'STRING' },
          reason: { type: 'STRING' },
        },
        required: ['product', 'action', 'reason'],
      },
    },
  },
  required: ['headline', 'recommendations'],
} as const;

export async function POST(): Promise<NextResponse> {
  const start = Date.now();

  // 1. Pull the live signals (same source the cards use).
  const { data, source } = await loadDashboard();

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

  // 2. No Gemini configured → deterministic heuristic so the card still works.
  if (!apiKey) {
    const fb = heuristicRecommendations(data);
    return NextResponse.json<AdvisorResponse>({
      ...fb,
      model: 'heuristic',
      source,
      latencyMs: Date.now() - start,
    });
  }

  const url = GEMINI_API_URL.replace('%s', model).replace('%s', apiKey);
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              `Here are this seller's live marketplace signals:\n\n${buildContext(data)}\n\n` +
              `What should they stock this week? Return the ranked buy-list.`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 900,
      // 2.5-flash "thinking" silently eats the output budget — disable it.
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      // Gemini error → heuristic fallback, never a 500 in a demo.
      const fb = heuristicRecommendations(data);
      return NextResponse.json<AdvisorResponse>({
        ...fb,
        model: 'heuristic',
        source,
        latencyMs: Date.now() - start,
      });
    }
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text =
      json.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('').trim() ?? '';

    const parsed = JSON.parse(text) as {
      headline?: string;
      recommendations?: StockRecommendation[];
    };
    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.slice(0, 4)
      : [];
    if (recommendations.length === 0) {
      const fb = heuristicRecommendations(data);
      return NextResponse.json<AdvisorResponse>({
        ...fb,
        model: 'heuristic',
        source,
        latencyMs: Date.now() - start,
      });
    }

    return NextResponse.json<AdvisorResponse>({
      headline: parsed.headline ?? `${recommendations[0].product} is your strongest pick this week.`,
      recommendations,
      model,
      source,
      latencyMs: Date.now() - start,
    });
  } catch {
    const fb = heuristicRecommendations(data);
    return NextResponse.json<AdvisorResponse>({
      ...fb,
      model: 'heuristic',
      source,
      latencyMs: Date.now() - start,
    });
  }
}
