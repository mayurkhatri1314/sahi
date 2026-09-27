import type { SupabaseClient } from "@supabase/supabase-js";
import type { RawDeal, Coupon, Deal, Observation } from "./types";
import { computeDeal } from "./engine";

/** Record a reading at least this often even when the price hasn't moved, so coverage stays continuous. */
const HEARTBEAT_HOURS = 20;
/** Supabase caps a select at 1,000 rows by default; newest rows win. */
const MAX_OBSERVATIONS = 1000;
/** Alerts only fire for lows with real weight behind them. */
const ALERT_MIN_WINDOW_DAYS = 30;

export interface IngestReport {
  deals: number;
  observations: number;
  failed: number;
  alerts: number;
  coupons: number;
  errors: string[];
}

export async function ingest(db: SupabaseClient, deals: RawDeal[], coupons: Coupon[], now = Date.now()): Promise<IngestReport> {
  const report: IngestReport = { deals: 0, observations: 0, failed: 0, alerts: 0, coupons: 0, errors: [] };
  const nowIso = new Date(now).toISOString();

  for (const raw of deals) {
    if (raw.sample) continue; // sample data never enters the database
    try {
      const { data: row, error } = await db.from("deals").upsert({
        external_id: raw.external_id, source: raw.source, name: raw.name, brand: raw.brand,
        category: raw.category, store_id: raw.store_id, product_url: raw.product_url, image_url: raw.image_url,
        mrp: raw.mrp, price: raw.price, coupon_code: raw.coupon_code ?? null, coupon_value: raw.coupon_value ?? 0,
        bank_name: raw.bank_name ?? null, bank_pct: raw.bank_pct ?? 0, bank_max: raw.bank_max ?? 0,
        cashback_pct: raw.cashback_pct ?? 0, active: true, updated_at: nowIso,
      }, { onConflict: "external_id" }).select("id").single();
      if (error || !row) throw new Error(error?.message ?? "upsert returned no row");
      const dealId = row.id as number;

      if (raw.history?.length) {
        await db.from("price_observations").upsert(
          raw.history.map((h) => ({ deal_id: dealId, observed_at: h.observed_at, price: h.price, source: h.source, method: h.method })),
          { onConflict: "deal_id,source,observed_at", ignoreDuplicates: true },
        );
      }

      const { data: prev } = await db.from("price_observations")
        .select("price, observed_at").eq("deal_id", dealId).eq("method", "feed")
        .order("observed_at", { ascending: false }).limit(1).maybeSingle();
      const heartbeatDue = !prev || now - Date.parse(prev.observed_at) > HEARTBEAT_HOURS * 36e5;
      if (!prev || prev.price !== raw.price || heartbeatDue) {
        const { error: obsErr } = await db.from("price_observations").insert({
          deal_id: dealId, observed_at: nowIso, price: raw.price, mrp: raw.mrp, source: raw.source, method: "feed",
        });
        if (obsErr) throw new Error(obsErr.message);
        report.observations++;
      }

      const { data: rows } = await db.from("price_observations")
        .select("observed_at, price, source, method").eq("deal_id", dealId)
        .order("observed_at", { ascending: false }).limit(MAX_OBSERVATIONS);
      const deal = computeDeal(raw, (rows ?? []) as Observation[], now);

      const { error: updErr } = await db.from("deals").update(signalColumns(deal)).eq("id", dealId);
      if (updErr) throw new Error(updErr.message);
      report.deals++;

      const dropped = prev && raw.price < prev.price;
      if (dropped && (deal.low_window_days ?? 0) >= ALERT_MIN_WINDOW_DAYS && process.env.RESEND_API_KEY) {
        report.alerts += await sendAlerts(db, dealId, deal, prev.price);
      }
    } catch (e) {
      report.failed++;
      report.errors.push(`${raw.external_id}: ${(e as Error).message}`);
    }
  }

  for (const c of coupons) {
    if (c.sample) continue;
    // success_rate and verified_at are Sahi's own evidence; a feed refresh must not overwrite them.
    const { error } = await db.from("coupons").upsert({
      external_id: c.external_id, store_id: c.store_id, category: c.category, code: c.code,
      title: c.title, min_order: c.min_order, expires_at: c.expires_at, active: true,
    }, { onConflict: "external_id" });
    if (error) report.errors.push(`coupon ${c.external_id}: ${error.message}`);
    else report.coupons++;
  }

  return report;
}

function signalColumns(d: Deal) {
  return {
    price: d.price, effective: d.effective, best_case: d.best_case, bank_off: d.bank_off,
    cashback_amt: d.cashback_amt, mrp_off_pct: d.mrp_off_pct, observed_at: d.observed_at,
    tracked_days: d.tracked_days, observation_count: d.observation_count, low_price: d.low_price,
    high_price: d.high_price, typical_price: d.typical_price, vs_typical_pct: d.vs_typical_pct,
    low_window_days: d.low_window_days, mrp_misleading: d.mrp_misleading, score: d.score,
    score_reasons: d.score_reasons, engine_version: d.engine_version, computed_at: d.computed_at,
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

async function sendAlerts(db: SupabaseClient, dealId: number, d: Deal, prevPrice: number): Promise<number> {
  const { data: rows } = await db.from("saves").select("user_id").eq("deal_id", dealId).eq("alert", true);
  if (!rows?.length) return 0;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sahi.deals";
  const from = `Sahi Alerts <alerts@${process.env.ALERT_FROM_DOMAIN ?? "sahi.deals"}>`;
  const checked = new Date(d.observed_at!).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  const facts = [
    `Now ${inr(d.price)} at the store, down from ${inr(prevPrice)}.`,
    `The lowest price Sahi has seen in ${d.low_window_days} days.`,
    d.typical_price !== null ? `Typical price: ${inr(d.typical_price)}.` : null,
    d.effective < d.price ? `With coupon ${esc(d.coupon_code ?? "")}: ${inr(d.effective)}.` : null,
  ].filter(Boolean);

  let sent = 0;
  for (const { user_id } of rows) {
    const { data: { user } } = await db.auth.admin.getUserById(user_id as string);
    if (!user?.email) continue;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from, to: [user.email],
        subject: `${d.name} dropped to ${inr(d.price)}, lowest in ${d.low_window_days} days`,
        html: `<p><b>${esc(d.name)}</b></p><p>${facts.join("<br/>")}</p>`
          + `<p style="font-size:12px;color:#666">Price checked ${checked} IST. Prices change; confirm at the store before buying.</p>`
          + `<p><a href="${appUrl}/deal/${encodeURIComponent(d.external_id)}">See the price history</a></p>`
          + `<p style="font-size:11px;color:#999">You set a price alert on Sahi. <a href="${appUrl}">Manage alerts</a>.</p>`,
      }),
    }).catch(() => null);
    if (res?.ok) sent++;
  }
  return sent;
}
