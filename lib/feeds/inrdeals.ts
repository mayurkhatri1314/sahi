import type { RawDeal } from "../types";

/** Deals from INRDeals "Active Store" API (free to join; coupon + deal feeds). */
export async function inrdealsDeals(): Promise<RawDeal[]> {
  const id = process.env.INRDEALS_PUBLISHER_ID;
  const key = process.env.INRDEALS_API_KEY;
  if (!id || !key) return [];
  try {
    const res = await fetch(`https://inrdeals.com/publisher/api/deals?id=${id}&key=${key}`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.deals ?? [])
      .map((d: any): RawDeal => {
        const price = Number(d.price ?? 0);
        return {
          external_id: `ird-${d.id}`,
          name: d.title,
          brand: d.store,
          category: d.category ?? "Other",
          store_id: String(d.store || "").toLowerCase().split(" ")[0],
          product_url: d.url,
          image_url: d.image,
          mrp: Number(d.mrp ?? price),
          price,
          coupon_code: d.code ?? null,
          coupon_value: Number(d.code_value ?? 0),
          source: "inrdeals",
        };
      })
      .filter((d: RawDeal) => d.price > 0 && d.product_url);
  } catch {
    return [];
  }
}
