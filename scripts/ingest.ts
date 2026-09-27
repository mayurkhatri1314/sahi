/**
 * Sahi ingest job, same code path as the scheduled /api/cron/ingest route.
 *   npm run ingest          — fetch feeds and write to Supabase
 *   npm run seed            — write sample data to data/*.json (no database)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fetchAllDeals, fetchAllCoupons } from "../lib/feeds";
import { computeDeal } from "../lib/engine";
import { serviceClient } from "../lib/supabase";
import { ingest } from "../lib/ingest";
import { SEED_DEALS, SEED_COUPONS } from "../lib/seed";

async function main() {
  const seedOnly = process.argv.includes("--seed-only");
  const db = serviceClient();

  if (seedOnly || !db) {
    mkdirSync("data", { recursive: true });
    writeFileSync("data/deals.json", JSON.stringify(SEED_DEALS.map((d) => computeDeal(d)), null, 2));
    writeFileSync("data/coupons.json", JSON.stringify(SEED_COUPONS, null, 2));
    console.log(`${db ? "" : "No Supabase configured. "}Wrote sample data to data/deals.json and data/coupons.json`);
    return;
  }

  const [deals, coupons] = await Promise.all([fetchAllDeals(), fetchAllCoupons()]);
  if (deals.every((d) => d.sample)) console.log("No feed keys configured: nothing live to ingest (sample data stays out of the database).");
  const report = await ingest(db, deals, coupons);
  console.log(JSON.stringify(report, null, 2));
  if (report.failed) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
