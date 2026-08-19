import { NextResponse } from "next/server";

import { clientKey, rateLimit } from "@/lib/ratelimit";
import { isError, updateReservation } from "@/lib/service";
import type { ReservationInput } from "@/lib/types";

export const dynamic = "force-dynamic";

/** PATCH /api/reservations/[id] — PIN 확인 후 예약 내용 수정 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!rateLimit(clientKey(req, "update"), 20, 60_000)) {
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const { id } = await ctx.params;
  let body: ReservationInput & { pin: string };
  try {
    body = (await req.json()) as ReservationInput & { pin: string };
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const result = await updateReservation(id, body.pin ?? "", body);
  if (isError(result)) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
