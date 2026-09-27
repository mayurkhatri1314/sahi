import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Search, X, Heart, Tag, BadgeCheck, ShieldCheck, ChevronRight, Copy, Check,
  SlidersHorizontal, Flame, TrendingDown, Ticket, Clock, Bell, Sparkles, Zap,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";

/* ================================================================
   SAHI — "what you'll actually pay"
   Deals · Lowest in 90 days · Coupons
================================================================ */
const INK = "#111114", MUTED = "#6E6E73", FAINT = "#A1A1A6", LINE = "#ECECEE";
const ACCENT = "#0E9D5A", ACCENT_SOFT = "#E7F6EE", ACCENT_INK = "#0a6e40";
const WARN_INK = "#8a4a00", WARN_SOFT = "#FBF1E3";
const CARD_SHADOW = "0 1px 2px rgba(17,17,20,0.04), 0 10px 30px rgba(17,17,20,0.05)";
const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");

/* ---- animated count-up number ---- */
function useCountUp(target, dur = 700) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    if (reduce) { setV(target); from.current = target; return; }
    let raf, start; const a = from.current, b = target;
    const tick = (t) => { if (!start) start = t; const p = Math.min(1, (t - start) / dur); const e = 1 - Math.pow(1 - p, 3); setV(a + (b - a) * e); if (p < 1) raf = requestAnimationFrame(tick); else from.current = b; };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return v;
}
function Money({ value, style }) { const v = useCountUp(value); return <span style={style}>{inr(v)}</span>; }

/* ---- circular Sahi Score ---- */
function ScoreRing({ score, size = 56 }) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r;
  const v = useCountUp(score, 900);
  const col = score >= 75 ? ACCENT : score >= 50 ? "#C98A1E" : "#B25C00";
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#EEEEF0" strokeWidth="4" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * v) / 100} style={{ transition: "stroke-dashoffset .1s linear" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.3, fontWeight: 800, letterSpacing: -0.5, color: col, lineHeight: 1 }}>{Math.round(v)}</span>
        <span style={{ fontSize: 7.5, fontWeight: 600, color: MUTED, letterSpacing: 0.5, marginTop: 1 }}>SCORE</span>
      </div>
    </div>
  );
}

/* ---- price history generator ---- */
const SHAPE = [1.12, 1.1, 1.09, 1.08, 1.07, 1.06, 1.05, 1.045, 1.04, 1.03, 1.02, 1.0];
function genHist(now, tier) {
  const h = SHAPE.map((m) => Math.round(now * m)); h[11] = now;
  if (tier === 60) { h[0] = Math.round(now * 0.965); h[1] = Math.round(now * 0.975); }
  else if (tier === 30) { h[5] = Math.round(now * 0.965); h[6] = Math.round(now * 0.975); }
  else if (tier === null) { h[9] = Math.round(now * 0.96); }
  return h.map((p, w) => ({ w, p }));
}

const RAW = [
  { id: 1, name: "iPhone 15 (128 GB)", brand: "Apple", cat: "Mobiles", icon: "📱", color: "#F2F2F7", platform: "Amazon", mrp: 79900, price: 66999, coupon: null, bank: { name: "HDFC Credit", pct: 10, max: 5000 }, cashbackPct: 2, tier: 90 },
  { id: 2, name: "Galaxy S24 5G (256 GB)", brand: "Samsung", cat: "Mobiles", icon: "📱", color: "#EAF1FB", platform: "Flipkart", mrp: 89999, price: 61999, coupon: { code: "FLIP3000", value: 3000 }, bank: { name: "ICICI Credit", pct: 10, max: 4000 }, cashbackPct: 3, tier: 90 },
  { id: 3, name: "WH-1000XM5 Headphones", brand: "Sony", cat: "Audio", icon: "🎧", color: "#EFEAFB", platform: "Amazon", mrp: 34990, price: 24990, coupon: { code: "SONY1500", value: 1500 }, bank: { name: "Axis Credit", pct: 10, max: 2000 }, cashbackPct: 4, tier: 60 },
  { id: 4, name: "Airdopes 161 TWS", brand: "boAt", cat: "Audio", icon: "🎧", color: "#FBEAEA", platform: "Amazon", mrp: 2990, price: 1299, coupon: { code: "BOAT100", value: 100 }, bank: null, cashbackPct: 6, tier: 30, inflatedMrp: 1799 },
  { id: 5, name: "Revolution 7 Running Shoes", brand: "Nike", cat: "Fashion", icon: "👟", color: "#F1F1F1", platform: "Myntra", mrp: 4995, price: 2747, coupon: { code: "MYNTRA200", value: 200 }, bank: { name: "Kotak Credit", pct: 10, max: 500 }, cashbackPct: 5, tier: 90 },
  { id: 6, name: "511 Slim Fit Jeans", brand: "Levi's", cat: "Fashion", icon: "👖", color: "#EAEFF7", platform: "Ajio", mrp: 3999, price: 1799, coupon: { code: "AJIO300", value: 300 }, bank: null, cashbackPct: 7, tier: 90 },
  { id: 7, name: "Vitamin C Face Wash 100ml", brand: "Mamaearth", cat: "Beauty", icon: "🧴", color: "#FBF3E6", platform: "Nykaa", mrp: 399, price: 299, coupon: { code: "GLOW50", value: 50 }, bank: null, cashbackPct: 8, tier: 30 },
  { id: 8, name: "Renesa 1200mm Ceiling Fan", brand: "Atomberg", cat: "Appliances", icon: "🌀", color: "#EAF6F4", platform: "Flipkart", mrp: 4490, price: 3299, coupon: null, bank: { name: "ICICI Credit", pct: 10, max: 400 }, cashbackPct: 4, tier: 90 },
  { id: 9, name: "Air Fryer HD9252 4.1L", brand: "Philips", cat: "Home", icon: "🍳", color: "#FBEAF1", platform: "Amazon", mrp: 12995, price: 7999, coupon: { code: "KITCHEN500", value: 500 }, bank: { name: "SBI Credit", pct: 10, max: 1000 }, cashbackPct: 3, tier: 60 },
  { id: 10, name: "ColorFit Pro 5 Smartwatch", brand: "Noise", cat: "Electronics", icon: "⌚", color: "#EBEBF2", platform: "Flipkart", mrp: 5999, price: 2999, coupon: { code: "NOISE200", value: 200 }, bank: null, cashbackPct: 6, tier: null, inflatedMrp: 3499 },
  { id: 11, name: "1.5 Ton 5★ Inverter AC", brand: "LG", cat: "Appliances", icon: "❄️", color: "#EAF4FB", platform: "Flipkart", mrp: 64990, price: 41990, coupon: { code: "COOL2000", value: 2000 }, bank: { name: "HDFC Credit", pct: 10, max: 3500 }, cashbackPct: 2, tier: 90 },
  { id: 12, name: "Flip 6 Portable Speaker", brand: "JBL", cat: "Audio", icon: "🔊", color: "#F3EAFB", platform: "Amazon", mrp: 11999, price: 7499, coupon: null, bank: { name: "Axis Credit", pct: 10, max: 1000 }, cashbackPct: 5, tier: 60 },
  { id: 13, name: "Note 13 Pro 5G (128 GB)", brand: "Redmi", cat: "Mobiles", icon: "📱", color: "#FBEFEA", platform: "Amazon", mrp: 27999, price: 22999, coupon: { code: "REDMI1000", value: 1000 }, bank: { name: "ICICI Credit", pct: 10, max: 2000 }, cashbackPct: 3, tier: 30 },
  { id: 14, name: "Inspiron 15 (i5 · 16GB)", brand: "Dell", cat: "Electronics", icon: "💻", color: "#EAEFF7", platform: "Amazon", mrp: 78990, price: 54990, coupon: { code: "DELL2000", value: 2000 }, bank: { name: "HDFC Credit", pct: 10, max: 4000 }, cashbackPct: 2, tier: 90 },
  { id: 15, name: "9to5 Primer + Matte Lipstick", brand: "Lakmé", cat: "Beauty", icon: "💄", color: "#FBEAF3", platform: "Nykaa", mrp: 650, price: 449, coupon: { code: "BEAUTY50", value: 50 }, bank: null, cashbackPct: 7, tier: 60 },
  { id: 16, name: "Premium Care Pants (M, 74)", brand: "Pampers", cat: "Kids", icon: "🍼", color: "#EAF6FB", platform: "Amazon", mrp: 1799, price: 1199, coupon: { code: "BABY100", value: 100 }, bank: null, cashbackPct: 6, tier: 30 },
  { id: 17, name: "Galaxy Building Blocks 150pc", brand: "Funskool", cat: "Kids", icon: "🧸", color: "#FBF0E6", platform: "Flipkart", mrp: 1299, price: 649, coupon: null, bank: null, cashbackPct: 5, tier: 90, inflatedMrp: 899 },
  { id: 18, name: "Baby Carrier 4-in-1", brand: "LuvLap", cat: "Kids", icon: "👶", color: "#F0EAFB", platform: "Amazon", mrp: 2999, price: 1699, coupon: { code: "LUV150", value: 150 }, bank: null, cashbackPct: 6, tier: 60 },
];

function compute(d) {
  const afterCoupon = d.coupon ? d.price - d.coupon.value : d.price;
  const bankOff = d.bank ? Math.min(Math.round(afterCoupon * (d.bank.pct / 100)), d.bank.max) : 0;
  const payNow = afterCoupon - bankOff;
  const cashback = Math.round(afterCoupon * (d.cashbackPct / 100));
  const effective = payNow - cashback;
  const savings = d.mrp - effective;
  const savingsPct = Math.round((savings / d.mrp) * 100);
  const history = genHist(d.price, d.tier);
  const lowFrom = (i) => Math.min(...history.slice(i).map((x) => x.p));
  const low30 = lowFrom(8), low60 = lowFrom(4), low90 = lowFrom(0);
  const tol = d.price * 1.005;
  const bestWindow = tol >= low90 ? 90 : tol >= low60 ? 60 : tol >= low30 ? 30 : null;
  const honestBase = d.inflatedMrp || d.mrp;
  const honestPct = Math.round(((honestBase - effective) / honestBase) * 100);
  const score = Math.max(8, Math.min(99, Math.round(honestPct * 1.25 + (bestWindow ? bestWindow / 4 : 0) + d.cashbackPct)));
  return { ...d, history, afterCoupon, bankOff, payNow, cashback, effective, savings, savingsPct, low30, low60, low90, bestWindow, honestPct, score, couponOff: d.coupon ? d.coupon.value : 0 };
}
const DEALS = RAW.map(compute);
const DEAL_CATS = ["All", "Electronics", "Mobiles", "Fashion", "Beauty", "Kids", "Home", "Appliances", "Audio"];
const STORES = ["Amazon", "Flipkart", "Myntra", "Ajio", "Nykaa"];
const PRICE_BANDS = [{ id: "a", label: "Under ₹1,000", lo: 0, hi: 1000 }, { id: "b", label: "₹1k – ₹5k", lo: 1000, hi: 5000 }, { id: "c", label: "₹5k – ₹20k", lo: 5000, hi: 20000 }, { id: "d", label: "Over ₹20k", lo: 20000, hi: Infinity }];
const DISC_STEPS = [10, 30, 50, 70];
const COUPONS = [
  { id: "c1", store: "Amazon", letter: "a", color: "#FFEBD6", code: "AMZ10BANK", title: "10% off with ICICI cards", cat: "Electronics", min: 5000, verifiedHrs: 3, success: 96, expiresDays: 6 },
  { id: "c2", store: "Flipkart", letter: "F", color: "#DCEBFB", code: "FLIPEXTRA5", title: "Extra 5% on electronics", cat: "Electronics", min: 9999, verifiedHrs: 6, success: 91, expiresDays: 4 },
  { id: "c3", store: "Myntra", letter: "M", color: "#FBE2EC", code: "MYNTRA600", title: "₹600 off on ₹2,999+ fashion", cat: "Fashion", min: 2999, verifiedHrs: 2, success: 98, expiresDays: 9 },
  { id: "c4", store: "Nykaa", letter: "N", color: "#FBE0E8", code: "NYKAANEW", title: "20% off for new users", cat: "Beauty", min: 599, verifiedHrs: 5, success: 94, expiresDays: 12 },
  { id: "c5", store: "Ajio", letter: "A", color: "#E7E7F2", code: "AJIO1200", title: "₹1,200 off on ₹4,990+", cat: "Fashion", min: 4990, verifiedHrs: 9, success: 88, expiresDays: 3 },
  { id: "c6", store: "Swiggy Instamart", letter: "S", color: "#FDE7D6", code: "INSTA40", title: "40% off groceries (max ₹80)", cat: "Grocery", min: 199, verifiedHrs: 1, success: 97, expiresDays: 2 },
  { id: "c7", store: "boAt", letter: "b", color: "#E9E9EE", code: "BOATBIG", title: "Flat 12% on audio", cat: "Electronics", min: 999, verifiedHrs: 11, success: 90, expiresDays: 7 },
  { id: "c8", store: "Mamaearth", letter: "m", color: "#FBF4E2", code: "EARTH25", title: "25% off sitewide", cat: "Beauty", min: 399, verifiedHrs: 4, success: 95, expiresDays: 5 },
  { id: "c9", store: "MakeMyTrip", letter: "M", color: "#DCE9FB", code: "MMTFLY", title: "₹1,500 off domestic flights", cat: "Travel", min: 4000, verifiedHrs: 7, success: 86, expiresDays: 8 },
  { id: "c10", store: "BigBasket", letter: "B", color: "#E2F3E2", code: "BBNEW150", title: "₹150 off first grocery order", cat: "Grocery", min: 1000, verifiedHrs: 3, success: 99, expiresDays: 14 },
  { id: "c11", store: "Tata CliQ", letter: "T", color: "#E7E7F2", code: "CLIQ8", title: "8% off on large appliances", cat: "Home", min: 14999, verifiedHrs: 13, success: 84, expiresDays: 6 },
  { id: "c12", store: "Amazon", letter: "a", color: "#FFEBD6", code: "BABYCARE", title: "₹100 off baby care ₹999+", cat: "Kids", min: 999, verifiedHrs: 8, success: 93, expiresDays: 10 },
  { id: "c13", store: "Zomato", letter: "Z", color: "#FBE0E0", code: "EAT60", title: "60% off (max ₹120) on food", cat: "Food", min: 199, verifiedHrs: 1, success: 97, expiresDays: 1 },
  { id: "c14", store: "Flipkart", letter: "F", color: "#DCEBFB", code: "KIDS400", title: "₹400 off toys ₹1,499+", cat: "Kids", min: 1499, verifiedHrs: 10, success: 89, expiresDays: 5 },
];
const COUPON_CATS = ["All", "Electronics", "Fashion", "Beauty", "Grocery", "Food", "Kids", "Travel", "Home"];

/* ================================================================ */
export default function App() {
  const [section, setSection] = useState("deals");
  const [query, setQuery] = useState("");
  const [dealCat, setDealCat] = useState("All");
  const [lowWindow, setLowWindow] = useState("all");
  const [coupCat, setCoupCat] = useState("All");
  const [sort, setSort] = useState("save");
  const [filters, setFilters] = useState({ stores: new Set(), minDisc: 0, band: null });
  const [filterOpen, setFilterOpen] = useState(false);
  const [saved, setSaved] = useState(() => new Set());
  const [alerts, setAlerts] = useState(() => new Set());
  const [open, setOpen] = useState(null);
  const [copied, setCopied] = useState(null);
  const [loading, setLoading] = useState(false);

  const go = (s) => { if (s === section) return; setSection(s); setOpen(null); setLoading(true); setTimeout(() => setLoading(false), 380); };
  const toggleSave = (id) => setSaved((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAlert = (id) => setAlerts((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const copyCode = (id, code) => { navigator.clipboard?.writeText(code); setCopied(id); setTimeout(() => setCopied(null), 1500); };
  const activeFilterCount = filters.stores.size + (filters.minDisc ? 1 : 0) + (filters.band ? 1 : 0);

  const applyDealFilters = (arr) => arr.filter((d) => {
    const okStore = filters.stores.size === 0 || filters.stores.has(d.platform);
    const okDisc = d.savingsPct >= filters.minDisc;
    const band = filters.band && PRICE_BANDS.find((b) => b.id === filters.band);
    const okBand = !band || (d.effective >= band.lo && d.effective < band.hi);
    const okQ = !query || (d.name + " " + d.brand + " " + d.platform).toLowerCase().includes(query.toLowerCase());
    return okStore && okDisc && okBand && okQ;
  });
  const sortDeals = (arr) => [...arr].sort((a, b) => sort === "save" ? b.savings - a.savings : sort === "price" ? a.effective - b.effective : sort === "disc" ? b.savingsPct - a.savingsPct : b.score - a.score);

  const dealsList = useMemo(() => sortDeals(applyDealFilters(DEALS.filter((d) => dealCat === "All" || d.cat === dealCat))), [dealCat, sort, filters, query]);
  const heroDeal = useMemo(() => DEALS.slice().sort((a, b) => b.score - a.score)[0], []);
  const lowestList = useMemo(() => {
    let r = DEALS.filter((d) => d.bestWindow !== null);
    if (lowWindow !== "all") r = r.filter((d) => d.bestWindow === Number(lowWindow));
    return [...applyDealFilters(r)].sort((a, b) => (b.bestWindow - a.bestWindow) || (b.savings - a.savings));
  }, [lowWindow, filters, query]);
  const couponsList = useMemo(() => {
    let r = COUPONS.filter((c) => coupCat === "All" || c.cat === coupCat);
    if (filters.stores.size) r = r.filter((c) => filters.stores.has(c.store));
    if (query) r = r.filter((c) => (c.store + " " + c.title + " " + c.code).toLowerCase().includes(query.toLowerCase()));
    return [...r].sort((a, b) => b.success - a.success);
  }, [coupCat, filters, query]);
  const savedList = useMemo(() => DEALS.filter((d) => saved.has(d.id)), [saved]);
  const savedTotal = savedList.reduce((t, d) => t + d.savings, 0);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ background: "#FBFBFA", color: INK, minHeight: "100%", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <style>{`
        .noscroll::-webkit-scrollbar{display:none}.noscroll{-ms-overflow-style:none;scrollbar-width:none}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes sheetUp{from{opacity:0;transform:translateY(40px) scale(.98)}to{opacity:1;transform:none}}
        @keyframes pop{0%{transform:scale(1)}45%{transform:scale(1.25)}100%{transform:scale(1)}}
        @keyframes shimmer{0%{background-position:-300px 0}100%{background-position:300px 0}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
        @keyframes auroraMove{0%{transform:translate(-10%,-20%) scale(1)}50%{transform:translate(10%,10%) scale(1.15)}100%{transform:translate(-10%,-20%) scale(1)}}
        .fu{animation:fadeUp .5s cubic-bezier(.16,1,.3,1) both}
        .press{transition:transform .12s ease}.press:active{transform:scale(.96)}
        .pop{animation:pop .4s ease}
        .skel{background:linear-gradient(90deg,#F0F0F1 25%,#F7F7F8 37%,#F0F0F1 63%);background-size:600px 100%;animation:shimmer 1.3s infinite linear}
        .row-cascade{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) both}
        @media (prefers-reduced-motion:reduce){.fu,.pop,.skel,.row-cascade,*{animation:none!important}}
      `}</style>

      <div style={{ maxWidth: 460, margin: "0 auto", paddingBottom: 92, position: "relative" }}>
        {/* header with aurora wash */}
        <header style={{ position: "sticky", top: 0, zIndex: 30, background: "rgba(251,251,250,.82)", backdropFilter: "blur(14px)", borderBottom: `1px solid ${LINE}`, overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -60, right: -40, width: 200, height: 160, background: "radial-gradient(circle, rgba(14,157,90,.16), transparent 70%)", filter: "blur(20px)", animation: "auroraMove 14s ease-in-out infinite", pointerEvents: "none" }} />
          <div className="flex items-center justify-between" style={{ padding: "13px 18px 9px", position: "relative" }}>
            <div className="flex items-center" style={{ gap: 10 }}>
              <div className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 10, background: INK, boxShadow: "0 4px 12px rgba(17,17,20,.18)" }}><Check size={19} color="#fff" strokeWidth={3} /></div>
              <div>
                <div style={{ fontSize: 10.5, color: MUTED }}>{greet} 👋</div>
                <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: -0.4, lineHeight: 1.05 }}>Sahi</div>
              </div>
            </div>
            <div className="flex items-center" style={{ gap: 8 }}>
              <span className="flex items-center" style={{ gap: 5, fontSize: 10.5, fontWeight: 600, color: ACCENT_INK, background: ACCENT_SOFT, padding: "5px 9px", borderRadius: 999 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: ACCENT, animation: "pulse 1.6s infinite" }} /> 12,480 prices live
              </span>
            </div>
          </div>
          <div style={{ padding: "0 18px 10px", position: "relative" }}>
            <div className="flex items-center" style={{ gap: 9, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: "11px 13px", boxShadow: "0 1px 2px rgba(0,0,0,.03)" }}>
              <Search size={17} color={FAINT} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={section === "coupons" ? "Search stores, coupons" : "Search products, brands, stores"} style={{ border: "none", outline: "none", width: "100%", fontSize: 14.5, background: "transparent", color: INK }} />
              {query && <X size={16} color={FAINT} className="press" style={{ cursor: "pointer" }} onClick={() => setQuery("")} />}
            </div>
          </div>
          {section !== "saved" && (
            <div className="flex items-center" style={{ gap: 8, padding: "0 18px 12px", position: "relative" }}>
              <div className="noscroll flex" style={{ gap: 8, overflowX: "auto", flex: 1 }}>
                {section === "deals" && DEAL_CATS.map((c) => <Chip key={c} on={c === dealCat} onClick={() => setDealCat(c)}>{c}</Chip>)}
                {section === "lowest" && [{ id: "all", label: "All lows" }, { id: "90", label: "Cheapest 90d" }, { id: "60", label: "Cheapest 60d" }, { id: "30", label: "Cheapest 30d" }].map((w) => <Chip key={w.id} on={w.id === lowWindow} onClick={() => setLowWindow(w.id)}>{w.label}</Chip>)}
                {section === "coupons" && COUPON_CATS.map((c) => <Chip key={c} on={c === coupCat} onClick={() => setCoupCat(c)}>{c}</Chip>)}
              </div>
              <button onClick={() => setFilterOpen(true)} className="press flex items-center" style={{ gap: 6, flexShrink: 0, fontSize: 13, fontWeight: 600, color: activeFilterCount ? "#fff" : INK, background: activeFilterCount ? INK : "#fff", border: `1px solid ${activeFilterCount ? INK : LINE}`, borderRadius: 999, padding: "7px 12px" }}><SlidersHorizontal size={15} /> {activeFilterCount || "Filters"}</button>
            </div>
          )}
        </header>

        {(section === "deals" || section === "lowest") && (
          <div className="noscroll flex" style={{ gap: 7, overflowX: "auto", padding: "14px 18px 4px" }}>
            {[{ id: "save", l: "Biggest saving" }, { id: "price", l: "Lowest price" }, { id: "disc", l: "Highest % off" }, { id: "score", l: "Best deal score" }].map((s) => { const on = s.id === sort; return <button key={s.id} onClick={() => setSort(s.id)} className="press" style={{ whiteSpace: "nowrap", fontSize: 12.5, fontWeight: on ? 600 : 500, padding: "6px 11px", borderRadius: 10, background: on ? "#fff" : "transparent", border: `1px solid ${on ? INK : "transparent"}`, color: on ? INK : MUTED }}>{s.l}</button>; })}
          </div>
        )}

        <main style={{ padding: "14px 18px 0" }}>
          {loading ? <Skeletons /> : (
            <>
              {section === "deals" && (
                <>
                  {dealCat === "All" && !query && <Hero d={heroDeal} onOpen={() => setOpen(heroDeal)} />}
                  <List items={dealsList} saved={saved} onSave={toggleSave} onOpen={setOpen} emptyMsg="No deals match these filters. Try clearing them." />
                </>
              )}
              {section === "lowest" && (
                <>
                  <div className="flex" style={{ gap: 9, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: "11px 13px", marginBottom: 14 }}>
                    <TrendingDown size={17} color={ACCENT} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.45 }}>Only products at their cheapest within the chosen window, checked against 90-day price history — not store-claimed discounts.</span>
                  </div>
                  <List items={lowestList} saved={saved} onSave={toggleSave} onOpen={setOpen} emptyMsg="Nothing is at a verified low in this window right now." />
                </>
              )}
              {section === "coupons" && (couponsList.length === 0 ? <Empty msg="No coupons match these filters." /> : <div style={{ display: "grid", gap: 12 }}>{couponsList.map((c, i) => <CouponCard key={c.id} c={c} i={i} copied={copied === c.id} onCopy={() => copyCode(c.id, c.code)} />)}</div>)}
              {section === "saved" && (savedList.length === 0 ? <Empty msg="Tap the heart on any deal to save it here." /> : (
                <>
                  <div className="fu flex items-center justify-between" style={{ background: "linear-gradient(135deg,#0E9D5A,#0a6e40)", borderRadius: 18, padding: "16px 18px", marginBottom: 16, boxShadow: "0 10px 30px rgba(14,157,90,.25)" }}>
                    <div><div style={{ fontSize: 12, color: "rgba(255,255,255,.85)" }}>If you grab all saved deals</div><Money value={savedTotal} style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: -0.6 }} /></div>
                    <span className="flex items-center" style={{ gap: 5, fontSize: 12, color: "#fff", fontWeight: 600, background: "rgba(255,255,255,.18)", padding: "6px 11px", borderRadius: 999 }}><Sparkles size={13} /> {savedList.length} saved</span>
                  </div>
                  <List items={savedList} saved={saved} onSave={toggleSave} onOpen={setOpen} emptyMsg="" />
                </>
              ))}
            </>
          )}
        </main>
      </div>

      {open && <Detail d={open} saved={saved.has(open.id)} onSave={() => toggleSave(open.id)} alerted={alerts.has(open.id)} onAlert={() => toggleAlert(open.id)} onClose={() => setOpen(null)} />}
      {filterOpen && <FilterSheet filters={filters} setFilters={setFilters} onClose={() => setFilterOpen(false)} forCoupons={section === "coupons"} />}

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30, background: "rgba(251,251,250,.94)", backdropFilter: "blur(14px)", borderTop: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 460, margin: "0 auto", display: "flex", justifyContent: "space-around", padding: "9px 0 11px" }}>
          {[{ id: "deals", icon: Flame, label: "Deals" }, { id: "lowest", icon: TrendingDown, label: "Lowest 90d" }, { id: "coupons", icon: Ticket, label: "Coupons" }, { id: "saved", icon: Heart, label: "Saved" }].map((t) => {
            const on = section === t.id; const Icon = t.icon;
            return <button key={t.id} onClick={() => go(t.id)} className="press" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: on ? INK : FAINT, position: "relative" }}>
              {on && <span style={{ position: "absolute", top: -9, width: 26, height: 3, borderRadius: 999, background: INK }} />}
              <Icon size={21} fill={on && t.id === "saved" ? INK : "none"} /><span style={{ fontSize: 10, fontWeight: on ? 600 : 500 }}>{t.label}</span>
            </button>;
          })}
        </div>
      </nav>
    </div>
  );
}

/* ---------- hero deal-of-the-day ---------- */
function Hero({ d, onOpen }) {
  return (
    <section className="fu" style={{ marginBottom: 20 }}>
      <div className="flex items-center" style={{ gap: 6, marginBottom: 10 }}>
        <Flame size={15} color={ACCENT} /><span style={{ fontSize: 12, fontWeight: 700, color: MUTED, letterSpacing: 0.4, textTransform: "uppercase" }}>Deal of the day</span>
      </div>
      <button onClick={onOpen} className="press" style={{ display: "block", width: "100%", textAlign: "left", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 24, padding: 18, boxShadow: CARD_SHADOW, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -30, width: 160, height: 140, background: "radial-gradient(circle, rgba(14,157,90,.1), transparent 70%)", pointerEvents: "none" }} />
        <div className="flex" style={{ gap: 14, position: "relative" }}>
          <div className="flex items-center justify-center" style={{ width: 76, height: 76, borderRadius: 18, background: d.color, fontSize: 36, flexShrink: 0 }}>{d.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, color: MUTED }}>{d.brand} · {d.platform}</div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3, marginTop: 2 }}>{d.name}</div>
            <div className="flex items-center" style={{ gap: 8, marginTop: 8 }}>
              <Money value={d.effective} style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.8 }} />
              <span style={{ fontSize: 13, color: FAINT, textDecoration: "line-through" }}>{inr(d.mrp)}</span>
            </div>
          </div>
          <ScoreRing score={d.score} size={56} />
        </div>
        <div className="flex items-center justify-between" style={{ marginTop: 14, position: "relative" }}>
          <span className="flex items-center" style={{ gap: 6, background: ACCENT_SOFT, color: ACCENT_INK, fontSize: 12.5, fontWeight: 700, padding: "7px 12px", borderRadius: 999 }}><Zap size={13} /> Save {inr(d.savings)} · {d.savingsPct}%</span>
          {d.bestWindow && <span className="flex items-center" style={{ gap: 5, fontSize: 12, fontWeight: 600, color: INK }}><BadgeCheck size={15} color={ACCENT} /> {lowLabel(d.bestWindow)}</span>}
        </div>
      </button>
    </section>
  );
}

/* ---------- skeletons ---------- */
function Skeletons() {
  return <div style={{ display: "grid", gap: 14 }}>{[0, 1, 2, 3].map((i) => (
    <div key={i} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 20, padding: 14 }}>
      <div className="flex" style={{ gap: 13 }}>
        <div className="skel" style={{ width: 60, height: 60, borderRadius: 14 }} />
        <div style={{ flex: 1 }}>
          <div className="skel" style={{ height: 10, width: "40%", borderRadius: 6 }} />
          <div className="skel" style={{ height: 13, width: "75%", borderRadius: 6, marginTop: 8 }} />
          <div className="skel" style={{ height: 16, width: "50%", borderRadius: 6, marginTop: 10 }} />
        </div>
      </div>
    </div>
  ))}</div>;
}

/* ---------- shared bits ---------- */
function Chip({ children, on, onClick }) { return <button onClick={onClick} className="press" style={{ whiteSpace: "nowrap", fontSize: 13, fontWeight: on ? 600 : 500, padding: "7px 13px", borderRadius: 999, border: `1px solid ${on ? INK : LINE}`, background: on ? INK : "#fff", color: on ? "#fff" : MUTED }}>{children}</button>; }
function Tagline({ children, soft, warn, icon }) { const c = warn ? { fg: WARN_INK, bg: WARN_SOFT } : soft ? { fg: ACCENT_INK, bg: ACCENT_SOFT } : { fg: MUTED, bg: "#F4F4F5" }; return <span className="flex items-center" style={{ gap: 5, fontSize: 11.5, fontWeight: 600, color: c.fg, background: c.bg, padding: "5px 9px", borderRadius: 999 }}>{icon}{children}</span>; }
function Empty({ msg }) { return <div className="fu" style={{ textAlign: "center", padding: "60px 20px" }}><div style={{ fontSize: 14, color: MUTED }}>{msg}</div></div>; }
function List({ items, saved, onSave, onOpen, emptyMsg }) { if (items.length === 0) return <Empty msg={emptyMsg} />; return <div style={{ display: "grid", gap: 14 }}>{items.map((d, i) => <DealCard key={d.id} d={d} i={i} saved={saved.has(d.id)} onSave={() => onSave(d.id)} onOpen={() => onOpen(d)} />)}</div>; }
function lowLabel(w) { return w === 90 ? "Lowest in 90 days" : w === 60 ? "Lowest in 60 days" : w === 30 ? "Lowest in 30 days" : null; }

function DealCard({ d, i, saved, onSave, onOpen }) {
  return (
    <div className="fu press" style={{ animationDelay: `${Math.min(i, 8) * 40}ms`, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 20, padding: 14, boxShadow: CARD_SHADOW, cursor: "pointer" }} onClick={onOpen}>
      <div className="flex" style={{ gap: 13 }}>
        <div className="flex items-center justify-center" style={{ width: 60, height: 60, borderRadius: 14, background: d.color, fontSize: 28, flexShrink: 0 }}>{d.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-start justify-between" style={{ gap: 8 }}>
            <div style={{ minWidth: 0 }}><div style={{ fontSize: 11, color: MUTED }}>{d.brand} · {d.platform}</div><div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div></div>
            <button className="press" onClick={(e) => { e.stopPropagation(); onSave(); }} style={{ flexShrink: 0, marginTop: 1 }}><Heart size={18} color={saved ? "#E0245E" : FAINT} fill={saved ? "#E0245E" : "none"} className={saved ? "pop" : ""} /></button>
          </div>
          <div className="flex items-center" style={{ gap: 8, marginTop: 7 }}>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>{inr(d.effective)}</span>
            <span style={{ fontSize: 12.5, color: FAINT, textDecoration: "line-through" }}>{inr(d.mrp)}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>{d.savingsPct}% off</span>
          </div>
        </div>
      </div>
      <div className="flex items-center" style={{ gap: 7, marginTop: 12, flexWrap: "wrap" }}>
        {d.bestWindow ? <Tagline soft icon={<BadgeCheck size={12} />}>{lowLabel(d.bestWindow)}</Tagline> : d.inflatedMrp ? <Tagline warn icon={<ShieldCheck size={12} />}>Real saving {d.honestPct}%</Tagline> : <Tagline>Deal score {d.score}</Tagline>}
        {d.cashbackPct >= 5 && <Tagline>{d.cashbackPct}% cashback</Tagline>}
        {d.coupon && <Tagline icon={<Tag size={11} />}>Coupon inside</Tagline>}
      </div>
    </div>
  );
}

function CouponCard({ c, i, copied, onCopy }) {
  return (
    <div className="fu" style={{ animationDelay: `${Math.min(i, 8) * 40}ms`, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 18, padding: 14, boxShadow: CARD_SHADOW }}>
      <div className="flex items-center" style={{ gap: 12 }}>
        <div className="flex items-center justify-center" style={{ width: 46, height: 46, borderRadius: 12, background: c.color, fontSize: 18, fontWeight: 700, color: INK, flexShrink: 0 }}>{c.letter.toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: MUTED }}>{c.store}</div>
          <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2 }}>{c.title}</div>
          <div className="flex items-center" style={{ gap: 10, marginTop: 5 }}><span className="flex items-center" style={{ gap: 4, fontSize: 11, fontWeight: 600, color: ACCENT_INK }}><BadgeCheck size={13} color={ACCENT} /> Verified {c.verifiedHrs}h ago</span><span style={{ fontSize: 11, color: MUTED }}>{c.success}% worked</span></div>
        </div>
      </div>
      <button onClick={onCopy} className="press flex items-center justify-between" style={{ width: "100%", marginTop: 12, border: `1.5px dashed ${ACCENT}`, background: ACCENT_SOFT, borderRadius: 12, padding: "10px 13px" }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: ACCENT_INK, letterSpacing: 0.5 }}>{c.code}</span>
        <span className="flex items-center" style={{ gap: 5, fontSize: 12.5, fontWeight: 600, color: ACCENT_INK }}>{copied ? <span className="pop flex items-center" style={{ gap: 5 }}><Check size={14} /> Copied</span> : <><Copy size={14} /> Copy</>}</span>
      </button>
      <div className="flex items-center justify-between" style={{ marginTop: 9 }}><span style={{ fontSize: 11.5, color: MUTED }}>Min order {inr(c.min)}</span><span className="flex items-center" style={{ gap: 4, fontSize: 11.5, color: c.expiresDays <= 2 ? "#B25C00" : MUTED }}><Clock size={12} /> {c.expiresDays === 1 ? "Ends today" : `${c.expiresDays} days left`}</span></div>
    </div>
  );
}

function FilterSheet({ filters, setFilters, onClose, forCoupons }) {
  const [local, setLocal] = useState({ stores: new Set(filters.stores), minDisc: filters.minDisc, band: filters.band });
  const toggleStore = (s) => setLocal((l) => { const n = new Set(l.stores); n.has(s) ? n.delete(s) : n.add(s); return { ...l, stores: n }; });
  const apply = () => { setFilters({ stores: local.stores, minDisc: local.minDisc, band: local.band }); onClose(); };
  const reset = () => setLocal({ stores: new Set(), minDisc: 0, band: null });
  return (
    <Sheet onClose={onClose} title="Filters">
      <Group label="Store"><div className="flex" style={{ gap: 8, flexWrap: "wrap" }}>{STORES.map((s) => <Chip key={s} on={local.stores.has(s)} onClick={() => toggleStore(s)}>{s}</Chip>)}</div></Group>
      {!forCoupons && (<>
        <Group label="Minimum discount"><div className="flex" style={{ gap: 8, flexWrap: "wrap" }}><Chip on={local.minDisc === 0} onClick={() => setLocal((l) => ({ ...l, minDisc: 0 }))}>Any</Chip>{DISC_STEPS.map((p) => <Chip key={p} on={local.minDisc === p} onClick={() => setLocal((l) => ({ ...l, minDisc: p }))}>{p}%+</Chip>)}</div></Group>
        <Group label="Price range"><div className="flex" style={{ gap: 8, flexWrap: "wrap" }}><Chip on={!local.band} onClick={() => setLocal((l) => ({ ...l, band: null }))}>Any</Chip>{PRICE_BANDS.map((b) => <Chip key={b.id} on={local.band === b.id} onClick={() => setLocal((l) => ({ ...l, band: b.id }))}>{b.label}</Chip>)}</div></Group>
      </>)}
      <div className="flex" style={{ gap: 10, marginTop: 22 }}>
        <button onClick={reset} className="press" style={{ flex: 1, padding: 14, borderRadius: 14, border: `1px solid ${LINE}`, background: "#fff", fontSize: 14.5, fontWeight: 600, color: INK }}>Reset</button>
        <button onClick={apply} className="press" style={{ flex: 2, padding: 14, borderRadius: 14, border: "none", background: INK, color: "#fff", fontSize: 14.5, fontWeight: 600 }}>Show results</button>
      </div>
    </Sheet>
  );
}
function Group({ label, children }) { return <div style={{ marginTop: 18 }}><div style={{ fontSize: 12.5, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 11 }}>{label}</div>{children}</div>; }

function Sheet({ children, onClose, title }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(17,17,20,.42)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} className="noscroll" style={{ animation: "sheetUp .42s cubic-bezier(.16,1,.3,1) both", width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto", background: "#FBFBFA", borderRadius: "26px 26px 0 0" }}>
        <div style={{ position: "sticky", top: 0, background: "#FBFBFA", padding: "12px 0 8px", display: "flex", justifyContent: "center", zIndex: 2 }}>
          <div style={{ width: 38, height: 5, borderRadius: 999, background: "#D8D8DC" }} />
          <button onClick={onClose} className="press" style={{ position: "absolute", right: 16, top: 11, width: 32, height: 32, borderRadius: 999, background: "#EEEEF0", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={17} color={MUTED} /></button>
        </div>
        <div style={{ padding: "4px 20px 28px" }}>{title && <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3, marginBottom: 4 }}>{title}</div>}{children}</div>
      </div>
    </div>
  );
}

function Detail({ d, saved, onSave, alerted, onAlert, onClose }) {
  const [copied, setCopied] = useState(false);
  const rows = [
    { label: "List price (MRP)", val: d.mrp, strike: true },
    ...(d.price < d.mrp ? [{ label: `${d.platform} price`, val: -(d.mrp - d.price), neg: true }] : []),
    ...(d.couponOff ? [{ label: `Coupon ${d.coupon.code}`, val: -d.couponOff, neg: true }] : []),
    ...(d.bankOff ? [{ label: `${d.bank.name} offer`, val: -d.bankOff, neg: true }] : []),
  ];
  return (
    <Sheet onClose={onClose}>
      <div className="flex items-center" style={{ gap: 14 }}>
        <div className="flex items-center justify-center" style={{ width: 70, height: 70, borderRadius: 16, background: d.color, fontSize: 34, flexShrink: 0 }}>{d.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, color: MUTED }}>{d.brand} · {d.platform}</div><div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3, marginTop: 2 }}>{d.name}</div></div>
        <ScoreRing score={d.score} size={52} />
      </div>

      <div className="flex" style={{ gap: 8, marginTop: 14 }}>
        <button onClick={onSave} className="press flex items-center justify-center" style={{ flex: 1, gap: 7, padding: "11px", borderRadius: 13, border: `1px solid ${saved ? "#E0245E" : LINE}`, background: saved ? "#FDEAF0" : "#fff", fontSize: 13.5, fontWeight: 600, color: saved ? "#E0245E" : INK }}><Heart size={16} fill={saved ? "#E0245E" : "none"} color={saved ? "#E0245E" : INK} /> {saved ? "Saved" : "Save"}</button>
        <button onClick={onAlert} className="press flex items-center justify-center" style={{ flex: 1, gap: 7, padding: "11px", borderRadius: 13, border: `1px solid ${alerted ? ACCENT : LINE}`, background: alerted ? ACCENT_SOFT : "#fff", fontSize: 13.5, fontWeight: 600, color: alerted ? ACCENT_INK : INK }}><Bell size={16} className={alerted ? "pop" : ""} fill={alerted ? ACCENT : "none"} color={alerted ? ACCENT : INK} /> {alerted ? "Alerting" : "Price alert"}</button>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 20, padding: 18, marginTop: 14, boxShadow: CARD_SHADOW }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 14 }}>True price breakdown</div>
        {rows.map((r, i) => (
          <div key={i} className="row-cascade flex items-center justify-between" style={{ padding: "7px 0", animationDelay: `${i * 70}ms` }}>
            <span style={{ fontSize: 14, color: r.neg ? INK : MUTED }}>{r.label}</span>
            <span style={{ fontSize: 14.5, fontWeight: r.neg ? 600 : 500, color: r.neg ? ACCENT : FAINT, textDecoration: r.strike ? "line-through" : "none" }}>{r.neg ? "− " + inr(Math.abs(r.val)) : inr(r.val)}</span>
          </div>
        ))}
        <div style={{ borderTop: `1px solid ${LINE}`, margin: "10px 0" }} />
        <div className="flex items-center justify-between"><span style={{ fontSize: 14, fontWeight: 600 }}>You pay now</span><span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.4 }}>{inr(d.payNow)}</span></div>
        {d.cashback > 0 && <div className="flex items-center justify-between" style={{ marginTop: 8 }}><span style={{ fontSize: 13.5, color: MUTED }}>Cashback back to you ({d.cashbackPct}%)</span><span style={{ fontSize: 14, fontWeight: 600, color: ACCENT }}>− {inr(d.cashback)}</span></div>}
        <div style={{ background: ACCENT_SOFT, borderRadius: 14, padding: "13px 15px", marginTop: 14 }}>
          <div className="flex items-center justify-between"><span style={{ fontSize: 13.5, fontWeight: 600, color: ACCENT_INK }}>Effective cost</span><Money value={d.effective} style={{ fontSize: 25, fontWeight: 800, letterSpacing: -0.8, color: ACCENT_INK }} /></div>
          <div style={{ fontSize: 12.5, color: ACCENT_INK, marginTop: 3 }}>You save {inr(d.savings)} — that's {d.savingsPct}% off MRP</div>
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 20, padding: 18, marginTop: 14, boxShadow: CARD_SHADOW }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: 0.3 }}>Is this genuine?</span>
          {d.bestWindow ? <span className="flex items-center" style={{ gap: 5, fontSize: 12.5, fontWeight: 600, color: ACCENT }}><BadgeCheck size={15} /> {lowLabel(d.bestWindow)}</span> : <span style={{ fontSize: 12.5, fontWeight: 600, color: MUTED }}>Above its 30-day low</span>}
        </div>
        <div style={{ height: 70, margin: "6px -6px 0" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={d.history} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
              <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACCENT} stopOpacity={0.22} /><stop offset="100%" stopColor={ACCENT} stopOpacity={0} /></linearGradient></defs>
              <YAxis domain={["dataMin - 800", "dataMax + 800"]} hide />
              <Area type="monotone" dataKey="p" stroke={ACCENT} strokeWidth={2} fill="url(#g)" dot={false} isAnimationActive />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-between" style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}><span>90-day low {inr(d.low90)}</span><span>Now {inr(d.price)}</span></div>
        {d.inflatedMrp && <div className="flex" style={{ gap: 8, marginTop: 12, background: WARN_SOFT, borderRadius: 12, padding: "10px 12px" }}><ShieldCheck size={16} color="#B25C00" style={{ flexShrink: 0, marginTop: 1 }} /><span style={{ fontSize: 12.5, color: WARN_INK, lineHeight: 1.4 }}>The store shows {Math.round(((d.mrp - d.price) / d.mrp) * 100)}% off, but this usually sells near {inr(d.inflatedMrp)}. Your real saving is about {d.honestPct}%.</span></div>}
      </div>

      {d.coupon && (
        <button onClick={() => { navigator.clipboard?.writeText(d.coupon.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="press flex items-center justify-between" style={{ width: "100%", marginTop: 14, border: `1.5px dashed ${ACCENT}`, background: ACCENT_SOFT, borderRadius: 14, padding: "13px 16px" }}>
          <span className="flex items-center" style={{ gap: 8, fontSize: 14, fontWeight: 700, color: ACCENT_INK, letterSpacing: 0.5 }}><Tag size={15} />{d.coupon.code}</span>
          <span className="flex items-center" style={{ gap: 5, fontSize: 13, fontWeight: 600, color: ACCENT_INK }}>{copied ? <span className="pop flex items-center" style={{ gap: 5 }}><Check size={14} /> Copied</span> : <><Copy size={14} /> Copy</>}</span>
        </button>
      )}
      <button className="press" style={{ width: "100%", marginTop: 14, background: INK, color: "#fff", border: "none", borderRadius: 16, padding: 16, fontSize: 15.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>Grab deal on {d.platform} <ChevronRight size={18} /></button>
      <div style={{ textAlign: "center", fontSize: 11.5, color: FAINT, marginTop: 10 }}>Price tracked over 90 days · Updated 2h ago</div>
    </Sheet>
  );
}
