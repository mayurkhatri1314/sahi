import type { RawDeal } from "../types";

/**
 * Deals from Cuelinks (aggregator across 1,000+ Indian merchants; free to join).
 * Replace the endpoint/parsing with your account's offer feed when you have the key.
 */
export async function cuelinksDeals(): Promise<RawDeal[]> {
  const key = process.env.CUELINKS_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`https://api.cuelinks.com/v3/offers?per_page=200`, {
      headers: { Authorization: `Token token="${key}"` },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.offers ?? []).map(mapCuelinksOffer).filter((d: RawDeal) => d.price > 0 && d.product_url);
  } catch {
    return [];
  }
}

// Cuelinks' own cashback/payout fields describe our commission, not money the shopper gets back,
// so they are deliberately not mapped to cashback_pct.
function mapCuelinksOffer(o: any): RawDeal {
  const price = Number(o.price ?? 0);
  return {
    external_id: `cl-${o.id}`,
    name: o.title,
    brand: o.merchant_name,
    category: o.categories?.[0] ?? "Other",
    store_id: String(o.merchant_name || "").toLowerCase().split(" ")[0],
    product_url: o.url,
    image_url: o.image_url,
    mrp: Number(o.mrp ?? price),
    price,
    coupon_code: o.coupon_code ?? null,
    coupon_value: Number(o.coupon_value ?? 0),
    source: "cuelinks",
  };
}
