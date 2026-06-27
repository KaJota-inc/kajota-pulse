/**
 * TrendingCard — top movers in the last 24 hours, with an
 * "Explain why" affordance per row powered by Gemini.
 *
 * Built on the shadcn/ui Card + Badge primitives (the component system
 * Vercel v0 generates against). Tapping the chevron next to a product's
 * score POSTs to /api/explain and renders the Gemini explanation inline.
 */
'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
    <Card>
      <CardHeader>
        <CardTitle>Trending — last 24h</CardTitle>
        <CardDescription>{products.length} products</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="divide-y divide-border">
          {products.map(entry => (
            <TrendingRow entry={entry} key={entry.product.id} />
          ))}
        </ul>
      </CardContent>
    </Card>
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
          className="flex-1 rounded-md -mx-1 px-1 py-1 text-left transition-colors hover:bg-secondary"
          onClick={handleToggle}
          type="button"
        >
          <p className="font-medium text-foreground">{entry.product.name}</p>
          <p className="text-xs text-muted-foreground">{dominantSignal(entry)}</p>
        </button>
        <Badge>{entry.score.toFixed(1)}</Badge>
        <button
          aria-label={open ? 'Hide explanation' : 'Why is this trending?'}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
          onClick={handleToggle}
          type="button"
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform', open && 'rotate-90')} />
        </button>
      </div>

      {open && (
        <div className="mt-2 rounded-lg bg-accent px-3 py-2">
          {loading && <p className="text-xs italic text-accent-foreground/80">Asking Gemini why…</p>}
          {explanation && <p className="text-xs leading-5 text-accent-foreground">{explanation}</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {!loading && !explanation && !error && (
            <p className="text-xs italic text-accent-foreground/80">Tap the chevron to ask Gemini.</p>
          )}
        </div>
      )}
    </li>
  );
}
