import { NextRequest, NextResponse } from "next/server";
import { buildAffiliateLink } from "@/lib/deeplink";
import { serviceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Click tracker + affiliate redirect: /api/track?deal=<external_id>
 * The destination always comes from our own listing, never from the request,
 * so this can't be used as an open redirect.
 */
export async function GET(req: NextRequest) {
  const externalId = req.nextUrl.searchParams.get("deal");
  const home = new URL("/", req.url);
  if (!externalId) return NextResponse.redirect(home);

  const db = serviceClient();
  if (!db) return NextResponse.redirect(home);

  const { data: listing } = await db.from("deals")
    .select("id, product_url, store_id").eq("external_id", externalId).eq("active", true).maybeSingle();
  if (!listing) return NextResponse.redirect(home);

  const subId = `sahi_${listing.id}_${Date.now().toString(36)}`;
  await db.from("clicks").insert({ deal_id: listing.id, sub_id: subId });

  return NextResponse.redirect(buildAffiliateLink(listing.product_url, listing.store_id, subId));
}
