/**
 * PriceWaterfallCard — your listed price vs. category median vs.
 * lowest competitor.
 *
 * Day-1 shape: table of categories with three numeric columns and a
 * delta badge ("you're 9% above median"). Replaced by Vercel v0 +
 * Recharts in W2 once real data lands.
 */
import type { PriceWaterfallRow } from '@/lib/types';

function deltaPct(yours: number | null, baseline: number): { value: number; label: string; tone: 'good' | 'warn' | 'neutral' } {
  if (yours == null) return { value: 0, label: 'no listing', tone: 'neutral' };
  const diff = ((yours - baseline) / baseline) * 100;
  if (Math.abs(diff) < 1) return { value: diff, label: 'matches median', tone: 'good' };
  if (diff > 0) return { value: diff, label: `${diff.toFixed(0)}% above median`, tone: 'warn' };
  return { value: diff, label: `${Math.abs(diff).toFixed(0)}% below median`, tone: 'good' };
}

function formatPrice(value: number, currency: string) {
  return `${currency} ${value.toLocaleString()}`;
}

export function PriceWaterfallCard({ items }: { items: PriceWaterfallRow[] }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-zinc-900">Price waterfall</h2>
        <span className="text-xs font-medium text-zinc-500">vs. category median</span>
      </header>
      <ul className="divide-y divide-zinc-100">
        {items.map(row => {
          const d = deltaPct(row.yourPrice, row.median);
          return (
            <li className="py-3" key={row.category}>
              <div className="flex items-center justify-between">
                <p className="font-medium text-zinc-900">{row.category}</p>
                <span
                  className={
                    d.tone === 'good'
                      ? 'text-xs font-semibold text-emerald-600'
                      : d.tone === 'warn'
                        ? 'text-xs font-semibold text-amber-600'
                        : 'text-xs font-semibold text-zinc-400'
                  }
                >
                  {d.label}
                </span>
              </div>
              <div className="mt-1 flex gap-4 text-xs text-zinc-500">
                <span>
                  You:{' '}
                  <span className="font-mono text-zinc-700">
                    {row.yourPrice == null ? '—' : formatPrice(row.yourPrice, row.currency)}
                  </span>
                </span>
                <span>
                  Median: <span className="font-mono text-zinc-700">{formatPrice(row.median, row.currency)}</span>
                </span>
                <span>
                  Lowest:{' '}
                  <span className="font-mono text-zinc-700">
                    {formatPrice(row.lowestCompetitor, row.currency)}
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
