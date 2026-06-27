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
import { Zap } from 'lucide-react';

import { TrendingCard } from '@/components/pulse/TrendingCard';
import { PriceWaterfallCard } from '@/components/pulse/PriceWaterfallCard';
import { StockAlertsCard } from '@/components/pulse/StockAlertsCard';
import { MarginLeaderboardCard } from '@/components/pulse/MarginLeaderboardCard';
import { Badge } from '@/components/ui/badge';
import { loadDashboard } from '@/lib/data';

// Always render fresh — the data source decision + live numbers must
// not be cached at build time.
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { data, source } = await loadDashboard();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Zap className="h-4 w-4" fill="currentColor" strokeWidth={0} />
            </div>
            <span className="text-base font-bold text-foreground">Kajota Pulse</span>
          </div>
          {source === 'aurora' ? (
            <Badge variant="success">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live · Aurora
            </Badge>
          ) : (
            <Badge variant="muted">
              <span className="h-2 w-2 rounded-full bg-muted-foreground" />
              Mock data · Aurora not yet configured
            </Badge>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Today&apos;s pulse
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
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
