import type { Observation } from "../types";

/**
 * Amazon price history via Keepa's API (check current API pricing on keepa.com).
 * Keepa records a point each time the price changes, so its series holds between points.
 * Keepa time is minutes since 2011-01-01; prices are in paise; -1 means unavailable.
 */
export async function keepaHistory(asin: string): Promise<Observation[] | null> {
  const key = process.env.KEEPA_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://api.keepa.com/product?key=${key}&domain=10&asin=${encodeURIComponent(asin)}&history=1`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const csv: number[] = data?.products?.[0]?.csv?.[0] ?? [];
    const points: Observation[] = [];
    for (let i = 0; i + 1 < csv.length; i += 2) {
      const price = csv[i + 1];
      if (!(price > 0)) continue;
      points.push({
        observed_at: new Date((csv[i] + 21564000) * 60000).toISOString(),
        price: Math.round(price / 100),
        source: "keepa",
        method: "history_api",
      });
    }
    return points.length ? points : null;
  } catch {
    return null;
  }
}
