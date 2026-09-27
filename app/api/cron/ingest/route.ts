import { NextRequest, NextResponse } from "next/server";
import { fetchAllDeals, fetchAllCoupons } from "@/lib/feeds";
import { serviceClient } from "@/lib/supabase";
import { ingest } from "@/lib/ingest";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Scheduled ingest. Requires CRON_SECRET; refuses to run without it. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = serviceClient();
  if (!db) return NextResponse.json({ ok: false, reason: "Supabase is not configured" }, { status: 503 });

  const [deals, coupons] = await Promise.all([fetchAllDeals(), fetchAllCoupons()]);
  const report = await ingest(db, deals, coupons);
  return NextResponse.json({ ok: report.failed === 0, ...report, errors: report.errors.slice(0, 20) });
}
