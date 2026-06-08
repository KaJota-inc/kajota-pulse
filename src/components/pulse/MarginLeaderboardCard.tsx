/**
 * MarginLeaderboardCard — categories ranked by realised co-sell markup.
 *
 * Helps sellers pick which categories to lean into. Realised markup =
 * average (markedUpPrice - originalPrice) / originalPrice across all
 * cosellproduct documents in the last 30 days.
 */
import type { MarginLeaderboardRow } from '@/lib/types';

export function MarginLeaderboardCard({ rows }: { rows: MarginLeaderboardRow[] }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-zinc-900">Margin leaderboard</h2>
        <span className="text-xs font-medium text-zinc-500">last 30 days</span>
      </header>
      <ol className="divide-y divide-zinc-100">
        {rows.map((row, idx) => (
          <li className="flex items-center justify-between py-3" key={row.category}>
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-700">
                {idx + 1}
              </span>
              <div>
                <p className="font-medium text-zinc-900">{row.category}</p>
                <p className="text-xs text-zinc-500">{row.cosellCount} co-sell listings</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
              +{row.realisedMarkupPct.toFixed(1)}%
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
