import { NextResponse } from "next/server";

import { clientKey, rateLimit } from "@/lib/ratelimit";
import { isError, verifyPin } from "@/lib/service";

export const dynamic = "force-dynamic";

/** POST /api/reservations/[id]/verify — PIN 확인 후 본인에게만 전체 내용 반환 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!rateLimit(clientKey(req, "verify"), 20, 60_000)) {
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const { id } = await ctx.params;
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };

  const result = await verifyPin(id, pin ?? "");
  if (isError(result)) return NextResponse.json(result, { status: 403 });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
