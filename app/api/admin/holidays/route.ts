import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";

async function guard() {
  return (await isAdminRequest())
    ? null
    : NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
}

/** GET /api/admin/holidays */
export async function GET() {
  const denied = await guard();
  if (denied) return denied;

  const holidays = await getRepo().listAllHolidays();
  return NextResponse.json({ holidays }, { headers: { "Cache-Control": "no-store" } });
}

/** POST /api/admin/holidays — 휴업일 등록 (해당일 예약 차단) */
export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  const { date, name } = (await req.json().catch(() => ({}))) as {
    date?: string;
    name?: string;
  };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: "날짜를 확인해 주세요." }, { status: 400 });
  if (!name?.trim())
    return NextResponse.json({ error: "휴업일 이름을 입력해 주세요." }, { status: 400 });

  await getRepo().createHoliday(date, name.trim());
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** DELETE /api/admin/holidays?id=... */
export async function DELETE(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  await getRepo().deleteHoliday(id);
  return NextResponse.json({ ok: true });
}
