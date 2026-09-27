import { publicClient } from "./supabase";
import { computeDeal, dailySeries, withFreshness } from "./engine";
import { SEED_DEALS } from "./seed";
import type { Deal, Observation, SeriesPoint } from "./types";

const LIST_LIMIT = 500;

/** Live deals from the database, or clearly-flagged sample deals when there are none. */
export async function listDeals(): Promise<Deal[]> {
  const db = publicClient();
  if (db) {
    const { data, error } = await db.from("deals").select("*").eq("active", true)
      .order("score", { ascending: false, nullsFirst: false }).limit(LIST_LIMIT);
    if (!error && data?.length) return (data as Deal[]).map((d) => withFreshness(d));
  }
  return SEED_DEALS.map((d) => computeDeal(d));
}

export async function getDeal(externalId: string): Promise<{ deal: Deal; series: SeriesPoint[] } | null> {
  const db = publicClient();
  if (db) {
    const { data: row } = await db.from("deals").select("*").eq("external_id", externalId).eq("active", true).maybeSingle();
    if (row) {
      const { data: obs } = await db.from("price_observations")
        .select("observed_at, price, source, method").eq("deal_id", row.id)
        .order("observed_at", { ascending: false }).limit(1000);
      return { deal: withFreshness(row as Deal), series: dailySeries((obs ?? []) as Observation[]) };
    }
  }
  const seed = SEED_DEALS.find((d) => d.external_id === externalId);
  return seed ? { deal: computeDeal(seed), series: [] } : null;
}
