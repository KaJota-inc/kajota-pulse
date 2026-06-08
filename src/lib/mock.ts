/**
 * Mock dashboard data for W1.
 *
 * Replaced with `getDashboardData(sellerId)` (calls
 * `lib/db.ts → queryDashboardData`) once the Aurora schema +
 * Lambda ingestion land in W2. The shape returned here matches the
 * production query 1:1, so the cards don't change.
 */
import type { DashboardData, PulseProduct } from './types';

const sample = (
  id: string,
  name: string,
  category: string,
  price: number,
  stock: PulseProduct['stockStatus'] = 'IN_STOCK',
): PulseProduct => ({
  id,
  name,
  currency: 'NGN',
  price,
  categoryId: category,
  storeId: `store_${category.toLowerCase()}`,
  stockStatus: stock,
});

export function getMockDashboardData(): DashboardData {
  return {
    trending: [
      {
        product: sample('p1', 'Ankara Print Slides', 'fashion', 4500),
        score: 87.4,
        signals: { favoritesDelta: 142, sharesDelta: 38, velocityDelta: 6.3 },
      },
      {
        product: sample('p2', 'Refurbished iPhone 13', 'electronics', 285000),
        score: 76.1,
        signals: { favoritesDelta: 71, sharesDelta: 22, velocityDelta: 4.1 },
      },
      {
        product: sample('p3', 'Organic Shea Butter 250g', 'health', 3200),
        score: 71.8,
        signals: { favoritesDelta: 58, sharesDelta: 41, velocityDelta: 3.4 },
      },
      {
        product: sample('p4', 'Adire Throw Pillow Cover', 'home', 5800),
        score: 64.2,
        signals: { favoritesDelta: 49, sharesDelta: 19, velocityDelta: 2.9 },
      },
    ],
    priceWaterfall: [
      { category: 'Fashion', yourPrice: 4900, median: 4500, lowestCompetitor: 4200, currency: 'NGN' },
      { category: 'Electronics', yourPrice: null, median: 285000, lowestCompetitor: 268000, currency: 'NGN' },
      { category: 'Health', yourPrice: 3500, median: 3200, lowestCompetitor: 3000, currency: 'NGN' },
      { category: 'Home', yourPrice: 6200, median: 5800, lowestCompetitor: 5400, currency: 'NGN' },
    ],
    stockAlerts: [
      {
        id: 'sa1',
        productName: 'Premium Body Cream 500ml',
        category: 'Health',
        competitorStoreName: 'BellaSkin NG',
        detectedAt: '2026-05-18T19:42:11Z',
      },
      {
        id: 'sa2',
        productName: 'Wireless Earbuds X3',
        category: 'Electronics',
        competitorStoreName: 'TechSwift',
        detectedAt: '2026-05-18T18:09:53Z',
      },
      {
        id: 'sa3',
        productName: 'Hand-woven Raffia Tote',
        category: 'Fashion',
        competitorStoreName: 'AbujaWeaves',
        detectedAt: '2026-05-18T16:20:01Z',
      },
    ],
    marginLeaderboard: [
      { category: 'Beauty', realisedMarkupPct: 18.4, cosellCount: 312, currency: 'NGN' },
      { category: 'Fashion', realisedMarkupPct: 14.2, cosellCount: 504, currency: 'NGN' },
      { category: 'Home', realisedMarkupPct: 12.7, cosellCount: 188, currency: 'NGN' },
      { category: 'Electronics', realisedMarkupPct: 7.3, cosellCount: 96, currency: 'NGN' },
      { category: 'Food', realisedMarkupPct: 6.1, cosellCount: 243, currency: 'NGN' },
    ],
  };
}
