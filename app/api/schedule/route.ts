import { NextResponse } from "next/server";

import { todayISO } from "@/lib/date";
import { getWeekSchedule, isError } from "@/lib/service";

export const dynamic = "force-dynamic";

/** GET /api/schedule?room=computer&monday=2026-08-17 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const room = searchParams.get("room") ?? "computer";
  const monday = searchParams.get("monday") ?? todayISO();

  const result = await getWeekSchedule(room, monday);
  if (isError(result)) return NextResponse.json(result, { status: 400 });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
