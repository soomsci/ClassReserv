import { NextResponse } from "next/server";

import { clientKey, rateLimit } from "@/lib/ratelimit";
import { cancelReservation, isError } from "@/lib/service";

export const dynamic = "force-dynamic";

/** POST /api/reservations/[id]/cancel — PIN 확인 후 예약 취소 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!rateLimit(clientKey(req, "cancel"), 20, 60_000)) {
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const { id } = await ctx.params;
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };

  const result = await cancelReservation(id, pin ?? "");
  if (isError(result)) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
