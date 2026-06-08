/**
 * PriceWaterfallCard — your listed price vs. category median vs.
 * lowest competitor, as a grouped horizontal bar chart.
 *
 * Three bars per category:
 *   - Yours (brand orange) — only shown when you have a listing.
 *   - Median (zinc-400) — the catalogue middle.
 *   - Lowest (emerald-500) — the cheapest competitor.
 *
 * Tooltip shows the exact prices. Chart shrinks responsively so the
 * card sits cleanly in a 2-column grid alongside the other 3 cards.
 */
'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { PriceWaterfallRow } from '@/lib/types';

const BRAND = '#F15A32';
const MEDIAN = '#94a3b8';
const LOWEST = '#10b981';

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return '—';
  if (value >= 100_000) return `${(value / 1000).toFixed(0)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString();
}

interface ChartDatum {
  category: string;
  You: number | null;
  Median: number;
  Lowest: number;
  currency: string;
}

function toChartData(items: PriceWaterfallRow[]): ChartDatum[] {
  return items.map(row => ({
    category: row.category,
    You: row.yourPrice,
    Median: row.median,
    Lowest: row.lowestCompetitor,
    currency: row.currency,
  }));
}

export function PriceWaterfallCard({ items }: { items: PriceWaterfallRow[] }) {
  const data = toChartData(items);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-zinc-900">Price waterfall</h2>
        <span className="text-xs font-medium text-zinc-500">vs. category median</span>
      </header>

      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="category"
              tick={{ fill: '#52525b', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#e4e4e7' }}
            />
            <YAxis
              tick={{ fill: '#52525b', fontSize: 11 }}
              tickFormatter={formatPrice}
              tickLine={false}
              axisLine={{ stroke: '#e4e4e7' }}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                borderColor: '#e4e4e7',
              }}
              formatter={(value: unknown, name) => {
                if (typeof value !== 'number') return ['—', name as string];
                return [value.toLocaleString(), name as string];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
            <Bar dataKey="Median" fill={MEDIAN} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Lowest" fill={LOWEST} radius={[4, 4, 0, 0]} />
            <Bar dataKey="You" fill={BRAND} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {data.some(d => d.You == null) && (
        <p className="mt-2 text-xs text-zinc-500">
          Greyed bars mean you don&apos;t have a listing in that category yet.
        </p>
      )}
    </section>
  );
}
