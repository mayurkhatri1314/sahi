# Sahi — is this actually a good price?

A price-intelligence PWA for Indian online shopping. For each product, Sahi shows:

- **What you pay:** the store price after the listed coupon, which anyone can get. Bank-card offers and store cashback appear separately under "If you qualify", because not everyone does.
- **Whether it's a good price:** the typical price, the lowest and highest seen, and a "lowest in N days" badge. All of it comes from Sahi's own stored price checks.
- **Why:** every score comes with the reasons behind it and the amount of history it's based on.

## Trust rules (enforced in `lib/engine.ts`, tested in `lib/engine.test.ts`)

- Sahi never shows price history it didn't observe. With no data, it says so.
- "Lowest in N days" requires at least N days of continuous coverage. N is the real number, e.g. 17, never rounded up to 30/60/90.
- A typical price and score need at least 14 days of coverage.
- A price not checked in 48 hours is "stale", and all claims about it are withdrawn at read time, even if the ingest job stops.
- Bank offers without a listed cap aren't computed. Coupons larger than the price are ignored.
- The MRP is flagged as misleading only with 30+ days of history and an MRP more than 30% above the typical price.
- Sample products are labelled everywhere. They have no store links, aren't indexed and never enter the database.

The engine is versioned (`ENGINE_VERSION`), and every computed deal records the version that produced it.

## Quick start (zero keys)

```bash
npm install
npm run dev
npm test
```

With no keys, the app shows labelled sample products.

## Data model

- `deals`: one row per merchant listing, plus the latest computed signal.
- `price_observations`: append-only. Every price reading has its source, method (`feed` or `history_api`), timestamp and ingest time. **This table is the data asset.** Nothing in the app updates or deletes it.
- The ingest job (`lib/ingest.ts`, used by both `npm run ingest` and `/api/cron/ingest`):
  - records a reading whenever the price changes, and at least every 20 hours even if it doesn't;
  - backfills Keepa history for Amazon ASINs;
  - recomputes each listing's signal;
  - emails saved-item alerts when the price drops to a low of 30+ days.

## Environment variables

See `.env.example`. Must-have for production: the three Supabase keys and `CRON_SECRET`. The ingest endpoint refuses to run without `CRON_SECRET`.

- `CUELINKS_API_KEY` is secret and only reads the feed. `CUELINKS_CHANNEL_ID` is the public ID used in shopper-facing links. Confirm the deeplink format in your Cuelinks dashboard.
- Feed cashback/payout fields are our commission, not the shopper's cashback. They are deliberately not shown to users.
- Amazon Associates: apply only after 3 qualifying sales in 180 days.
- Amazon's API licence restricts how long its data can be stored. Get legal advice before storing Amazon-sourced price history long-term.

## Database setup (Supabase)

1. Create a Supabase project.
2. Run [`db/schema.sql`](db/schema.sql) in the SQL editor. It's written for a fresh project. RLS is on for every table, and `clicks` is service-role only.
3. Enable Google in Auth → Providers. Phone OTP needs a paid SMS provider and Indian DLT registration, so skip it at launch.
4. Run `npm run ingest` once your feed keys are set.

## Scheduling

`vercel.json` runs the ingest daily at 06:00 IST. That works on every Vercel plan, and the engine is built to tolerate daily readings. A paid plan allows more frequent runs (e.g. `0 */4 * * *`). Vercel's Hobby plan is for non-commercial use, so an affiliate site needs Pro, or another host with scheduled jobs (e.g. Cloudflare Workers Cron Triggers).

## Before launch

- [ ] Run `db/schema.sql`; set the Supabase keys and `CRON_SECRET`
- [ ] Connect at least one feed (Cuelinks / INRDeals). History only starts accumulating from the first ingest, so do this first
- [ ] Set `CUELINKS_CHANNEL_ID` and test one real click end to end (a row appears in `clicks`, and the network dashboard shows the click)
- [ ] Add `icon-192.png` and `icon-512.png` to `/public/`
- [ ] Verify a Resend domain before turning on alerts
- [ ] Legal check on storing store-sourced price history
