import { NextRequest, NextResponse } from "next/server";
import { getDeal } from "@/lib/deals";

export const revalidate = 300;

/** One deal plus its observed daily price series (empty when Sahi has no history). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const found = await getDeal(params.id);
  if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(found);
}
