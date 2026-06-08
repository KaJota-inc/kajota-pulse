/**
 * TrendingCard — top movers in the last 24 hours, with an
 * "Explain why" affordance per row powered by Gemini.
 *
 * Tapping the chevron next to a product's score badge POSTs to
 * /api/explain with the product + signals and renders the returned
 * natural-language explanation inline.
 *
 * The Gemini integration is the cleanest moment in Pulse where the
 * Kajota AI Stack story (Coach drafts -> Pulse monitors -> Mesh
 * settles) becomes audible to a judge in one click.
 */
'use client';

import { useState } from 'react';

import type { TrendingEntry } from '@/lib/types';

interface ExplainResponse {
  explanation: string;
  model: string;
  latencyMs: number;
}

function dominantSignal(e: TrendingEntry): string {
  const s = e.signals;
  const top = Math.max(s.favoritesDelta, s.sharesDelta, s.velocityDelta);
  if (top === s.favoritesDelta) return `+${s.favoritesDelta} favorites`;
  if (top === s.sharesDelta) return `+${s.sharesDelta} shares`;
  return `+${s.velocityDelta.toFixed(1)} velocity`;
}

export function TrendingCard({ products }: { products: TrendingEntry[] }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-zinc-900">Trending — last 24h</h2>
        <span className="text-xs font-medium text-zinc-500">{products.length} products</span>
      </header>
      <ul className="divide-y divide-zinc-100">
        {products.map(entry => (
          <TrendingRow entry={entry} key={entry.product.id} />
        ))}
      </ul>
    </section>
  );
}

function TrendingRow({ entry }: { entry: TrendingEntry }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadExplanation() {
    if (explanation || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: entry.product.name,
          category: entry.product.categoryId ?? undefined,
          score: entry.score,
          signals: entry.signals,
        }),
      });
      const data = (await res.json()) as ExplainResponse;
      setExplanation(data.explanation);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach Gemini.');
    } finally {
      setLoading(false);
    }
  }

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) void loadExplanation();
  }

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <button
          aria-expanded={open}
          className="flex-1 text-left transition-colors hover:bg-zinc-50 rounded-md -mx-1 px-1 py-1"
          onClick={handleToggle}
          type="button"
        >
          <p className="font-medium text-zinc-900">{entry.product.name}</p>
          <p className="text-xs text-zinc-500">{dominantSignal(entry)}</p>
        </button>
        <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-orange-600">
          {entry.score.toFixed(1)}
        </span>
        <button
          aria-label={open ? 'Hide explanation' : 'Why is this trending?'}
          className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-orange-50 hover:text-orange-600"
          onClick={handleToggle}
          type="button"
        >
          <svg
            aria-hidden
            className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="mt-2 rounded-lg bg-orange-50/60 px-3 py-2">
          {loading && (
            <p className="text-xs italic text-orange-900/70">Asking Gemini why…</p>
          )}
          {explanation && (
            <p className="text-xs leading-5 text-orange-900">{explanation}</p>
          )}
          {error && <p className="text-xs text-red-700">{error}</p>}
          {!loading && !explanation && !error && (
            <p className="text-xs italic text-orange-900/70">
              Tap the chevron to ask Gemini.
            </p>
          )}
        </div>
      )}
    </li>
  );
}
