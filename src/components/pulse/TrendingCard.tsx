/**
 * TrendingCard — top movers in the last 24 hours.
 *
 * Replaced/refined by a Vercel v0 generation. Day-1 shape: list of
 * 4-5 products sorted by composite score, each row shows product name,
 * a sparkline-ish badge of the score, and the dominant signal
 * (favorites / shares / velocity). Tapping a row will open an "Explain
 * why" Gemini sheet in W4 (XPRIZE story).
 */
import type { TrendingEntry } from '@/lib/types';

export function TrendingCard({ products }: { products: TrendingEntry[] }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-zinc-900">Trending — last 24h</h2>
        <span className="text-xs font-medium text-zinc-500">{products.length} products</span>
      </header>
      <ul className="divide-y divide-zinc-100">
        {products.map(entry => (
          <li className="flex items-center justify-between py-3" key={entry.product.id}>
            <div>
              <p className="font-medium text-zinc-900">{entry.product.name}</p>
              <p className="text-xs text-zinc-500">
                +{entry.signals.favoritesDelta} favorites · +{entry.signals.sharesDelta} shares
              </p>
            </div>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-orange-600">
              {entry.score.toFixed(1)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
