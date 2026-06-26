/**
 * Kajota Pulse — main dashboard.
 *
 * 4 cards matching the views in README §"Day-1 dashboard views"
 * (Trending, Price waterfall, Stock alerts, Margin leaderboard).
 *
 * Data source auto-switches via `loadDashboard()`: real Aurora data
 * when the AURORA_* env vars are configured + reachable, otherwise the
 * polished W1 mock. No code change needed when the cluster comes
 * online — the cards just start showing live numbers. The header badge
 * reports which source served the current view.
 */
import { TrendingCard } from '@/components/pulse/TrendingCard';
import { PriceWaterfallCard } from '@/components/pulse/PriceWaterfallCard';
import { StockAlertsCard } from '@/components/pulse/StockAlertsCard';
import { MarginLeaderboardCard } from '@/components/pulse/MarginLeaderboardCard';
import { loadDashboard } from '@/lib/data';

// Always render fresh — the data source decision + live numbers must
// not be cached at build time.
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { data, source } = await loadDashboard();

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-white">
              <svg
                aria-hidden
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-base font-bold text-zinc-900">Kajota Pulse</span>
          </div>
          {source === 'aurora' ? (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live · Aurora
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-zinc-500">
              <span className="h-2 w-2 rounded-full bg-zinc-400" />
              Mock data · Aurora not yet configured
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-zinc-900">Today&apos;s pulse</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Signals collected in the last 24 hours from the Kajota catalogue.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <TrendingCard products={data.trending} />
          <PriceWaterfallCard items={data.priceWaterfall} />
          <StockAlertsCard alerts={data.stockAlerts} />
          <MarginLeaderboardCard rows={data.marginLeaderboard} />
        </div>
      </main>
    </div>
  );
}
