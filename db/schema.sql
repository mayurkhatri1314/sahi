-- Sahi database schema (PostgreSQL / Supabase)
-- Run this in the Supabase SQL editor on a fresh project.

-- ── stores ─────────────────────────────────────────────────────────
create table if not exists stores (
  id          text primary key,            -- 'amazon', 'flipkart'
  name        text not null,
  network     text,                         -- 'cuelinks' | 'inrdeals' | 'direct'
  logo_color  text
);

insert into stores (id, name, network, logo_color) values
  ('amazon',     'Amazon',           'cuelinks', '#FF9900'),
  ('flipkart',   'Flipkart',         'cuelinks', '#2874F0'),
  ('myntra',     'Myntra',           'inrdeals', '#FF3F6C'),
  ('ajio',       'Ajio',             'inrdeals', '#27317E'),
  ('nykaa',      'Nykaa',            'direct',   '#FC2779'),
  ('swiggy',     'Swiggy Instamart', 'direct',   '#FC8019'),
  ('zomato',     'Zomato',           'direct',   '#E23744'),
  ('bigbasket',  'BigBasket',        'direct',   '#84C225')
on conflict (id) do nothing;

-- ── deals (one row per merchant listing) ───────────────────────────
-- Listing fields come from the feed. Signal fields are computed by lib/engine.ts
-- from price_observations and cached here; the API re-checks freshness on read.
create table if not exists deals (
  id                 bigserial primary key,
  external_id        text unique not null,  -- feed-prefixed id, e.g. 'cl-123'
  source             text not null,         -- feed that supplied the listing
  name               text not null,
  brand              text,
  category           text not null,
  store_id           text,
  product_url        text not null,         -- raw merchant URL (affiliate tag added at click time)
  image_url          text,
  mrp                integer not null,
  price              integer not null check (price > 0),
  coupon_code        text,
  coupon_value       integer default 0,
  bank_name          text,
  bank_pct           integer default 0,
  bank_max           integer default 0,
  cashback_pct       numeric default 0,     -- store/payment cashback only, never our commission
  -- computed:
  effective          integer,               -- price anyone pays with the listed coupon
  best_case          integer,               -- if the shopper also qualifies for bank + cashback
  bank_off           integer,
  cashback_amt       integer,
  mrp_off_pct        integer,               -- the store's claimed discount
  observed_at        timestamptz,           -- latest price observation
  tracked_days       integer default 0,
  observation_count  integer default 0,
  low_price          integer,
  high_price         integer,
  typical_price      integer,
  vs_typical_pct     integer,
  low_window_days    integer,
  mrp_misleading     boolean default false,
  score              integer,
  score_reasons      jsonb default '[]'::jsonb,
  engine_version     text,
  computed_at        timestamptz,
  active             boolean default true,
  updated_at         timestamptz default now()
);
create index if not exists deals_category_idx on deals (category) where active;
create index if not exists deals_window_idx   on deals (low_window_days) where active;
create index if not exists deals_score_idx    on deals (score desc nulls last) where active;

-- ── price_observations (append-only; this is the data asset) ──────
-- Never updated or deleted by the app. Every row says where and when it came from.
create table if not exists price_observations (
  id           bigserial primary key,
  deal_id      bigint not null references deals(id) on delete cascade,
  observed_at  timestamptz not null,
  price        integer not null check (price > 0),
  mrp          integer,
  source       text not null,               -- 'cuelinks' | 'inrdeals' | 'keepa' | ...
  method       text not null check (method in ('feed', 'history_api')),
  ingested_at  timestamptz not null default now(),
  unique (deal_id, source, observed_at)
);
create index if not exists price_obs_deal_time_idx on price_observations (deal_id, observed_at desc);

-- ── coupons ────────────────────────────────────────────────────────
create table if not exists coupons (
  id            bigserial primary key,
  external_id   text unique,
  store_id      text,                       -- no FK: feeds name stores we haven't listed yet
  category      text,
  code          text not null,
  title         text not null,
  min_order     integer default 0,
  success_rate  integer,                    -- null until Sahi has its own evidence
  verified_at   timestamptz,                -- null until Sahi re-tested the code
  expires_at    timestamptz,
  active        boolean default true
);

-- ── clicks ─────────────────────────────────────────────────────────
create table if not exists clicks (
  id          bigserial primary key,
  deal_id     bigint references deals(id) on delete set null,
  coupon_id   bigint,
  sub_id      text,
  created_at  timestamptz default now()
);

-- ── saves / price alerts ───────────────────────────────────────────
create table if not exists saves (
  user_id  uuid not null,
  deal_id  bigint references deals(id) on delete cascade,
  alert    boolean default false,
  primary key (user_id, deal_id)
);

-- ── Row Level Security ─────────────────────────────────────────────
-- Every table has RLS on. The service role (ingest, API routes) bypasses it.
alter table stores             enable row level security;
alter table deals              enable row level security;
alter table price_observations enable row level security;
alter table coupons            enable row level security;
alter table clicks             enable row level security;   -- no policies: service role only
alter table saves              enable row level security;

create policy "public read stores"       on stores             for select using (true);
create policy "public read deals"        on deals              for select using (active);
create policy "public read observations" on price_observations for select using (true);
create policy "public read coupons"      on coupons            for select using (active);

create policy "users manage own saves" on saves
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);
