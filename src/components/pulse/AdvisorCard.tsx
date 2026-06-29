/**
 * AdvisorCard — the "What should I stock this week?" hero.
 *
 * This is the card that turns Pulse from a dashboard you read into an
 * advisor that tells you what to do. One tap POSTs to /api/recommend,
 * which reads the live Aurora signals (trending × margin × stock-gaps ×
 * price) and returns a Gemini-ranked buy-list. Each pick shows the
 * concrete action and a one-line justification.
 *
 * Built on the shadcn/ui Card primitive (the v0 component system) so it
 * sits flush with the four signal cards below it.
 */
'use client';

import { useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AdvisorResponse } from '@/lib/types';

export function AdvisorCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdvisorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/recommend', { method: 'POST' });
      const data = (await res.json()) as AdvisorResponse;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the advisor.');
    } finally {
      setLoading(false);
    }
  }

  const byGemini = result?.model?.startsWith('gemini');

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/[0.06] to-card">
      <CardContent className="px-6 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">What should I stock this week?</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Gemini reads your live trending, margin and stock-gap signals and ranks what to buy.
              </p>
            </div>
          </div>
          <Button onClick={ask} disabled={loading} className="shrink-0 self-start sm:self-auto">
            <Sparkles className="h-4 w-4" />
            {loading ? 'Reading your signals…' : result ? 'Refresh advice' : 'Ask the advisor'}
          </Button>
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        {result && (
          <div className="mt-5 border-t border-border pt-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">{result.headline}</p>
              <Badge variant={byGemini ? 'success' : 'muted'}>
                {byGemini ? `Gemini · ${result.model}` : 'heuristic'}
              </Badge>
            </div>

            <ol className="space-y-3">
              {result.recommendations.map((r, i) => (
                <li key={`${r.product}-${i}`} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-foreground">
                      {r.product}
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                        <ArrowRight className="h-3 w-3" />
                        {r.action}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{r.reason}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-4 text-[11px] text-muted-foreground">
              Synthesised from {result.source === 'aurora' ? 'live Aurora data' : 'demo data'} in{' '}
              {result.latencyMs} ms.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
