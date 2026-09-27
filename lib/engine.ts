import type { RawDeal, Deal, Observation, Freshness, ScoreReason, SeriesPoint } from "./types";

/**
 * The Sahi engine: every price claim the product makes is computed here, deterministically,
 * from stored observations. No claim is made without the coverage to back it.
 */

export const ENGINE_VERSION = "p0.1";

const HOUR = 36e5;
const DAY = 864e5;
const IST_OFFSET = 5.5 * HOUR;

export const RULES = {
  FRESH_HOURS: 12,
  RECENT_HOURS: 48,
  /** A gap longer than this between our own readings means we weren't watching. */
  MAX_FEED_GAP_DAYS: 3,
  /** Shortest window we will call a "low". */
  MIN_CLAIM_DAYS: 7,
  /** Typical price and score need at least this much continuous coverage. */
  MIN_STATS_DAYS: 14,
  MRP_CHECK_DAYS: 30,
  MRP_MISLEADING_RATIO: 1.3,
  TYPICAL_WINDOW_DAYS: 90,
  /** Prices within 0.5% of each other count as the same price. */
  LOW_TOLERANCE: 0.005,
  /** Full "below typical" credit in the score at this discount to typical. */
  SCORE_FULL_BELOW_TYPICAL: 0.2,
} as const;

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const ts = (o: Observation) => Date.parse(o.observed_at);

/* ---------------- offers ---------------- */

export function offerBreakdown(d: Pick<RawDeal, "price" | "coupon_value" | "bank_pct" | "bank_max" | "cashback_pct">) {
  // A coupon worth the whole price is bad data, not a free product.
  const coupon = d.coupon_value && d.coupon_value > 0 && d.coupon_value < d.price ? d.coupon_value : 0;
  const effective = d.price - coupon;
  // Bank offers without a listed cap can't be computed honestly.
  const bank_off = d.bank_pct && d.bank_pct > 0 && d.bank_max && d.bank_max > 0
    ? Math.min(Math.round((effective * d.bank_pct) / 100), d.bank_max)
    : 0;
  const cashback_amt = d.cashback_pct && d.cashback_pct > 0
    ? Math.round(((effective - bank_off) * d.cashback_pct) / 100)
    : 0;
  return { coupon, effective, bank_off, cashback_amt, best_case: Math.max(0, effective - bank_off - cashback_amt) };
}

/* ---------------- observations ---------------- */

export function freshness(observedAt: string | null, now = Date.now()): Freshness {
  if (!observedAt) return "unknown";
  const age = now - Date.parse(observedAt);
  if (!Number.isFinite(age)) return "unknown";
  if (age <= RULES.FRESH_HOURS * HOUR) return "fresh";
  if (age <= RULES.RECENT_HOURS * HOUR) return "recent";
  return "stale";
}

/** Drops impossible readings (non-positive, unparseable, from the future) and sorts oldest first. */
export function cleanObservations(obs: Observation[], now = Date.now()): Observation[] {
  return obs
    .filter((o) => Number.isFinite(o.price) && o.price > 0 && Number.isFinite(ts(o)) && ts(o) <= now + HOUR)
    .sort((a, b) => ts(a) - ts(b));
}

/** Index of the oldest observation in the unbroken run that ends at the latest one. */
function coverageStartIndex(obs: Observation[]): number {
  let start = obs.length - 1;
  for (let i = obs.length - 1; i > 0; i--) {
    const older = obs[i - 1];
    const gap = ts(obs[i]) - ts(older);
    // Tracker change-points hold their price until the next change; our own readings don't.
    if (older.method === "feed" && gap > RULES.MAX_FEED_GAP_DAYS * DAY) break;
    start = i - 1;
  }
  return start;
}

const istDay = (t: number) => new Date(t + IST_OFFSET).toISOString().slice(0, 10);
const endOfIstDay = (day: string) => Date.parse(`${day}T23:59:59.999+05:30`);

/** One point per IST day: the price in effect at the end of that day, across continuous coverage only. */
export function dailySeries(observations: Observation[], now = Date.now()): SeriesPoint[] {
  const obs = cleanObservations(observations, now);
  if (!obs.length) return [];
  const startIdx = coverageStartIndex(obs);
  const run = obs.slice(startIdx);
  const lastDay = istDay(ts(run[run.length - 1]));
  const out: SeriesPoint[] = [];
  let j = 0;
  for (let day = istDay(ts(run[0])); day <= lastDay; day = istDay(endOfIstDay(day) + 1)) {
    const end = endOfIstDay(day);
    while (j + 1 < run.length && ts(run[j + 1]) <= end) j++;
    out.push({ date: day, price: run[j].price });
  }
  return out;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/* ---------------- the deal ---------------- */

export function computeDeal(raw: RawDeal, observations: Observation[] = [], now = Date.now()): Deal {
  const obs = cleanObservations(observations, now);
  const latest = obs.length ? obs[obs.length - 1] : null;
  const price = latest ? latest.price : raw.price;
  const offers = offerBreakdown({ ...raw, price });
  const mrp_off_pct = raw.mrp > 0 && raw.mrp > price ? Math.round(((raw.mrp - price) / raw.mrp) * 100) : 0;

  const observed_at = latest?.observed_at ?? null;
  const fresh = freshness(observed_at, now);
  const live = fresh === "fresh" || fresh === "recent";

  let tracked_days = 0;
  let low_price: number | null = null;
  let high_price: number | null = null;
  let typical_price: number | null = null;
  let vs_typical_pct: number | null = null;
  let low_window_days: number | null = null;
  let score: number | null = null;
  const reasons: ScoreReason[] = [];

  if (latest) {
    tracked_days = Math.floor((ts(latest) - ts(obs[coverageStartIndex(obs)])) / DAY);
    const series = dailySeries(obs, now);
    const window = series.slice(-(RULES.TYPICAL_WINDOW_DAYS + 1));
    const prices = window.map((p) => p.price);

    if (tracked_days >= RULES.MIN_CLAIM_DAYS) {
      low_price = Math.min(...prices);
      high_price = Math.max(...prices);
      if (live) {
        const floor = price * (1 - RULES.LOW_TOLERANCE);
        let k = series.length - 2;
        while (k >= 0 && series[k].price >= floor) k--;
        const days = k < 0 ? tracked_days : Math.min(tracked_days, series.length - 2 - k);
        if (days >= RULES.MIN_CLAIM_DAYS) low_window_days = days;
      }
    }

    if (tracked_days >= RULES.MIN_STATS_DAYS) {
      typical_price = median(prices);
      if (live) vs_typical_pct = Math.round(((price - typical_price) / typical_price) * 100);
    }

    if (live && typical_price !== null && low_price !== null && high_price !== null) {
      const pos = high_price > low_price ? clamp((high_price - price) / (high_price - low_price), 0, 1) : 0.5;
      const below = clamp((typical_price - price) / typical_price / RULES.SCORE_FULL_BELOW_TYPICAL, 0, 1);
      score = Math.round(60 * pos + 40 * below);

      const diff = Math.abs(price - typical_price);
      reasons.push({
        kind: "typical",
        text: vs_typical_pct! < 0
          ? `${inr(diff)} below its typical price of ${inr(typical_price)} (${vs_typical_pct}%)`
          : vs_typical_pct! > 0
            ? `${inr(diff)} above its typical price of ${inr(typical_price)} (+${vs_typical_pct}%)`
            : `In line with its typical price of ${inr(typical_price)}`,
      });
      reasons.push({
        kind: "low",
        text: low_window_days !== null
          ? `Lowest price Sahi has seen in ${low_window_days} days`
          : `${Math.round(((price - low_price) / low_price) * 100)}% above its lowest price in the last ${Math.min(tracked_days, RULES.TYPICAL_WINDOW_DAYS)} days (${inr(low_price)})`,
      });
      reasons.push({ kind: "coverage", text: `Based on ${tracked_days} days of tracking (${obs.length} price checks)` });
      reasons.push({ kind: "offers", text: "Compares store prices only. Coupons and card offers aren't counted." });
    }
  }

  const mrp_misleading =
    tracked_days >= RULES.MRP_CHECK_DAYS && typical_price !== null && raw.mrp > typical_price * RULES.MRP_MISLEADING_RATIO;

  const { history: _history, ...rest } = raw;
  return {
    ...rest,
    price,
    effective: offers.effective,
    best_case: offers.best_case,
    bank_off: offers.bank_off,
    cashback_amt: offers.cashback_amt,
    mrp_off_pct,
    observed_at,
    freshness: fresh,
    tracked_days,
    observation_count: obs.length,
    low_price,
    high_price,
    typical_price,
    vs_typical_pct,
    low_window_days,
    mrp_misleading,
    score,
    score_reasons: reasons,
    engine_version: ENGINE_VERSION,
    computed_at: new Date(now).toISOString(),
  };
}

/** Stored deals were computed at ingest time; re-check freshness at read time so a stalled job can't keep old claims alive. */
export function withFreshness(d: Deal, now = Date.now()): Deal {
  const f = freshness(d.observed_at, now);
  if (f === "fresh" || f === "recent") return { ...d, freshness: f };
  return { ...d, freshness: f, low_window_days: null, vs_typical_pct: null, score: null, score_reasons: [] };
}
