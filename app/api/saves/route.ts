import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  return auth?.startsWith("Bearer ") ? auth.slice(7) : null;
}

async function getUser(token: string) {
  const db = serviceClient();
  if (!db) return null;
  const { data: { user } } = await db.auth.getUser(token);
  return user ?? null;
}

/** GET /api/saves — return this user's saved external_ids and alert external_ids */
export async function GET(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await getUser(token);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = serviceClient()!;
  const { data } = await db
    .from("saves")
    .select("deal_id, alert, deals!inner(external_id)")
    .eq("user_id", user.id);

  const saved: string[] = [];
  const alerts: string[] = [];
  for (const row of data ?? []) {
    const eid = (row as any).deals?.external_id;
    if (eid) {
      saved.push(eid);
      if (row.alert) alerts.push(eid);
    }
  }
  return NextResponse.json({ saved, alerts });
}

/** POST /api/saves — save/unsave/alert/unalert a deal by external_id */
export async function POST(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await getUser(token);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { external_id, action } = await req.json() as { external_id: string; action: "save"|"unsave"|"alert"|"unalert" };
  if (!external_id || !action) return NextResponse.json({ error: "missing fields" }, { status: 400 });

  const db = serviceClient()!;

  // resolve deal DB id
  const { data: deal } = await db.from("deals").select("id").eq("external_id", external_id).single();
  if (!deal) return NextResponse.json({ error: "deal not found" }, { status: 404 });

  const dealId = deal.id as number;

  if (action === "unsave") {
    await db.from("saves").delete().eq("user_id", user.id).eq("deal_id", dealId);
    return NextResponse.json({ ok: true });
  }
  if (action === "save") {
    await db.from("saves").upsert({ user_id: user.id, deal_id: dealId, alert: false }, { onConflict: "user_id,deal_id", ignoreDuplicates: true });
    return NextResponse.json({ ok: true });
  }
  if (action === "alert") {
    await db.from("saves").upsert({ user_id: user.id, deal_id: dealId, alert: true }, { onConflict: "user_id,deal_id" });
    return NextResponse.json({ ok: true });
  }
  if (action === "unalert") {
    await db.from("saves").update({ alert: false }).eq("user_id", user.id).eq("deal_id", dealId);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
