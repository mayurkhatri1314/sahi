import type { RawDeal, Coupon } from "../types";
import { cuelinksDeals } from "./cuelinks";
import { inrdealsDeals } from "./inrdeals";
import { keepaHistory } from "./keepa";
import { feedCoupons } from "./coupons";
import { SEED_DEALS, SEED_COUPONS } from "../seed";

export const asinFromUrl = (url: string) => url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/)?.[1] ?? null;

/** Pull deals from every configured network; fall back to sample data when none is configured. */
export async function fetchAllDeals(): Promise<RawDeal[]> {
  const [a, b] = await Promise.all([cuelinksDeals(), inrdealsDeals()]);
  const live = [...a, ...b];
  if (!live.length) return SEED_DEALS;

  for (const d of live) {
    const asin = d.store_id === "amazon" ? asinFromUrl(d.product_url) : null;
    if (asin) d.history = (await keepaHistory(asin)) ?? undefined;
  }
  return live;
}

export async function fetchAllCoupons(): Promise<Coupon[]> {
  const live = await feedCoupons();
  return live.length ? live : SEED_COUPONS;
}
