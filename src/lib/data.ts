/**
 * Unified dashboard data source.
 *
 * Decides at request time whether to serve real Aurora data or the W1
 * mock:
 *   - Aurora env vars present  → query Aurora. On any error, fall back
 *     to mock so the dashboard never hard-fails in a demo.
 *   - Aurora env vars absent    → serve mock.
 *
 * This means the dashboard page never changes: the instant the Aurora
 * env vars are set on Vercel and the cluster has data, the cards switch
 * to live numbers. Until then, the polished mock keeps the demo alive.
 */
import { getDashboardData, isAuroraConfigured } from './db';
import { getMockDashboardData } from './mock';
import type { DashboardData } from './types';

export interface LoadedDashboard {
  data: DashboardData;
  /** Which source actually served this response — surfaced in the UI. */
  source: 'aurora' | 'mock';
}

export async function loadDashboard(sellerId?: string): Promise<LoadedDashboard> {
  if (!isAuroraConfigured()) {
    return { data: getMockDashboardData(), source: 'mock' };
  }
  try {
    const data = await getDashboardData(sellerId);
    return { data, source: 'aurora' };
  } catch (e) {
    // Aurora configured but unreachable (cluster paused, creds wrong,
    // schema not applied yet) — degrade to mock rather than 500.
    console.error('Pulse: Aurora query failed, falling back to mock.', e);
    return { data: getMockDashboardData(), source: 'mock' };
  }
}
