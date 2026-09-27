import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDeal, dailySeries, offerBreakdown, withFreshness, RULES } from "./engine";
import type { Observation, RawDeal } from "./types";

const NOW = Date.parse("2026-09-26T12:00:00+05:30");
const DAY = 864e5;

const base: RawDeal = {
  external_id: "T1", name: "Test Headphones", category: "Audio", store_id: "amazon",
  product_url: "https://www.amazon.in/dp/T1", mrp: 10000, price: 5000, source: "test",
};

/** Daily feed readings: prices[0] is the oldest, the last one is taken `lastAgeH` hours before NOW. */
function daily(prices: number[], lastAgeH = 1, method: Observation["method"] = "feed"): Observation[] {
  const last = NOW - lastAgeH * 36e5;
  return prices.map((price, i) => ({
    observed_at: new Date(last - (prices.length - 1 - i) * DAY).toISOString(),
    price, source: "test", method,
  }));
}

test("no observations: no claims, no score, unknown freshness", () => {
  const d = computeDeal(base, [], NOW);
  assert.equal(d.freshness, "unknown");
  assert.equal(d.tracked_days, 0);
  assert.equal(d.low_window_days, null);
  assert.equal(d.typical_price, null);
  assert.equal(d.score, null);
  assert.deepEqual(d.score_reasons, []);
});

test("5 days of data is too little to claim a low or score", () => {
  const d = computeDeal(base, daily([6000, 5800, 5600, 5400, 5200, 5000]), NOW);
  assert.equal(d.tracked_days, 5);
  assert.equal(d.low_window_days, null);
  assert.equal(d.score, null);
});

test("17 days of coverage claims 17 days, never 30/60/90", () => {
  const prices = Array.from({ length: 18 }, (_, i) => 6000 - i * 50);
  const d = computeDeal({ ...base, price: prices[17] }, daily(prices), NOW);
  assert.equal(d.tracked_days, 17);
  assert.equal(d.low_window_days, 17);
});

test("an earlier cheaper day caps the low window", () => {
  // cheaper 10 days ago, flat-ish since
  const prices = [...Array(20).fill(6000), 4800, ...Array(10).fill(5000)];
  const d = computeDeal(base, daily(prices), NOW);
  assert.equal(d.low_window_days, 9);
  assert.equal(d.low_price, 4800);
});

test("current price above recent days gets no low claim", () => {
  const prices = [...Array(20).fill(5000), 5600];
  const d = computeDeal(base, daily(prices), NOW);
  assert.equal(d.low_window_days, null);
  assert.ok(d.score_reasons.some((r) => r.kind === "low" && r.text.includes("above its lowest")));
});

test("a gap in our own readings restarts coverage", () => {
  const old = daily([7000, 7000, 7000], 24 * 12 + 1); // ends 12 days ago
  const recent = daily([5000, 5000, 5000, 5000, 5000, 5000], 1); // last 5 days
  const d = computeDeal(base, [...old, ...recent], NOW);
  assert.equal(d.tracked_days, 5);
  assert.equal(d.low_window_days, null);
  assert.equal(dailySeries([...old, ...recent], NOW).length, 6);
});

test("tracker change-points with long gaps are continuous", () => {
  const keepa: Observation[] = [
    { observed_at: new Date(NOW - 80 * DAY).toISOString(), price: 6000, source: "keepa", method: "history_api" },
    { observed_at: new Date(NOW - 40 * DAY).toISOString(), price: 5500, source: "keepa", method: "history_api" },
  ];
  const now: Observation = { observed_at: new Date(NOW - 36e5).toISOString(), price: 5000, source: "test", method: "feed" };
  const d = computeDeal(base, [...keepa, now], NOW);
  assert.ok(d.tracked_days >= 79);
  assert.ok(d.low_window_days! >= 79);
  assert.ok(d.typical_price! > 5000);
});

test("stale price: claims suppressed, and withFreshness strips stored claims later", () => {
  const prices = Array.from({ length: 40 }, (_, i) => 6000 - i * 20);
  const stale = computeDeal(base, daily(prices, 72), NOW);
  assert.equal(stale.freshness, "stale");
  assert.equal(stale.low_window_days, null);
  assert.equal(stale.score, null);

  const fresh = computeDeal(base, daily(prices), NOW);
  assert.ok(fresh.score !== null);
  const later = withFreshness(fresh, NOW + 3 * DAY);
  assert.equal(later.freshness, "stale");
  assert.equal(later.score, null);
  assert.equal(later.low_window_days, null);
});

test("score is deterministic, bounded and explained", () => {
  const prices = [...Array(30).fill(6000), ...Array(10).fill(5000)];
  const a = computeDeal(base, daily(prices), NOW);
  const b = computeDeal(base, daily(prices), NOW);
  assert.equal(a.score, b.score);
  assert.ok(a.score! >= 0 && a.score! <= 100);
  assert.deepEqual(a.score_reasons.map((r) => r.kind), ["typical", "low", "coverage", "offers"]);
  assert.equal(a.engine_version, b.engine_version);
});

test("conditional offers never reduce the price anyone pays", () => {
  const o = offerBreakdown({ price: 20000, coupon_value: 1000, bank_pct: 10, bank_max: 1500, cashback_pct: 5 });
  assert.equal(o.effective, 19000);
  assert.equal(o.bank_off, 1500); // capped
  assert.equal(o.cashback_amt, Math.round(17500 * 0.05));
  assert.equal(o.best_case, 19000 - 1500 - 875);
});

test("bank offer without a listed cap is not computed", () => {
  assert.equal(offerBreakdown({ price: 20000, bank_pct: 10 }).bank_off, 0);
});

test("impossible inputs are ignored, not believed", () => {
  assert.equal(offerBreakdown({ price: 500, coupon_value: 800 }).effective, 500);
  const bad: Observation[] = [
    { observed_at: new Date(NOW - DAY).toISOString(), price: 0, source: "test", method: "feed" },
    { observed_at: new Date(NOW - DAY).toISOString(), price: -40, source: "test", method: "feed" },
    { observed_at: "not a date", price: 4000, source: "test", method: "feed" },
    { observed_at: new Date(NOW + 5 * DAY).toISOString(), price: 100, source: "test", method: "feed" },
  ];
  const d = computeDeal(base, bad, NOW);
  assert.equal(d.observation_count, 0);
  assert.equal(d.price, base.price);
});

test("MRP is flagged only with enough history and a real gap", () => {
  const prices = Array(RULES.MRP_CHECK_DAYS + 5).fill(5000);
  assert.equal(computeDeal({ ...base, mrp: 10000 }, daily(prices), NOW).mrp_misleading, true);
  assert.equal(computeDeal({ ...base, mrp: 5500 }, daily(prices), NOW).mrp_misleading, false);
  assert.equal(computeDeal({ ...base, mrp: 10000 }, daily(prices.slice(0, 10)), NOW).mrp_misleading, false);
});
