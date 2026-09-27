import { NextResponse } from "next/server";
import { publicClient } from "@/lib/supabase";
import { SEED_COUPONS } from "@/lib/seed";

export const revalidate = 600;

export async function GET() {
  const db = publicClient();
  if (db) {
    const { data, error } = await db.from("coupons").select("*").eq("active", true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("success_rate", { ascending: false, nullsFirst: false }).limit(500);
    if (!error && data?.length) return NextResponse.json(data);
  }
  return NextResponse.json(SEED_COUPONS);
}
