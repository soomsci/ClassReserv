import { isAdminRequest } from "@/lib/admin";
import { NextResponse } from "next/server";

import { periodTime, roomName } from "@/lib/config";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";

function csvCell(value: string): string {
  const v = value ?? "";
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** GET /api/admin/export?start=&end=&room= — 엑셀에서 열리는 CSV 다운로드 */
export async function GET(req: Request) {
  if (!(await isAdminRequest()))
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start") ?? "";
  const end = searchParams.get("end") ?? "";
  const room = searchParams.get("room") ?? undefined;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end))
    return NextResponse.json({ error: "조회 기간을 확인해 주세요." }, { status: 400 });

  const rows = await getRepo().listReservationsForAdmin(start, end, room || undefined);

  const header = [
    "날짜",
    "특별실",
    "교시",
    "시작",
    "종료",
    "과목",
    "교사명",
    "학년",
    "반",
    "활용기기",
    "AI 코디네이터",
    "필요 및 준비사항",
    "상태",
  ];

  const lines = [header.join(",")];
  for (const r of rows) {
    const { start: s, end: e } = periodTime(r.periodNo);
    lines.push(
      [
        r.date,
        roomName(r.roomId),
        `${r.periodNo}교시`,
        s,
        e,
        r.subject,
        r.teacherName,
        r.grade,
        r.classNo,
        r.device,
        r.needsAiCoordinator ? "필요" : "",
        r.notes ?? "",
        r.status === "active" ? "예약" : "취소",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  // 엑셀에서 한글이 깨지지 않도록 BOM 을 붙인다.
  const body = "﻿" + lines.join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reservations_${start}_${end}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
