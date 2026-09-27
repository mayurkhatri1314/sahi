import { NextResponse } from "next/server";
import { listDeals } from "@/lib/deals";

export const revalidate = 300;

export async function GET() {
  return NextResponse.json(await listDeals());
}
