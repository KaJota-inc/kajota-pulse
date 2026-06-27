/**
 * StockAlertsCard — competitor inventory that just went OOS.
 *
 * Each alert is a window of opportunity: a competitor in a category the
 * seller participates in just ran out of stock, so demand is likely to
 * shift their way. Built on shadcn/ui Card + Badge.
 */
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    <Card>
      <CardHeader>
        <CardTitle>Stock alerts</CardTitle>
        <CardDescription>{alerts.length} active</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {alerts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No competitor stock-outs detected in your categories.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {alerts.map(a => (
              <li className="py-3" key={a.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{a.productName}</p>
                  <Badge variant="warning">{a.category}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.competitorStoreName} · went OOS {timeAgo(a.detectedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
