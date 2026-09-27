import type { SeriesPoint } from "@/lib/types";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const dayLabel = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

const W = 320, H = 110, PAD_X = 6, PAD_TOP = 10, PAD_BOTTOM = 20;

/** Step chart of observed daily prices. Callers handle the "not enough history" case. */
export default function PriceChart({ series, typical, color = "#0E9D5A", muted = "#6E6E73", line = "#ECECEE" }: {
  series: SeriesPoint[];
  typical?: number | null;
  color?: string;
  muted?: string;
  line?: string;
}) {
  const prices = series.map((p) => p.price);
  const lo = Math.min(...prices, typical ?? Infinity);
  const hi = Math.max(...prices, typical ?? -Infinity);
  const pad = Math.max((hi - lo) * 0.12, hi * 0.01);
  const y = (v: number) => PAD_TOP + (1 - (v - (lo - pad)) / (hi + pad - (lo - pad))) * (H - PAD_TOP - PAD_BOTTOM);
  const x = (i: number) => PAD_X + (i / Math.max(1, series.length - 1)) * (W - 2 * PAD_X);

  let path = `M${x(0)},${y(prices[0])}`;
  for (let i = 1; i < prices.length; i++) path += ` H${x(i)} V${y(prices[i])}`;
  const baseY = H - PAD_BOTTOM;
  const area = `${path} V${baseY} H${x(0)} Z`;

  const low = Math.min(...prices);
  const lowIdx = prices.lastIndexOf(low);
  const last = prices.length - 1;

  const summary = `Observed daily price from ${dayLabel(series[0].date)} to ${dayLabel(series[last].date)}: low ${inr(low)}, high ${inr(Math.max(...prices))}, now ${inr(prices[last])}${typical ? `, typical ${inr(typical)}` : ""}.`;

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={summary} style={{ display: "block", overflow: "visible" }}>
        <line x1={PAD_X} x2={W - PAD_X} y1={baseY} y2={baseY} stroke={line} strokeWidth={1} />
        <path d={area} fill={color} fillOpacity={0.1} />
        {typical ? (
          <line x1={PAD_X} x2={W - PAD_X} y1={y(typical)} y2={y(typical)} stroke={muted} strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
        ) : null}
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {lowIdx !== last && <circle cx={x(lowIdx)} cy={y(low)} r={3.5} fill="#fff" stroke={color} strokeWidth={1.5} />}
        <circle cx={x(last)} cy={y(prices[last])} r={4} fill={color} />
        <text x={PAD_X} y={H - 4} fontSize={9.5} fill={muted}>{dayLabel(series[0].date)}</text>
        <text x={W - PAD_X} y={H - 4} fontSize={9.5} fill={muted} textAnchor="end">{dayLabel(series[last].date)}</text>
      </svg>
      <figcaption style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: muted, marginTop: 6 }}>
        <span><span style={{ color, fontWeight: 700 }}>●</span> Now {inr(prices[last])}</span>
        {lowIdx !== last && <span><span style={{ color, fontWeight: 700 }}>○</span> Low {inr(low)}</span>}
        {typical ? <span>┄ Typical {inr(typical)}</span> : null}
      </figcaption>
    </figure>
  );
}
