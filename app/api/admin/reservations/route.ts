import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";

async function guard() {
  return (await isAdminRequest())
    ? null
    : NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
}

/**
 * GET /api/admin/reservations?start=&end=&room=
 * 관리자에게만 원본 이름·준비사항을 포함해 반환한다.
 */
export async function GET(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start") ?? "";
  const end = searchParams.get("end") ?? "";
  const room = searchParams.get("room") ?? undefined;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end))
    return NextResponse.json({ error: "조회 기간을 확인해 주세요." }, { status: 400 });

  const rows = await getRepo().listReservationsForAdmin(start, end, room || undefined);

  return NextResponse.json(
    {
      reservations: rows.map((r) => ({
        id: r.id,
        roomId: r.roomId,
        date: r.date,
        periodNo: r.periodNo,
        subject: r.subject,
        teacherName: r.teacherName,
        grade: r.grade,
        classNo: r.classNo,
        device: r.device,
        notes: r.notes ?? "",
        status: r.status,
        createdAt: r.createdAt,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** DELETE /api/admin/reservations?id=... — PIN 없이 강제 취소 */
export async function DELETE(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  await getRepo().cancelReservation(id);
  return NextResponse.json({ ok: true });
}
