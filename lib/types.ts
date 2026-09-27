export type Freshness = "fresh" | "recent" | "stale" | "unknown";

/** "feed" = a point-in-time reading we took; "history_api" = a change-point series from a tracker (Keepa). */
export type ObservationMethod = "feed" | "history_api";

export interface Observation {
  observed_at: string;
  price: number;
  source: string;
  method: ObservationMethod;
}

export interface RawDeal {
  external_id: string;
  name: string;
  brand?: string;
  category: string;
  store_id: string;
  product_url: string;
  image_url?: string;
  mrp: number;
  price: number;
  coupon_code?: string | null;
  coupon_value?: number;
  bank_name?: string | null;
  bank_pct?: number;
  bank_max?: number;
  /** Store/payment cashback credited later. Never an affiliate commission rate. */
  cashback_pct?: number;
  source: string;
  sample?: boolean;
  /** Backfill from a history API; the ingest job stores these as observations. */
  history?: Observation[];
}

export interface ScoreReason {
  kind: "typical" | "low" | "coverage" | "offers";
  text: string;
}

export interface Deal extends RawDeal {
  /** Price anyone pays with the listed coupon. */
  effective: number;
  /** Price if you also qualify for the bank offer and store cashback. */
  best_case: number;
  bank_off: number;
  cashback_amt: number;
  mrp_off_pct: number;

  observed_at: string | null;
  freshness: Freshness;
  tracked_days: number;
  observation_count: number;
  low_price: number | null;
  high_price: number | null;
  typical_price: number | null;
  /** Negative = below typical. */
  vs_typical_pct: number | null;
  /** Current price is the lowest Sahi has observed over this many days. */
  low_window_days: number | null;
  mrp_misleading: boolean;

  score: number | null;
  score_reasons: ScoreReason[];
  engine_version: string;
  computed_at: string;
}

export interface SeriesPoint {
  date: string;
  price: number;
}

export interface Coupon {
  external_id: string;
  store_id: string;
  store?: string;
  category: string;
  code: string;
  title: string;
  min_order: number;
  /** Share of user reports where the code worked. Null until reports exist. */
  success_rate: number | null;
  verified_at: string | null;
  expires_at: string | null;
  sample?: boolean;
}
