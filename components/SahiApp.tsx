"use client";
import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Search, X, Heart, Tag, BadgeCheck, ShieldCheck, ChevronRight, Copy, Check,
  SlidersHorizontal, Flame, TrendingDown, Ticket, Clock, Bell, Sparkles, Zap, User,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";
import PriceChart from "./PriceChart";
import type { Deal, Coupon, SeriesPoint } from "@/lib/types";
import { inr, checkedAgo, historyNote, lowLabel } from "@/lib/format";

/* ================================================================
   SAHI — "is this actually a good price?"
================================================================ */
const INK = "#111114", MUTED = "#6E6E73", FAINT = "#A1A1A6", LINE = "#ECECEE";
const ACCENT = "#0E9D5A", ACCENT_SOFT = "#E7F6EE", ACCENT_INK = "#0a6e40";
const WARN_INK = "#8a4a00", WARN_SOFT = "#FBF1E3";
const SHADOW = "0 1px 2px rgba(17,17,20,.04), 0 10px 30px rgba(17,17,20,.05)";
const scoreColor = (s: number) => s >= 70 ? ACCENT : s >= 40 ? "#C98A1E" : "#B25C00";

/* ---- store & category metadata ---- */
const STORE_META: Record<string, { name: string; letter: string; color: string }> = {
  amazon:      { name: "Amazon",           letter: "a", color: "#FFEBD6" },
  flipkart:    { name: "Flipkart",          letter: "F", color: "#DCEBFB" },
  myntra:      { name: "Myntra",            letter: "M", color: "#FBE2EC" },
  ajio:        { name: "Ajio",              letter: "A", color: "#E7E7F2" },
  nykaa:       { name: "Nykaa",             letter: "N", color: "#FBE0E8" },
  swiggy:      { name: "Swiggy Instamart",  letter: "S", color: "#FDE7D6" },
  zomato:      { name: "Zomato",            letter: "Z", color: "#FBE0E0" },
  bigbasket:   { name: "BigBasket",         letter: "B", color: "#E2F3E2" },
  boat:        { name: "boAt",              letter: "b", color: "#E9E9EE" },
  mamaearth:   { name: "Mamaearth",         letter: "m", color: "#FBF4E2" },
  makemytrip:  { name: "MakeMyTrip",        letter: "M", color: "#DCE9FB" },
  tatacliq:    { name: "Tata CliQ",         letter: "T", color: "#E7E7F2" },
};
const CAT_META: Record<string, { icon: string; color: string }> = {
  Mobiles:     { icon: "📱", color: "#F2F2F7" },
  Electronics: { icon: "💻", color: "#EAEFF7" },
  Audio:       { icon: "🎧", color: "#EFEAFB" },
  Fashion:     { icon: "👗", color: "#F1F1F1" },
  Beauty:      { icon: "🧴", color: "#FBF3E6" },
  Home:        { icon: "🍳", color: "#FBEAF1" },
  Appliances:  { icon: "❄️", color: "#EAF4FB" },
  Kids:        { icon: "🧸", color: "#EAF6FB" },
};
const sm = (id: string) => STORE_META[id] ?? { name: id, letter: (id[0] ?? "?").toUpperCase(), color: "#F4F4F5" };
const cm = (cat: string) => CAT_META[cat] ?? { icon: "🛍️", color: "#F4F4F5" };

/* ---- filter constants ---- */
const DEAL_CATS   = ["All","Electronics","Mobiles","Fashion","Beauty","Kids","Home","Appliances","Audio"];
const COUPON_CATS = ["All","Electronics","Fashion","Beauty","Grocery","Food","Kids","Travel","Home"];
const STORES      = ["Amazon","Flipkart","Myntra","Ajio","Nykaa"];
const PRICE_BANDS = [
  { id:"a", label:"Under ₹1,000", lo:0,    hi:1000 },
  { id:"b", label:"₹1k – ₹5k",   lo:1000, hi:5000 },
  { id:"c", label:"₹5k – ₹20k",  lo:5000, hi:20000 },
  { id:"d", label:"Over ₹20k",    lo:20000,hi:Infinity },
];
const DISC_STEPS = [10, 30, 50, 70];

/* ---- types ---- */
type ApiDeal = Deal & { id?: number };
type NormCoupon = {
  id: string; store_id: string; store: string; letter: string; color: string;
  category: string; code: string; title: string; min_order: number;
  success_rate: number | null; verified_hrs: number | null; expires_days: number | null;
};
type Filters = { stores: Set<string>; minDisc: number; band: string | null };

/* ---- supabase browser singleton ---- */
let _sb: ReturnType<typeof createClient> | null = null;
function sbClient() {
  if (_sb) return _sb;
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  _sb = createClient(url, anon);
  return _sb;
}

/* ---- helpers ---- */
function normCoupon(c: Coupon): NormCoupon {
  const s = sm(c.store_id);
  return {
    id: c.external_id, store_id: c.store_id, store: c.store ?? s.name,
    letter: s.letter, color: s.color, category: c.category, code: c.code, title: c.title,
    min_order: c.min_order ?? 0,
    success_rate: c.success_rate ?? null,
    verified_hrs: c.verified_at ? Math.max(0, Math.round((Date.now() - Date.parse(c.verified_at)) / 36e5)) : null,
    expires_days: c.expires_at ? Math.max(0, Math.ceil((Date.parse(c.expires_at) - Date.now()) / 864e5)) : null,
  };
}

const belowTypical = (d: ApiDeal) =>
  d.typical_price !== null && d.vs_typical_pct !== null && d.vs_typical_pct < 0 ? d.typical_price - d.price : 0;

/** Nulls sort last whichever direction the key goes. */
const byNullable = (a: number | null, b: number | null) => (a === null ? 1 : 0) - (b === null ? 1 : 0) || (a ?? 0) - (b ?? 0);

/* ================================================================
   Hooks
================================================================ */

function useCountUp(target: number, dur = 700) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const reduce = typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    if (reduce) { setV(target); from.current = target; return; }
    let raf: number, start: number | undefined;
    const a = from.current, b = target;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setV(a + (b - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return v;
}

function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sb = sbClient();
    if (!sb) { setReady(true); return; }
    sb.auth.getSession().then(({ data: { session } }) => { setSession(session); setReady(true); });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);
  return { session, user: session?.user ?? null, ready };
}

/* ================================================================
   Primitive components
================================================================ */

function Money({ value, style }: { value: number; style?: React.CSSProperties }) {
  const v = useCountUp(value);
  return <span style={style}>{inr(v)}</span>;
}

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r;
  const v = useCountUp(score, 900);
  const col = scoreColor(score);
  return (
    <div role="img" aria-label={`Sahi score ${score} out of 100`} style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} stroke="#EEEEF0" strokeWidth="4" fill="none"/>
        <circle cx={size/2} cy={size/2} r={r} stroke={col} strokeWidth="4" fill="none"
          strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c - (c * v) / 100}
          style={{ transition:"stroke-dashoffset .1s linear" }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:size*.3, fontWeight:800, letterSpacing:-0.5, color:col, lineHeight:1 }}>{Math.round(v)}</span>
        <span style={{ fontSize:7.5, fontWeight:600, color:MUTED, letterSpacing:0.5, marginTop:1 }}>SCORE</span>
      </div>
    </div>
  );
}

function Chip({ children, on, onClick }: { children: React.ReactNode; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="press" style={{ whiteSpace:"nowrap", fontSize:13, fontWeight:on?600:500, padding:"7px 13px", borderRadius:999, border:`1px solid ${on?INK:LINE}`, background:on?INK:"#fff", color:on?"#fff":MUTED, cursor:"pointer" }}>
      {children}
    </button>
  );
}

function Tagline({ children, soft, warn, icon }: { children: React.ReactNode; soft?: boolean; warn?: boolean; icon?: React.ReactNode }) {
  const col = warn ? { fg:WARN_INK, bg:WARN_SOFT } : soft ? { fg:ACCENT_INK, bg:ACCENT_SOFT } : { fg:MUTED, bg:"#F4F4F5" };
  return (
    <span className="flex items-center" style={{ gap:5, fontSize:11.5, fontWeight:600, color:col.fg, background:col.bg, padding:"5px 9px", borderRadius:999 }}>
      {icon}{children}
    </span>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="fu" style={{ textAlign:"center", padding:"60px 20px" }}>
      <div style={{ fontSize:14, color:MUTED }}>{msg}</div>
    </div>
  );
}

function Skeletons() {
  return (
    <div style={{ display:"grid", gap:14 }}>
      {[0,1,2,3].map((i) => (
        <div key={i} style={{ background:"#fff", border:`1px solid ${LINE}`, borderRadius:20, padding:14 }}>
          <div className="flex" style={{ gap:13 }}>
            <div className="skel" style={{ width:60, height:60, borderRadius:14 }}/>
            <div style={{ flex:1 }}>
              <div className="skel" style={{ height:10, width:"40%", borderRadius:6 }}/>
              <div className="skel" style={{ height:13, width:"75%", borderRadius:6, marginTop:8 }}/>
              <div className="skel" style={{ height:16, width:"50%", borderRadius:6, marginTop:10 }}/>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Sheet({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title?: string }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:50, background:"rgba(17,17,20,.42)", backdropFilter:"blur(3px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div onClick={(e) => e.stopPropagation()} className="noscroll" style={{ animation:"sheetUp .42s cubic-bezier(.16,1,.3,1) both", width:"100%", maxWidth:460, maxHeight:"92vh", overflowY:"auto", background:"#FBFBFA", borderRadius:"26px 26px 0 0" }}>
        <div style={{ position:"sticky", top:0, background:"#FBFBFA", padding:"12px 0 8px", display:"flex", justifyContent:"center", zIndex:2 }}>
          <div style={{ width:38, height:5, borderRadius:999, background:"#D8D8DC" }}/>
          <button onClick={onClose} className="press" style={{ position:"absolute", right:16, top:11, width:32, height:32, borderRadius:999, background:"#EEEEF0", display:"flex", alignItems:"center", justifyContent:"center", border:"none", cursor:"pointer" }}>
            <X size={17} color={MUTED}/>
          </button>
        </div>
        <div style={{ padding:"4px 20px 28px" }}>
          {title && <div style={{ fontSize:19, fontWeight:700, letterSpacing:-0.3, marginBottom:4 }}>{title}</div>}
          {children}
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop:18 }}>
      <div style={{ fontSize:12.5, fontWeight:600, color:MUTED, textTransform:"uppercase", letterSpacing:0.3, marginBottom:11 }}>{label}</div>
      {children}
    </div>
  );
}

/* ================================================================
   Product icon
================================================================ */

function ProductIcon({ d, size }: { d: ApiDeal; size: number }) {
  const { icon, color } = cm(d.category);
  const radius = size > 70 ? 18 : 14;
  return (
    <div style={{ width:size, height:size, borderRadius:radius, background:color, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, overflow:"hidden" }}>
      {d.image_url
        ? <img src={d.image_url} alt={d.name} width={size} height={size} style={{ objectFit:"cover" }}/>
        : <span style={{ fontSize:size*.45 }}>{icon}</span>}
    </div>
  );
}

/* ================================================================
   Hero — deal of the day
================================================================ */

function Hero({ d, onOpen }: { d: ApiDeal; onOpen: () => void }) {
  const below = belowTypical(d);
  return (
    <section className="fu" style={{ marginBottom:20 }}>
      <div className="flex items-center" style={{ gap:6, marginBottom:10 }}>
        <Flame size={15} color={ACCENT}/>
        <span style={{ fontSize:12, fontWeight:700, color:MUTED, letterSpacing:0.4, textTransform:"uppercase" }}>Strongest price signal now</span>
      </div>
      <button onClick={onOpen} className="press" style={{ display:"block", width:"100%", textAlign:"left", background:"#fff", border:`1px solid ${LINE}`, borderRadius:24, padding:18, boxShadow:SHADOW, position:"relative", overflow:"hidden", cursor:"pointer" }}>
        <div style={{ position:"absolute", top:-40, right:-30, width:160, height:140, background:"radial-gradient(circle, rgba(14,157,90,.1), transparent 70%)", pointerEvents:"none" }}/>
        <div className="flex" style={{ gap:14, position:"relative" }}>
          <ProductIcon d={d} size={76}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11.5, color:MUTED }}>{d.brand} · {sm(d.store_id).name}</div>
            <div style={{ fontSize:16, fontWeight:700, letterSpacing:-0.3, marginTop:2 }}>{d.name}</div>
            <div className="flex items-center" style={{ gap:8, marginTop:8 }}>
              <Money value={d.effective} style={{ fontSize:24, fontWeight:800, letterSpacing:-0.8 }}/>
              <span style={{ fontSize:13, color:FAINT, textDecoration:"line-through" }}>{inr(d.mrp)}</span>
            </div>
          </div>
          {d.score !== null && <ScoreRing score={d.score} size={56}/>}
        </div>
        <div className="flex items-center justify-between" style={{ marginTop:14, position:"relative", gap:8, flexWrap:"wrap" }}>
          {below > 0 && (
            <span className="flex items-center" style={{ gap:6, background:ACCENT_SOFT, color:ACCENT_INK, fontSize:12.5, fontWeight:700, padding:"7px 12px", borderRadius:999 }}>
              <Zap size={13}/> {inr(below)} below typical
            </span>
          )}
          {d.low_window_days !== null && (
            <span className="flex items-center" style={{ gap:5, fontSize:12, fontWeight:600, color:INK }}>
              <BadgeCheck size={15} color={ACCENT}/> {lowLabel(d.low_window_days)}
            </span>
          )}
        </div>
      </button>
    </section>
  );
}

/* ================================================================
   Deal card
================================================================ */

function DealCard({ d, i, saved, onSave, onOpen }: { d: ApiDeal; i: number; saved: boolean; onSave: () => void; onOpen: () => void }) {
  return (
    <div
      className="fu press"
      style={{ animationDelay:`${Math.min(i,8)*40}ms`, background:"#fff", border:`1px solid ${LINE}`, borderRadius:20, padding:14, boxShadow:SHADOW, cursor:"pointer" }}
      onClick={onOpen}
    >
      <div className="flex" style={{ gap:13 }}>
        <ProductIcon d={d} size={60}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div className="flex items-start justify-between" style={{ gap:8 }}>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:11, color:MUTED }}>{d.brand} · {sm(d.store_id).name}</div>
              <div style={{ fontSize:14.5, fontWeight:600, letterSpacing:-0.2, marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.name}</div>
            </div>
            <button className="press" onClick={(e)=>{ e.stopPropagation(); onSave(); }} style={{ flexShrink:0, marginTop:1, background:"none", border:"none", cursor:"pointer" }}>
              <Heart size={18} color={saved?"#E0245E":FAINT} fill={saved?"#E0245E":"none"} className={saved?"pop":""}/>
            </button>
          </div>
          <div className="flex items-center" style={{ gap:8, marginTop:7, flexWrap:"wrap" }}>
            <span style={{ fontSize:18, fontWeight:700, letterSpacing:-0.5 }}>{inr(d.effective)}</span>
            {d.mrp_off_pct > 0 && <span style={{ fontSize:12, color:FAINT }}>MRP <s>{inr(d.mrp)}</s> · {d.mrp_off_pct}% off</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center" style={{ gap:7, marginTop:12, flexWrap:"wrap" }}>
        {d.low_window_days !== null && <Tagline soft icon={<BadgeCheck size={12}/>}>{lowLabel(d.low_window_days)}</Tagline>}
        {belowTypical(d) > 0 && <Tagline soft>{inr(belowTypical(d))} below typical</Tagline>}
        {d.mrp_misleading && <Tagline warn icon={<ShieldCheck size={12}/>}>MRP overstated</Tagline>}
        {d.score === null && !d.sample && <Tagline icon={<Clock size={11}/>}>{d.tracked_days < 1 ? "New to Sahi" : `Tracked ${d.tracked_days}d`}</Tagline>}
        {d.coupon_code && d.effective < d.price && <Tagline icon={<Tag size={11}/>}>Coupon price</Tagline>}
      </div>
    </div>
  );
}

function DealList({ items, saved, onSave, onOpen, emptyMsg }: { items: ApiDeal[]; saved: Set<string>; onSave: (id: string) => void; onOpen: (d: ApiDeal) => void; emptyMsg: string }) {
  if (!items.length) return <Empty msg={emptyMsg}/>;
  return (
    <div style={{ display:"grid", gap:14 }}>
      {items.map((d, i) => (
        <DealCard key={d.external_id} d={d} i={i} saved={saved.has(d.external_id)} onSave={()=>onSave(d.external_id)} onOpen={()=>onOpen(d)}/>
      ))}
    </div>
  );
}

/* ================================================================
   Coupon card
================================================================ */

function CouponCard({ c, i, copied, onCopy }: { c: NormCoupon; i: number; copied: boolean; onCopy: () => void }) {
  return (
    <div className="fu" style={{ animationDelay:`${Math.min(i,8)*40}ms`, background:"#fff", border:`1px solid ${LINE}`, borderRadius:18, padding:14, boxShadow:SHADOW }}>
      <div className="flex items-center" style={{ gap:12 }}>
        <div style={{ width:46, height:46, borderRadius:12, background:c.color, fontSize:18, fontWeight:700, color:INK, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {c.letter.toUpperCase()}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:11, color:MUTED }}>{c.store}</div>
          <div style={{ fontSize:14.5, fontWeight:600, letterSpacing:-0.2 }}>{c.title}</div>
          <div className="flex items-center" style={{ gap:10, marginTop:5 }}>
            {c.verified_hrs !== null
              ? <span className="flex items-center" style={{ gap:4, fontSize:11, fontWeight:600, color:ACCENT_INK }}>
                  <BadgeCheck size={13} color={ACCENT}/> Tested {c.verified_hrs}h ago
                </span>
              : <span style={{ fontSize:11, color:MUTED }}>Listed by the store, not yet tested by Sahi</span>}
            {c.success_rate !== null && <span style={{ fontSize:11, color:MUTED }}>{c.success_rate}% of reports worked</span>}
          </div>
        </div>
      </div>
      <button onClick={onCopy} className="press flex items-center justify-between" style={{ width:"100%", marginTop:12, border:`1.5px dashed ${ACCENT}`, background:ACCENT_SOFT, borderRadius:12, padding:"10px 13px", cursor:"pointer" }}>
        <span style={{ fontSize:13.5, fontWeight:700, color:ACCENT_INK, letterSpacing:0.5 }}>{c.code}</span>
        <span className="flex items-center" style={{ gap:5, fontSize:12.5, fontWeight:600, color:ACCENT_INK }}>
          {copied ? <span className="pop flex items-center" style={{ gap:5 }}><Check size={14}/> Copied</span> : <><Copy size={14}/> Copy</>}
        </span>
      </button>
      <div className="flex items-center justify-between" style={{ marginTop:9 }}>
        <span style={{ fontSize:11.5, color:MUTED }}>Min order {inr(c.min_order)}</span>
        <span className="flex items-center" style={{ gap:4, fontSize:11.5, color:c.expires_days!==null&&c.expires_days<=2?"#B25C00":MUTED }}>
          <Clock size={12}/> {c.expires_days===null ? "No end date listed" : c.expires_days<=1 ? "Ends within a day" : `${c.expires_days} days left`}
        </span>
      </div>
    </div>
  );
}

/* ================================================================
   Filter sheet
================================================================ */

function FilterSheet({ filters, setFilters, onClose, forCoupons }: { filters: Filters; setFilters: (f: Filters) => void; onClose: () => void; forCoupons: boolean }) {
  const [local, setLocal] = useState<Filters>({ stores:new Set(filters.stores), minDisc:filters.minDisc, band:filters.band });
  const toggleStore = (s: string) => setLocal((l)=>{ const n=new Set(l.stores); n.has(s)?n.delete(s):n.add(s); return {...l,stores:n}; });
  const apply = () => { setFilters({ stores:local.stores, minDisc:local.minDisc, band:local.band }); onClose(); };
  const reset = () => setLocal({ stores:new Set(), minDisc:0, band:null });
  return (
    <Sheet onClose={onClose} title="Filters">
      <Group label="Store">
        <div className="flex" style={{ gap:8, flexWrap:"wrap" }}>
          {STORES.map((s)=><Chip key={s} on={local.stores.has(s)} onClick={()=>toggleStore(s)}>{s}</Chip>)}
        </div>
      </Group>
      {!forCoupons && (
        <>
          <Group label="Minimum discount">
            <div className="flex" style={{ gap:8, flexWrap:"wrap" }}>
              <Chip on={local.minDisc===0} onClick={()=>setLocal((l)=>({...l,minDisc:0}))}>Any</Chip>
              {DISC_STEPS.map((p)=><Chip key={p} on={local.minDisc===p} onClick={()=>setLocal((l)=>({...l,minDisc:p}))}>{p}%+</Chip>)}
            </div>
          </Group>
          <Group label="Price range">
            <div className="flex" style={{ gap:8, flexWrap:"wrap" }}>
              <Chip on={!local.band} onClick={()=>setLocal((l)=>({...l,band:null}))}>Any</Chip>
              {PRICE_BANDS.map((b)=><Chip key={b.id} on={local.band===b.id} onClick={()=>setLocal((l)=>({...l,band:b.id}))}>{b.label}</Chip>)}
            </div>
          </Group>
        </>
      )}
      <div className="flex" style={{ gap:10, marginTop:22 }}>
        <button onClick={reset} className="press" style={{ flex:1, padding:14, borderRadius:14, border:`1px solid ${LINE}`, background:"#fff", fontSize:14.5, fontWeight:600, color:INK, cursor:"pointer" }}>Reset</button>
        <button onClick={apply} className="press" style={{ flex:2, padding:14, borderRadius:14, border:"none", background:INK, color:"#fff", fontSize:14.5, fontWeight:600, cursor:"pointer" }}>Show results</button>
      </div>
    </Sheet>
  );
}

/* ================================================================
   Detail sheet
================================================================ */

function Row({ label, value, strong, accent, muted }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; accent?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between" style={{ padding:"6px 0", gap:12 }}>
      <span style={{ fontSize:14, color:muted?MUTED:INK, fontWeight:strong?600:400 }}>{label}</span>
      <span style={{ fontSize:strong?16:14.5, fontWeight:strong?700:600, color:accent?ACCENT:muted?FAINT:INK, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>{value}</span>
    </div>
  );
}

function Detail({ d, saved, onSave, alerted, onAlert, onClose }: { d: ApiDeal; saved: boolean; onSave: ()=>void; alerted: boolean; onAlert: ()=>void; onClose: ()=>void }) {
  const [copied, setCopied] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [series, setSeries] = useState<SeriesPoint[] | null>(null);

  useEffect(()=>{
    let alive = true;
    setSeries(null);
    fetch(`/api/deals/${encodeURIComponent(d.external_id)}`)
      .then((r)=>r.ok?r.json():null)
      .then((j)=>{ if (alive) setSeries(Array.isArray(j?.series)?j.series:[]); })
      .catch(()=>{ if (alive) setSeries([]); });
    return ()=>{ alive = false; };
  }, [d.external_id]);

  const live = d.freshness==="fresh" || d.freshness==="recent";
  const ago = checkedAgo(d.observed_at);
  const store = sm(d.store_id).name;
  const stats = [
    d.typical_price!==null && { k:"Typical", v:inr(d.typical_price) },
    d.low_price!==null && { k:"Lowest seen", v:inr(d.low_price) },
    d.high_price!==null && { k:"Highest seen", v:inr(d.high_price) },
  ].filter(Boolean) as { k: string; v: string }[];
  const headline = d.score_reasons.find((r)=>r.kind==="typical")?.text;

  return (
    <Sheet onClose={onClose}>
      <div className="flex items-center" style={{ gap:14 }}>
        <ProductIcon d={d} size={70}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, color:MUTED }}>{d.brand} · {sm(d.store_id).name}</div>
          <div style={{ fontSize:17, fontWeight:700, letterSpacing:-0.3, marginTop:2 }}>{d.name}</div>
        </div>
        {d.score !== null && <ScoreRing score={d.score} size={52}/>}
      </div>

      {d.sample && (
        <div style={{ fontSize:12.5, color:WARN_INK, background:WARN_SOFT, borderRadius:12, padding:"10px 12px", marginTop:12, lineHeight:1.45 }}>
          Sample product for demonstration. Prices and offers are illustrative, not live.
        </div>
      )}

      <div className="flex" style={{ gap:8, marginTop:14 }}>
        <button onClick={onSave} className="press flex items-center justify-center" style={{ flex:1, gap:7, padding:11, borderRadius:13, border:`1px solid ${saved?"#E0245E":LINE}`, background:saved?"#FDEAF0":"#fff", fontSize:13.5, fontWeight:600, color:saved?"#E0245E":INK, cursor:"pointer" }}>
          <Heart size={16} fill={saved?"#E0245E":"none"} color={saved?"#E0245E":INK}/> {saved?"Saved":"Save"}
        </button>
        <button onClick={onAlert} className="press flex items-center justify-center" style={{ flex:1, gap:7, padding:11, borderRadius:13, border:`1px solid ${alerted?ACCENT:LINE}`, background:alerted?ACCENT_SOFT:"#fff", fontSize:13.5, fontWeight:600, color:alerted?ACCENT_INK:INK, cursor:"pointer" }}>
          <Bell size={16} className={alerted?"pop":""} fill={alerted?ACCENT:"none"} color={alerted?ACCENT:INK}/> {alerted?"Alerting":"Price alert"}
        </button>
      </div>

      {/* what you pay */}
      <div style={{ background:"#fff", border:`1px solid ${LINE}`, borderRadius:20, padding:18, marginTop:14, boxShadow:SHADOW }}>
        <div style={{ fontSize:12.5, fontWeight:600, color:MUTED, textTransform:"uppercase", letterSpacing:0.3, marginBottom:8 }}>What you pay</div>
        {d.mrp > d.price && <Row muted label="MRP" value={<s>{inr(d.mrp)}</s>}/>}
        <Row label={`${store} price`} value={inr(d.price)}/>
        {d.effective < d.price && <Row label={<>Coupon <b>{d.coupon_code}</b></>} value={"− "+inr(d.price-d.effective)} accent/>}
        <div style={{ background:ACCENT_SOFT, borderRadius:14, padding:"13px 15px", marginTop:10 }}>
          <div className="flex items-center justify-between">
            <span style={{ fontSize:13.5, fontWeight:600, color:ACCENT_INK }}>You pay</span>
            <Money value={d.effective} style={{ fontSize:25, fontWeight:800, letterSpacing:-0.8, color:ACCENT_INK }}/>
          </div>
          <div style={{ fontSize:12, color:ACCENT_INK, marginTop:3 }}>Available to anyone{d.effective < d.price ? " who applies the coupon" : ""}.</div>
        </div>
        {d.best_case < d.effective && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:MUTED, marginBottom:2 }}>If you qualify</div>
            {d.bank_off > 0 && <Row label={`${d.bank_name} card offer`} value={"− "+inr(d.bank_off)} accent/>}
            {d.cashback_amt > 0 && <Row label={`Store cashback (${d.cashback_pct}%, credited later)`} value={"− "+inr(d.cashback_amt)} accent/>}
            <Row strong label="Best case" value={inr(d.best_case)}/>
            <div style={{ fontSize:11.5, color:MUTED, lineHeight:1.4 }}>Only with that card, and only if the offer's terms cover your order.</div>
          </div>
        )}
      </div>

      {/* price signal */}
      <div style={{ background:"#fff", border:`1px solid ${LINE}`, borderRadius:20, padding:18, marginTop:14, boxShadow:SHADOW }}>
        <div className="flex items-center justify-between" style={{ marginBottom:8, gap:8, flexWrap:"wrap" }}>
          <span style={{ fontSize:12.5, fontWeight:600, color:MUTED, textTransform:"uppercase", letterSpacing:0.3 }}>Is this a good price?</span>
          {d.low_window_days !== null && (
            <span className="flex items-center" style={{ gap:5, fontSize:12.5, fontWeight:600, color:ACCENT }}><BadgeCheck size={15}/> {lowLabel(d.low_window_days)}</span>
          )}
        </div>

        {d.score !== null && headline ? (
          <>
            <div style={{ fontSize:15, fontWeight:600, lineHeight:1.4 }}>{headline}</div>
            <button onClick={()=>setShowWhy((v)=>!v)} aria-expanded={showWhy} className="press flex items-center" style={{ gap:4, marginTop:8, padding:0, background:"none", border:"none", color:ACCENT_INK, fontSize:13, fontWeight:600, cursor:"pointer" }}>
              Why a score of {d.score}? <ChevronRight size={15} style={{ transform:showWhy?"rotate(90deg)":"none", transition:"transform .2s" }}/>
            </button>
            {showWhy && (
              <ul style={{ margin:"8px 0 0", paddingLeft:18, fontSize:13, color:MUTED, lineHeight:1.55 }}>
                {d.score_reasons.map((r)=><li key={r.kind}>{r.text}</li>)}
              </ul>
            )}
          </>
        ) : (
          <div style={{ fontSize:13.5, color:MUTED, lineHeight:1.5 }}>{historyNote(d)}</div>
        )}

        {stats.length > 0 && (
          <div style={{ display:"grid", gridTemplateColumns:`repeat(${stats.length}, 1fr)`, gap:8, marginTop:14 }}>
            {stats.map((s)=>(
              <div key={s.k} style={{ background:"#F6F6F7", borderRadius:12, padding:"9px 11px" }}>
                <div style={{ fontSize:11, color:MUTED }}>{s.k}</div>
                <div style={{ fontSize:14.5, fontWeight:700, marginTop:2, fontVariantNumeric:"tabular-nums" }}>{s.v}</div>
              </div>
            ))}
          </div>
        )}

        {series === null && !d.sample && <div className="skel" style={{ height:90, borderRadius:12, marginTop:14 }}/>}
        {series !== null && series.length >= 2 && <div style={{ marginTop:14 }}><PriceChart series={series} typical={d.typical_price}/></div>}

        {d.mrp_misleading && d.typical_price !== null && (
          <div className="flex" style={{ gap:8, marginTop:12, background:WARN_SOFT, borderRadius:12, padding:"10px 12px" }}>
            <ShieldCheck size={16} color="#B25C00" style={{ flexShrink:0, marginTop:1 }}/>
            <span style={{ fontSize:12.5, color:WARN_INK, lineHeight:1.4 }}>
              The MRP of {inr(d.mrp)} isn't a useful guide. This has typically sold for {inr(d.typical_price)} over the last {Math.min(d.tracked_days, 90)} days.
            </span>
          </div>
        )}
      </div>

      {/* coupon copy */}
      {d.coupon_code && (
        <button
          onClick={()=>{ navigator.clipboard?.writeText(d.coupon_code!); setCopied(true); setTimeout(()=>setCopied(false),1500); }}
          className="press flex items-center justify-between"
          style={{ width:"100%", marginTop:14, border:`1.5px dashed ${ACCENT}`, background:ACCENT_SOFT, borderRadius:14, padding:"13px 16px", cursor:"pointer" }}
        >
          <span className="flex items-center" style={{ gap:8, fontSize:14, fontWeight:700, color:ACCENT_INK, letterSpacing:0.5 }}><Tag size={15}/>{d.coupon_code}</span>
          <span className="flex items-center" style={{ gap:5, fontSize:13, fontWeight:600, color:ACCENT_INK }}>
            {copied ? <span className="pop flex items-center" style={{ gap:5 }}><Check size={14}/> Copied</span> : <><Copy size={14}/> Copy</>}
          </span>
        </button>
      )}

      {d.sample ? (
        <div style={{ marginTop:14, textAlign:"center", fontSize:13.5, color:MUTED, border:`1px dashed ${LINE}`, borderRadius:16, padding:14 }}>
          Store link disabled for sample products
        </div>
      ) : (
        <a href={`/api/track?deal=${encodeURIComponent(d.external_id)}`} target="_blank" rel="noopener noreferrer nofollow sponsored" className="press" style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, width:"100%", marginTop:14, background:INK, color:"#fff", borderRadius:16, padding:16, fontSize:15.5, fontWeight:600, textDecoration:"none" }}>
          Go to {store} <ChevronRight size={18}/>
        </a>
      )}
      {!d.sample && (
        <div style={{ textAlign:"center", fontSize:11.5, color:live?FAINT:WARN_INK, marginTop:10 }}>
          {ago ? `Price checked ${ago}` : "Price not checked yet"}{live ? "" : ". It may have changed."}
        </div>
      )}
    </Sheet>
  );
}

/* ================================================================
   Auth modal
================================================================ */

function AuthModal({ onClose }: { onClose: () => void }) {
  const sb = sbClient();
  const [tab, setTab] = useState<"google"|"phone">("google");
  const [phone, setPhone] = useState("+91");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sendOtp = async () => {
    if (!sb) return;
    setLoading(true); setError("");
    const { error:e } = await sb.auth.signInWithOtp({ phone });
    if (e) setError(e.message); else setOtpSent(true);
    setLoading(false);
  };
  const verifyOtp = async () => {
    if (!sb) return;
    setLoading(true); setError("");
    const { error:e } = await sb.auth.verifyOtp({ phone, token:otp, type:"sms" });
    if (e) setError(e.message); else onClose();
    setLoading(false);
  };
  const signInGoogle = async () => {
    if (!sb) return;
    await sb.auth.signInWithOAuth({ provider:"google", options:{ redirectTo:typeof window!=="undefined"?window.location.origin:"/" } });
  };

  return (
    <Sheet onClose={onClose} title="Sign in to Sahi">
      <p style={{ fontSize:13.5, color:MUTED, marginTop:4, marginBottom:20, lineHeight:1.5 }}>
        Save products and get an email when one drops to its lowest price in at least 30 days of Sahi tracking.
      </p>
      <div className="flex" style={{ background:"#EDEDEF", borderRadius:12, padding:4, gap:4 }}>
        {(["google","phone"] as const).map((t)=>(
          <button key={t} onClick={()=>setTab(t)} className="press" style={{ flex:1, padding:"9px 0", borderRadius:9, fontSize:13.5, fontWeight:600, border:"none", background:tab===t?"#fff":"transparent", color:tab===t?INK:MUTED, cursor:"pointer", boxShadow:tab===t?"0 1px 3px rgba(0,0,0,.08)":"none" }}>
            {t==="google"?"Google":"Phone OTP"}
          </button>
        ))}
      </div>

      {tab==="google" && (
        <button onClick={signInGoogle} className="press flex items-center justify-center" style={{ width:"100%", marginTop:18, padding:14, borderRadius:14, border:`1px solid ${LINE}`, background:"#fff", fontSize:15, fontWeight:600, color:INK, gap:10, cursor:"pointer" }}>
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#4285F4" d="M47 24.6c0-1.6-.1-3.2-.4-4.6H24v8.7h13c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.7-4.3 7-10.6 7-17.3z"/><path fill="#34A853" d="M24 48c6.5 0 12-2.2 16-5.8l-7.9-6c-2.2 1.5-5 2.3-8.1 2.3-6.2 0-11.5-4.2-13.4-9.9H2.5v6.2C6.5 42.9 14.7 48 24 48z"/><path fill="#FBBC05" d="M10.6 28.6C10.2 27.4 10 26.2 10 25s.2-2.4.6-3.6v-6.2H2.5C.9 18.3 0 21.5 0 25s.9 6.7 2.5 9.8l8.1-6.2z"/><path fill="#EA4335" d="M24 9.9c3.5 0 6.6 1.2 9 3.6l6.8-6.8C35.9 2.5 30.4 0 24 0 14.7 0 6.5 5.1 2.5 12.8l8.1 6.2c1.9-5.7 7.2-9.1 13.4-9.1z"/></svg>
          Continue with Google
        </button>
      )}

      {tab==="phone" && (
        <div style={{ marginTop:18 }}>
          {!otpSent ? (
            <>
              <input value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="+91 98765 43210" style={{ width:"100%", padding:13, borderRadius:13, border:`1px solid ${LINE}`, fontSize:15, outline:"none", color:INK, boxSizing:"border-box" }}/>
              <button onClick={sendOtp} disabled={loading} className="press" style={{ width:"100%", marginTop:10, padding:14, borderRadius:14, border:"none", background:INK, color:"#fff", fontSize:15, fontWeight:600, cursor:"pointer", opacity:loading?.6:1 }}>
                {loading?"Sending…":"Send OTP"}
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize:13.5, color:MUTED, marginBottom:12 }}>OTP sent to {phone}</p>
              <input value={otp} onChange={(e)=>setOtp(e.target.value)} placeholder="6-digit OTP" maxLength={6} style={{ width:"100%", padding:13, borderRadius:13, border:`1px solid ${LINE}`, fontSize:22, fontWeight:700, letterSpacing:10, outline:"none", textAlign:"center", color:INK, boxSizing:"border-box" }}/>
              <button onClick={verifyOtp} disabled={loading||otp.length<4} className="press" style={{ width:"100%", marginTop:10, padding:14, borderRadius:14, border:"none", background:INK, color:"#fff", fontSize:15, fontWeight:600, cursor:"pointer", opacity:loading?.6:1 }}>
                {loading?"Verifying…":"Verify & Sign in"}
              </button>
            </>
          )}
        </div>
      )}
      {error && <p style={{ fontSize:12.5, color:"#B25C00", marginTop:10 }}>{error}</p>}
    </Sheet>
  );
}

/* ================================================================
   Main SahiApp
================================================================ */

export default function SahiApp() {
  /* data */
  const [deals, setDeals]       = useState<ApiDeal[]>([]);
  const [coupons, setCoupons]   = useState<NormCoupon[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  /* auth */
  const { session, user, ready } = useAuth();
  const [showAuth, setShowAuth]  = useState(false);

  /* nav */
  const [section, setSection]         = useState("deals");
  const [transitioning, setTransitioning] = useState(false);

  /* search & filters */
  const [query,     setQuery]     = useState("");
  const [dealCat,   setDealCat]   = useState("All");
  const [lowWindow, setLowWindow] = useState("all");
  const [coupCat,   setCoupCat]   = useState("All");
  const [sort,      setSort]      = useState("score");
  const [filters,   setFilters]   = useState<Filters>({ stores:new Set(), minDisc:0, band:null });
  const [filterOpen, setFilterOpen] = useState(false);

  /* saved & alerts */
  const [saved, setSaved] = useState<Set<string>>(()=>{
    if (typeof window==="undefined") return new Set();
    try { return new Set(JSON.parse(localStorage.getItem("sahi_saved")??"[]")); } catch { return new Set(); }
  });
  const [alerts, setAlerts] = useState<Set<string>>(new Set());

  /* UI state */
  const [open,   setOpen]   = useState<ApiDeal|null>(null);
  const [copied, setCopied] = useState<string|null>(null);

  /* fetch data */
  useEffect(()=>{
    Promise.all([
      fetch("/api/deals").then((r)=>r.json()),
      fetch("/api/coupons").then((r)=>r.json()),
    ]).then(([d,c])=>{
      setDeals(Array.isArray(d)?d:[]);
      setCoupons(Array.isArray(c)?c.map(normCoupon):[]);
      setDataLoading(false);
    }).catch(()=>setDataLoading(false));
  }, []);

  /* sync saved/alerts from Supabase on login */
  useEffect(()=>{
    if (!user||!session) return;
    fetch("/api/saves",{ headers:{ Authorization:`Bearer ${session.access_token}` } })
      .then((r)=>r.ok?r.json():null)
      .then((data)=>{
        if (!data) return;
        setSaved((prev)=>{ const m=new Set([...prev,...(data.saved??[])]); localStorage.setItem("sahi_saved",JSON.stringify([...m])); return m; });
        setAlerts(new Set(data.alerts??[]));
      }).catch(()=>{});
  }, [user?.id]);

  /* persist saves to localStorage */
  useEffect(()=>{
    localStorage.setItem("sahi_saved", JSON.stringify([...saved]));
  }, [saved]);

  const go = (s: string) => {
    if (s===section) return;
    setSection(s); setOpen(null); setTransitioning(true);
    setTimeout(()=>setTransitioning(false), 380);
  };

  const toggleSave = useCallback((externalId: string) => {
    if (sbClient()&&!user) { setShowAuth(true); return; }
    const willUnsave = saved.has(externalId);
    setSaved((prev)=>{ const n=new Set(prev); willUnsave?n.delete(externalId):n.add(externalId); return n; });
    if (session) {
      fetch("/api/saves",{ method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${session.access_token}` }, body:JSON.stringify({ external_id:externalId, action:willUnsave?"unsave":"save" }) }).catch(()=>{});
    }
  }, [saved, session, user]);

  const toggleAlert = useCallback((externalId: string) => {
    if (sbClient()&&!user) { setShowAuth(true); return; }
    const willUnalert = alerts.has(externalId);
    setAlerts((prev)=>{ const n=new Set(prev); willUnalert?n.delete(externalId):n.add(externalId); return n; });
    if (session) {
      fetch("/api/saves",{ method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${session.access_token}` }, body:JSON.stringify({ external_id:externalId, action:willUnalert?"unalert":"alert" }) }).catch(()=>{});
    }
  }, [alerts, session, user]);

  const copyCode = (id: string, code: string) => {
    navigator.clipboard?.writeText(code);
    setCopied(id); setTimeout(()=>setCopied(null),1500);
  };

  const activeFilterCount = filters.stores.size + (filters.minDisc?1:0) + (filters.band?1:0);

  const filterDeals = (arr: ApiDeal[]) => arr.filter((d)=>{
    const okStore = filters.stores.size===0 || filters.stores.has(sm(d.store_id).name);
    const okDisc  = d.mrp_off_pct >= filters.minDisc;
    const band    = filters.band ? PRICE_BANDS.find((b)=>b.id===filters.band) : null;
    const okBand  = !band || (d.effective>=band.lo && d.effective<band.hi);
    const okQ     = !query || (d.name+" "+(d.brand??"")+" "+sm(d.store_id).name).toLowerCase().includes(query.toLowerCase());
    return okStore && okDisc && okBand && okQ;
  });
  const sortDeals = (arr: ApiDeal[]) => [...arr].sort((a,b)=>
    sort==="typical" ? byNullable(a.vs_typical_pct, b.vs_typical_pct) :
    sort==="price"   ? a.effective-b.effective :
    sort==="disc"    ? b.mrp_off_pct-a.mrp_off_pct :
    byNullable(a.score===null?null:-a.score, b.score===null?null:-b.score)
  );

  const dealsList  = useMemo(()=>sortDeals(filterDeals(deals.filter((d)=>dealCat==="All"||d.category===dealCat))), [deals,dealCat,sort,filters,query]);
  const heroDeal   = useMemo(()=>deals.filter((d)=>d.score!==null).sort((a,b)=>b.score!-a.score!)[0]??null, [deals]);
  const lowestList = useMemo(()=>{
    let r = deals.filter((d)=>d.low_window_days!==null);
    if (lowWindow!=="all") r=r.filter((d)=>d.low_window_days!>=Number(lowWindow));
    return sortDeals(filterDeals(r));
  }, [deals,lowWindow,filters,query,sort]);
  const isSample = deals.some((d)=>d.sample);
  const lastChecked = useMemo(()=>deals.reduce<string|null>((m,d)=>d.observed_at&&(!m||d.observed_at>m)?d.observed_at:m, null), [deals]);
  const couponsList = useMemo(()=>{
    let r = coupons.filter((c)=>coupCat==="All"||c.category===coupCat);
    if (filters.stores.size) r=r.filter((c)=>filters.stores.has(c.store));
    if (query) r=r.filter((c)=>(c.store+" "+c.title+" "+c.code).toLowerCase().includes(query.toLowerCase()));
    return [...r].sort((a,b)=>byNullable(a.success_rate===null?null:-a.success_rate, b.success_rate===null?null:-b.success_rate));
  }, [coupons,coupCat,filters,query]);
  const savedList  = useMemo(()=>deals.filter((d)=>saved.has(d.external_id)), [deals,saved]);

  const hour  = new Date().getHours();
  const greet = hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";
  const loading = dataLoading || transitioning;

  return (
    <div style={{ background:"#FBFBFA", color:INK, minHeight:"100%", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <div style={{ maxWidth:460, margin:"0 auto", paddingBottom:92, position:"relative" }}>

        {/* ── HEADER ── */}
        <header style={{ position:"sticky", top:0, zIndex:30, background:"rgba(251,251,250,.82)", backdropFilter:"blur(14px)", borderBottom:`1px solid ${LINE}`, overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-60, right:-40, width:200, height:160, background:"radial-gradient(circle, rgba(14,157,90,.16), transparent 70%)", filter:"blur(20px)", animation:"auroraMove 14s ease-in-out infinite", pointerEvents:"none" }}/>
          <div className="flex items-center justify-between" style={{ padding:"13px 18px 9px", position:"relative" }}>
            <div className="flex items-center" style={{ gap:10 }}>
              <div style={{ width:32, height:32, borderRadius:10, background:INK, boxShadow:"0 4px 12px rgba(17,17,20,.18)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Check size={19} color="#fff" strokeWidth={3}/>
              </div>
              <div>
                <div style={{ fontSize:10.5, color:MUTED }}>{greet} 👋</div>
                <div style={{ fontWeight:700, fontSize:17, letterSpacing:-0.4, lineHeight:1.05 }}>Sahi</div>
              </div>
            </div>
            <div className="flex items-center" style={{ gap:8 }}>
              {isSample ? (
                <span style={{ fontSize:10.5, fontWeight:600, color:WARN_INK, background:WARN_SOFT, padding:"5px 9px", borderRadius:999 }}>Sample data</span>
              ) : lastChecked ? (
                <span className="flex items-center" style={{ gap:5, fontSize:10.5, fontWeight:600, color:ACCENT_INK, background:ACCENT_SOFT, padding:"5px 9px", borderRadius:999 }}>
                  <span style={{ width:6, height:6, borderRadius:999, background:ACCENT }}/>
                  Checked {checkedAgo(lastChecked)}
                </span>
              ) : null}
              {ready && sbClient() && (
                user
                  ? <button onClick={()=>sbClient()?.auth.signOut()} className="press" style={{ background:"#EEEEF0", border:"none", borderRadius:999, width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><User size={16} color={MUTED}/></button>
                  : <button onClick={()=>setShowAuth(true)} className="press" style={{ fontSize:11.5, fontWeight:600, color:INK, background:"#fff", border:`1px solid ${LINE}`, borderRadius:999, padding:"6px 11px", cursor:"pointer" }}>Sign in</button>
              )}
            </div>
          </div>

          {/* search bar */}
          <div style={{ padding:"0 18px 10px", position:"relative" }}>
            <div className="flex items-center" style={{ gap:9, background:"#fff", border:`1px solid ${LINE}`, borderRadius:14, padding:"11px 13px", boxShadow:"0 1px 2px rgba(0,0,0,.03)" }}>
              <Search size={17} color={FAINT}/>
              <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={section==="coupons"?"Search stores, coupons":"Search products, brands, stores"} style={{ border:"none", outline:"none", width:"100%", fontSize:14.5, background:"transparent", color:INK }}/>
              {query && <X size={16} color={FAINT} className="press" style={{ cursor:"pointer" }} onClick={()=>setQuery("")}/>}
            </div>
          </div>

          {/* sub-category chips + filter */}
          {section!=="saved" && (
            <div className="flex items-center" style={{ gap:8, padding:"0 18px 12px", position:"relative" }}>
              <div className="noscroll flex" style={{ gap:8, overflowX:"auto", flex:1 }}>
                {section==="deals"  && DEAL_CATS.map((c)=><Chip key={c} on={c===dealCat} onClick={()=>setDealCat(c)}>{c}</Chip>)}
                {section==="lowest" && [{id:"all",l:"All lows"},{id:"30",l:"30+ days"},{id:"60",l:"60+ days"},{id:"90",l:"90+ days"}].map((w)=><Chip key={w.id} on={w.id===lowWindow} onClick={()=>setLowWindow(w.id)}>{w.l}</Chip>)}
                {section==="coupons"&& COUPON_CATS.map((c)=><Chip key={c} on={c===coupCat} onClick={()=>setCoupCat(c)}>{c}</Chip>)}
              </div>
              <button onClick={()=>setFilterOpen(true)} className="press flex items-center" style={{ gap:6, flexShrink:0, fontSize:13, fontWeight:600, color:activeFilterCount?"#fff":INK, background:activeFilterCount?INK:"#fff", border:`1px solid ${activeFilterCount?INK:LINE}`, borderRadius:999, padding:"7px 12px", cursor:"pointer" }}>
                <SlidersHorizontal size={15}/> {activeFilterCount||"Filters"}
              </button>
            </div>
          )}
        </header>

        {/* sort pills */}
        {(section==="deals"||section==="lowest") && (
          <div className="noscroll flex" style={{ gap:7, overflowX:"auto", padding:"14px 18px 4px" }}>
            {[{id:"score",l:"Best price signal"},{id:"typical",l:"Most below typical"},{id:"price",l:"Lowest price"},{id:"disc",l:"% off MRP"}].map((s)=>{
              const on=s.id===sort;
              return <button key={s.id} onClick={()=>setSort(s.id)} className="press" style={{ whiteSpace:"nowrap", fontSize:12.5, fontWeight:on?600:500, padding:"6px 11px", borderRadius:10, background:on?"#fff":"transparent", border:`1px solid ${on?INK:"transparent"}`, color:on?INK:MUTED, cursor:"pointer" }}>{s.l}</button>;
            })}
          </div>
        )}

        {/* ── MAIN ── */}
        <main style={{ padding:"14px 18px 0" }}>
          {!loading && isSample && (
            <div style={{ fontSize:12.5, color:WARN_INK, background:WARN_SOFT, borderRadius:14, padding:"11px 13px", marginBottom:14, lineHeight:1.45 }}>
              You're looking at sample products. Prices, coupons and offers here are illustrative, not live. Real prices appear once a store feed is connected.
            </div>
          )}
          {loading ? <Skeletons/> : (
            <>
              {section==="deals" && (
                <>
                  {dealCat==="All"&&!query&&heroDeal&&<Hero d={heroDeal} onOpen={()=>setOpen(heroDeal)}/>}
                  <DealList items={dealsList} saved={saved} onSave={toggleSave} onOpen={setOpen} emptyMsg="No deals match these filters. Try clearing them."/>
                </>
              )}
              {section==="lowest" && (
                <>
                  <div className="flex" style={{ gap:9, background:"#fff", border:`1px solid ${LINE}`, borderRadius:14, padding:"11px 13px", marginBottom:14 }}>
                    <TrendingDown size={17} color={ACCENT} style={{ flexShrink:0, marginTop:1 }}/>
                    <span style={{ fontSize:12.5, color:MUTED, lineHeight:1.45 }}>Products at the lowest price Sahi has seen for them, over at least a week of its own price checks. A 90-day low only appears once Sahi has watched a product for 90 days.</span>
                  </div>
                  <DealList items={lowestList} saved={saved} onSave={toggleSave} onOpen={setOpen} emptyMsg="Nothing is at a low Sahi can vouch for in this window yet."/>
                </>
              )}
              {section==="coupons" && (
                couponsList.length===0
                  ? <Empty msg="No coupons match these filters."/>
                  : <div style={{ display:"grid", gap:12 }}>{couponsList.map((c,i)=><CouponCard key={c.id} c={c} i={i} copied={copied===c.id} onCopy={()=>copyCode(c.id,c.code)}/>)}</div>
              )}
              {section==="saved" && (
                savedList.length===0
                  ? <Empty msg="Save products and Sahi will keep checking their prices for you."/>
                  : (
                    <>
                      <div className="fu flex items-center justify-between" style={{ background:"linear-gradient(135deg,#0E9D5A,#0a6e40)", borderRadius:18, padding:"16px 18px", marginBottom:16, gap:12 }}>
                        <div style={{ fontSize:13.5, color:"#fff", lineHeight:1.4 }}>
                          Sahi checks these prices on every update. Turn on a price alert to get an email at a new low.
                        </div>
                        <span className="flex items-center" style={{ gap:5, fontSize:12, color:"#fff", fontWeight:600, background:"rgba(255,255,255,.18)", padding:"6px 11px", borderRadius:999, flexShrink:0 }}>
                          <Sparkles size={13}/> {savedList.length} saved
                        </span>
                      </div>
                      <DealList items={savedList} saved={saved} onSave={toggleSave} onOpen={setOpen} emptyMsg=""/>
                    </>
                  )
              )}
            </>
          )}
        </main>

        {/* affiliate disclosure */}
        <footer style={{ textAlign:"center", padding:"24px 20px 8px" }}>
          <p style={{ fontSize:10.5, color:FAINT, lineHeight:1.55 }}>
            Sahi participates in affiliate programmes including the Amazon Associates Programme. Clicking "Grab deal" may earn us a small commission at no extra cost to you. Amazon and the Amazon logo are trademarks of Amazon.com, Inc.
          </p>
        </footer>
      </div>

      {/* ── OVERLAYS ── */}
      {open && (
        <Detail d={open} saved={saved.has(open.external_id)} onSave={()=>toggleSave(open.external_id)} alerted={alerts.has(open.external_id)} onAlert={()=>toggleAlert(open.external_id)} onClose={()=>setOpen(null)}/>
      )}
      {filterOpen && <FilterSheet filters={filters} setFilters={setFilters} onClose={()=>setFilterOpen(false)} forCoupons={section==="coupons"}/>}
      {showAuth && <AuthModal onClose={()=>setShowAuth(false)}/>}

      {/* ── BOTTOM NAV ── */}
      <nav style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:30, background:"rgba(251,251,250,.94)", backdropFilter:"blur(14px)", borderTop:`1px solid ${LINE}` }}>
        <div style={{ maxWidth:460, margin:"0 auto", display:"flex", justifyContent:"space-around", padding:"9px 0 11px" }}>
          {[{id:"deals",icon:Flame,label:"Deals"},{id:"lowest",icon:TrendingDown,label:"Lows"},{id:"coupons",icon:Ticket,label:"Coupons"},{id:"saved",icon:Heart,label:"Saved"}].map((t)=>{
            const on=section===t.id; const Icon=t.icon;
            return (
              <button key={t.id} onClick={()=>go(t.id)} className="press" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, color:on?INK:FAINT, position:"relative", background:"none", border:"none", cursor:"pointer" }}>
                {on && <span style={{ position:"absolute", top:-9, width:26, height:3, borderRadius:999, background:INK }}/>}
                <Icon size={21} fill={on&&t.id==="saved"?INK:"none"}/>
                <span style={{ fontSize:10, fontWeight:on?600:500 }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
