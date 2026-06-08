/**
 * Kajota Pulse — main dashboard.
 *
 * Day-1 skeleton: 4 cards matching the views in README §"Day-1 dashboard
 * views" (Trending, Price waterfall, Stock alerts, Margin leaderboard).
 * Data is currently mocked so the layout + interactions can be developed
 * independently of the AWS ingestion pipeline. Real data lands in W2
 * once the Aurora schema + Lambda are wired (see `docs/architecture.md`).
 *
 * Vercel v0 generations will replace each card body once the v0 project
 * is set up — the surrounding shell here is intentionally minimal so
 * those generations slot in without rework.
 */
import { TrendingCard } from '@/components/pulse/TrendingCard';
import { PriceWaterfallCard } from '@/components/pulse/PriceWaterfallCard';
import { StockAlertsCard } from '@/components/pulse/StockAlertsCard';
import { MarginLeaderboardCard } from '@/components/pulse/MarginLeaderboardCard';
import { getMockDashboardData } from '@/lib/mock';

export default function DashboardPage() {
  // Mock data for W1 — replaced with `getDashboardData(sellerId)` once
  // the Aurora schema + Lambda ingestion (W2) land.
  const data = getMockDashboardData();

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
          <span className="text-sm text-zinc-500">
            Mock data · live ingestion lands W2
          </span>
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
