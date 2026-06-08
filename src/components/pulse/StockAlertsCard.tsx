/**
 * StockAlertsCard — competitor inventory that just went OOS.
 *
 * Each alert represents a window of opportunity for the seller: a
 * competitor in a category they participate in just ran out of stock,
 * so demand is likely to shift their way.
 */
import type { StockAlert } from '@/lib/types';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

export function StockAlertsCard({ alerts }: { alerts: StockAlert[] }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-zinc-900">Stock alerts</h2>
        <span className="text-xs font-medium text-zinc-500">{alerts.length} active</span>
      </header>
      {alerts.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">
          No competitor stock-outs detected in your categories.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {alerts.map(a => (
            <li className="py-3" key={a.id}>
              <div className="flex items-center justify-between">
                <p className="font-medium text-zinc-900">{a.productName}</p>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  {a.category}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {a.competitorStoreName} · went OOS {timeAgo(a.detectedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
