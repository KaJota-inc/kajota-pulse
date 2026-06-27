/**
 * MarginLeaderboardCard — categories ranked by realised co-sell markup,
 * as a horizontal bar chart.
 *
 * Why horizontal: category names need room to breathe and the visual
 * "which bar is longest" comparison reads better on the X axis when
 * the count of categories is small (5-6) but each label is multi-word.
 */
'use client';

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import type { MarginLeaderboardRow } from '@/lib/types';

const PALETTE = ['#10b981', '#22c55e', '#84cc16', '#eab308', '#f97316'];

export function MarginLeaderboardCard({ rows }: { rows: MarginLeaderboardRow[] }) {
  const data = rows.map(r => ({
    name: r.category,
    value: r.realisedMarkupPct,
    count: r.cosellCount,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Margin leaderboard</CardTitle>
        <CardDescription>last 30 days</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 32, bottom: 4, left: 12 }}
          >
            <XAxis
              type="number"
              hide
              domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#27272a', fontSize: 12, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              width={90}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                borderColor: '#e4e4e7',
              }}
              formatter={(value: unknown, _name: unknown, payload) => {
                if (typeof value !== 'number') return ['—', 'markup'];
                const count = (payload?.payload as { count?: number })?.count ?? 0;
                return [`${value.toFixed(1)}% (${count} listings)`, 'markup'];
              }}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
              {data.map((_d, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(label: unknown) =>
                  typeof label === 'number' ? `+${label.toFixed(1)}%` : ''
                }
                style={{ fontSize: 11, fill: '#27272a', fontWeight: 700 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      </CardContent>
    </Card>
  );
}
