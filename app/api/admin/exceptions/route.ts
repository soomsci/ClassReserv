import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";

async function guard() {
  return (await isAdminRequest())
    ? null
    : NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
}

/** POST /api/admin/exceptions — 특정 날짜만 고정 점유 해제 */
export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  const { fixedBlockId, date } = (await req.json().catch(() => ({}))) as {
    fixedBlockId?: string;
    date?: string;
  };
  if (!fixedBlockId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: "고정 점유와 날짜를 확인해 주세요." }, { status: 400 });

  await getRepo().addFixedException(fixedBlockId, date);
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** DELETE /api/admin/exceptions?id=... — 해제 취소 */
export async function DELETE(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  await getRepo().deleteFixedException(id);
  return NextResponse.json({ ok: true });
}
