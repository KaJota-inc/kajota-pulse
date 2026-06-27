/**
 * POST /api/explain — "Explain why" endpoint.
 *
 * Pulse's Gemini integration story for the XPRIZE submission. Given a
 * trending product + its signal components, call Gemini 2.5 Flash and
 * return a 2-3 sentence natural-language explanation of why this
 * product is trending in plain English.
 *
 * Request body:
 *   {
 *     productName: string,
 *     category?: string,
 *     score: number,
 *     signals: { favoritesDelta, sharesDelta, velocityDelta }
 *   }
 *
 * Response:
 *   { explanation: string, model: string, latencyMs: number }
 *
 * Auth: none — explanations are derived from public catalogue signals,
 * not from any seller-specific data. (If we ever surface seller
 * inventory in the prompt, gate this behind the Kajota JWT.)
 */
import { NextResponse } from 'next/server';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s';

interface ExplainRequest {
  productName: string;
  category?: string;
  score: number;
  signals?: {
    favoritesDelta?: number;
    sharesDelta?: number;
    velocityDelta?: number;
  };
}

const SYSTEM_INSTRUCTION = `You are an analyst inside Kajota Pulse — a pricing intelligence
dashboard for African co-sellers. When a seller asks "why is this product
trending?", explain in 2-3 short sentences:
  1. Which signal carries the trend (favorites, shares, or velocity)
  2. What that likely means in the real world (going viral on WhatsApp,
     featured by an influencer, end-of-month sales push, etc.)
  3. A concrete next action the seller could take to capture demand.

Speak directly to the seller in clear English. Never invent prices or
products — only reason about the signal numbers you're given. Output
prose only — no bullet points, no headings, no quotes.`;

function buildUserPrompt(req: ExplainRequest): string {
  const s = req.signals ?? {};
  const fav = s.favoritesDelta ?? 0;
  const sh = s.sharesDelta ?? 0;
  const vel = s.velocityDelta ?? 0;
  const category = req.category ? ` in the ${req.category} category` : '';
  return (
    `Product: "${req.productName}"${category}\n` +
    `Composite trend score (last 24h): ${req.score.toFixed(1)}\n` +
    `Signal breakdown:\n` +
    `  - new favorites: +${fav}\n` +
    `  - new shares: +${sh}\n` +
    `  - new product-detail views (velocity): +${vel}\n` +
    `\nWhy is this trending, and what should the seller do next?`
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  const start = Date.now();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        explanation:
          '(Gemini is not configured on this deployment. Set GEMINI_API_KEY in Vercel to enable real explanations.)',
        model: 'unconfigured',
        latencyMs: 0,
      },
      { status: 200 },
    );
  }
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

  let req: ExplainRequest;
  try {
    req = (await request.json()) as ExplainRequest;
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  if (!req.productName || typeof req.score !== 'number') {
    return NextResponse.json(
      { error: 'productName and score are required' },
      { status: 400 },
    );
  }

  const url = GEMINI_API_URL.replace('%s', model).replace('%s', apiKey);
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: buildUserPrompt(req) }] }],
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 320,
      // gemini-2.5-flash enables "thinking" by default, which silently
      // consumes the output-token budget and truncates the visible
      // answer. We want a short, direct explanation — no thinking.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // Vercel functions default 10s timeout — Gemini 2.5 Flash usually
      // responds in 1-3s but cap explicitly so we fail fast.
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return NextResponse.json(
        {
          explanation: `(Gemini returned ${res.status}. Try again in a moment.)`,
          model,
          latencyMs: Date.now() - start,
          debug: detail.slice(0, 200),
        },
        { status: 200 },
      );
    }
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text =
      json.candidates?.[0]?.content?.parts
        ?.map(p => p.text ?? '')
        .join('')
        .trim() ?? '(no response)';
    return NextResponse.json({
      explanation: text,
      model,
      latencyMs: Date.now() - start,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json(
      {
        explanation: `(Could not reach Gemini: ${message}. Try again in a moment.)`,
        model,
        latencyMs: Date.now() - start,
      },
      { status: 200 },
    );
  }
}
