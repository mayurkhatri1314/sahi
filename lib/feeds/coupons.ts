import type { Coupon } from "../types";

/**
 * Coupons from a coupon-feed API (LinkMyDeals / Coupomated / CouponAPI).
 * A listed code is not a verified code: success_rate and verified_at stay null
 * until Sahi has its own evidence (user reports or a checkout re-test).
 */
export async function feedCoupons(): Promise<Coupon[]> {
  const key = process.env.COUPON_FEED_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`https://feed.linkmydeals.com/getOffers/?API_KEY=${key}&format=json&offer_type=code`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.offers ?? [])
      .filter((o: any) => o.code)
      .map((o: any): Coupon => {
        const end = o.end_date ? new Date(o.end_date) : null;
        return {
          external_id: `lmd-${o.lmd_id ?? o.id}`,
          store_id: String(o.store || "").toLowerCase().split(" ")[0],
          store: o.store,
          category: o.categories?.split(",")[0] ?? "All",
          code: o.code,
          title: o.title ?? o.offer,
          min_order: Number(o.minimum_order ?? 0),
          success_rate: null,
          verified_at: null,
          expires_at: end && !Number.isNaN(end.getTime()) ? end.toISOString() : null,
        };
      });
  } catch {
    return [];
  }
}
