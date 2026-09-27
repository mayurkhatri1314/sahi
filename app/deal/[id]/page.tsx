import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDeal } from "@/lib/deals";
import { SEED_DEALS } from "@/lib/seed";
import { inr, checkedAtIST, historyNote, lowLabel } from "@/lib/format";
import PriceChart from "@/components/PriceChart";

export const revalidate = 300;

export async function generateStaticParams() {
  return SEED_DEALS.map((d) => ({ id: d.external_id }));
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const found = await getDeal(params.id);
  if (!found) return { title: "Deal not found — Sahi" };
  const { deal } = found;
  if (deal.sample) return { title: `${deal.name} (sample) — Sahi`, robots: { index: false, follow: false } };

  const lowNote = deal.low_window_days ? ` ${lowLabel(deal.low_window_days)}.` : "";
  const typicalNote = deal.typical_price ? ` Typical price ${inr(deal.typical_price)}.` : "";
  const description = `${deal.name} is ${inr(deal.price)} at ${storeName(deal.store_id)}.${lowNote}${typicalNote} See Sahi's price history before you buy.`;
  return {
    title: `${deal.name}: ${inr(deal.price)} — Sahi`,
    description,
    alternates: { canonical: `/deal/${encodeURIComponent(deal.external_id)}` },
    openGraph: { title: `${deal.name}: ${inr(deal.price)}`, description, images: deal.image_url ? [deal.image_url] : [] },
  };
}

const STORE: Record<string, string> = { amazon: "Amazon", flipkart: "Flipkart", myntra: "Myntra", ajio: "Ajio", nykaa: "Nykaa" };
const storeName = (id: string) => STORE[id] ?? id;

const INK = "#111114", MUTED = "#6E6E73", FAINT = "#A1A1A6", LINE = "#ECECEE";
const ACCENT = "#0E9D5A", ACCENT_SOFT = "#E7F6EE", ACCENT_INK = "#0a6e40";
const WARN_INK = "#8a4a00", WARN_SOFT = "#FBF1E3";

const card = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 20, padding: 18, marginTop: 14 } as const;
const label = { fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 } as const;

export default async function DealPage({ params }: { params: { id: string } }) {
  const found = await getDeal(params.id);
  if (!found) notFound();
  const { deal, series } = found;
  const live = deal.freshness === "fresh" || deal.freshness === "recent";

  const jsonLd = deal.sample ? null : {
    "@context": "https://schema.org",
    "@type": "Product",
    name: deal.name,
    ...(deal.brand ? { brand: { "@type": "Brand", name: deal.brand } } : {}),
    ...(deal.image_url ? { image: deal.image_url } : {}),
    ...(live ? { offers: { "@type": "Offer", priceCurrency: "INR", price: deal.price, url: deal.product_url } } : {}),
  };

  const stats = [
    deal.typical_price !== null && { k: "Typical", v: inr(deal.typical_price) },
    deal.low_price !== null && { k: "Lowest seen", v: inr(deal.low_price) },
    deal.high_price !== null && { k: "Highest seen", v: inr(deal.high_price) },
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      <div style={{ background: "#FBFBFA", minHeight: "100vh", color: INK, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
        <div style={{ maxWidth: 460, margin: "0 auto", padding: "0 0 40px" }}>
          <header style={{ borderBottom: `1px solid ${LINE}`, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <a href="/" style={{ fontWeight: 700, fontSize: 18, letterSpacing: -0.4, color: INK, textDecoration: "none" }}>Sahi</a>
            <span style={{ fontSize: 11.5, color: MUTED }}>is this actually a good price?</span>
          </header>
          <main style={{ padding: "16px 18px 0" }}>
            {deal.sample && (
              <div style={{ fontSize: 12.5, color: WARN_INK, background: WARN_SOFT, borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
                Sample product for demonstration. Prices and offers here are illustrative, not live.
              </div>
            )}

            <div style={{ ...card, marginTop: 0 }}>
              {deal.image_url && (
                <img src={deal.image_url} alt={deal.name} style={{ width: "100%", height: 220, objectFit: "contain", borderRadius: 14, background: "#F4F4F6", marginBottom: 16 }} />
              )}
              <div style={{ fontSize: 12, color: MUTED }}>{deal.brand ? `${deal.brand} · ` : ""}{storeName(deal.store_id)}</div>
              <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, marginTop: 4, lineHeight: 1.25 }}>{deal.name}</h1>

              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>{inr(deal.effective)}</span>
                {deal.mrp > deal.price && <span style={{ fontSize: 14, color: FAINT, textDecoration: "line-through" }}>MRP {inr(deal.mrp)}</span>}
              </div>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
                {deal.effective < deal.price
                  ? <>Store price {inr(deal.price)}, then coupon <b style={{ color: INK }}>{deal.coupon_code}</b> takes off {inr(deal.price - deal.effective)}</>
                  : <>Store price. No coupon listed.</>}
              </div>

              {deal.low_window_days !== null && (
                <div style={{ marginTop: 12, fontSize: 13.5, fontWeight: 600, color: ACCENT_INK, background: ACCENT_SOFT, borderRadius: 12, padding: "10px 12px" }}>
                  {lowLabel(deal.low_window_days)}, based on Sahi's own price checks.
                </div>
              )}
              {deal.mrp_misleading && deal.typical_price !== null && (
                <div style={{ marginTop: 12, fontSize: 12.5, color: WARN_INK, background: WARN_SOFT, borderRadius: 12, padding: "10px 12px", lineHeight: 1.45 }}>
                  The MRP of {inr(deal.mrp)} isn't a useful guide. This has typically sold for {inr(deal.typical_price)} over the last {Math.min(deal.tracked_days, 90)} days.
                </div>
              )}
            </div>

            <section style={card}>
              <div style={label}>Price signal</div>
              {deal.score !== null ? (
                <>
                  <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8, color: deal.score >= 70 ? ACCENT : deal.score >= 40 ? "#C98A1E" : "#B25C00" }}>
                    {deal.score}<span style={{ fontSize: 13, fontWeight: 600, color: MUTED }}> / 100</span>
                  </div>
                  <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55 }}>
                    {deal.score_reasons.map((r) => <li key={r.kind}>{r.text}</li>)}
                  </ul>
                </>
              ) : (
                <p style={{ fontSize: 13.5, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>{historyNote(deal)}</p>
              )}
              {stats.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 8, marginTop: 14 }}>
                  {stats.map((s) => (
                    <div key={s.k} style={{ background: "#F6F6F7", borderRadius: 12, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, color: MUTED }}>{s.k}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              )}
              {series.length >= 2 && <div style={{ marginTop: 16 }}><PriceChart series={series} typical={deal.typical_price} /></div>}
            </section>

            {deal.best_case < deal.effective && (
              <section style={card}>
                <div style={label}>If you qualify</div>
                {deal.bank_off > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginTop: 10 }}>
                    <span>{deal.bank_name} card offer</span><span style={{ color: ACCENT, fontWeight: 600 }}>− {inr(deal.bank_off)}</span>
                  </div>
                )}
                {deal.cashback_amt > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginTop: 8 }}>
                    <span>Store cashback ({deal.cashback_pct}%, credited later)</span><span style={{ color: ACCENT, fontWeight: 600 }}>− {inr(deal.cashback_amt)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5, fontWeight: 700, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${LINE}` }}>
                  <span>Best case</span><span>{inr(deal.best_case)}</span>
                </div>
                <p style={{ fontSize: 11.5, color: MUTED, marginTop: 6 }}>Only if you pay with that card and the offer's terms apply to your order.</p>
              </section>
            )}

            {deal.sample ? (
              <div style={{ marginTop: 20, textAlign: "center", fontSize: 13.5, color: MUTED, border: `1px dashed ${LINE}`, borderRadius: 16, padding: 16 }}>
                Store link disabled for sample products
              </div>
            ) : (
              <a href={`/api/track?deal=${encodeURIComponent(deal.external_id)}`} target="_blank" rel="noopener noreferrer nofollow sponsored" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20, background: INK, color: "#fff", borderRadius: 16, padding: 16, fontSize: 16, fontWeight: 600, textDecoration: "none" }}>
                Go to {storeName(deal.store_id)} →
              </a>
            )}
            <p style={{ textAlign: "center", fontSize: 11, color: FAINT, marginTop: 10, lineHeight: 1.5 }}>
              {deal.observed_at ? `Price checked ${checkedAtIST(deal.observed_at)}. ` : ""}
              {!live && !deal.sample ? "This price may have changed. " : ""}
              Sahi may earn a commission from the store. It doesn't change what you pay or how Sahi scores prices.
            </p>
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <a href="/" style={{ fontSize: 14, color: MUTED, textDecoration: "none" }}>← All products</a>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
