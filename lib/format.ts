import { RULES } from "./engine";
import type { Deal } from "./types";

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export function checkedAgo(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 36) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} days ago`;
}

export const checkedAtIST = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) + " IST";

export const lowLabel = (days: number) => `Lowest in ${days} days`;

/** What Sahi can honestly say about history when there's no score. */
export function historyNote(d: Deal): string {
  if (d.sample) return "Sample product. Sahi has no price history for it.";
  if (d.freshness === "stale" || d.freshness === "unknown") return "Sahi couldn't check this price recently, so it makes no claims about it.";
  if (d.tracked_days === 0) return "Sahi started tracking this today.";
  if (d.tracked_days < RULES.MIN_STATS_DAYS)
    return `Sahi has tracked this for ${d.tracked_days} day${d.tracked_days === 1 ? "" : "s"}. A price signal needs ${RULES.MIN_STATS_DAYS}.`;
  return `Tracked for ${d.tracked_days} days.`;
}
