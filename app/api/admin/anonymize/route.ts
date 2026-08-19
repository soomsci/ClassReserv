import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/anonymize — 지정 날짜 이전 예약의 이름·준비사항 삭제
 * 통계용 필드(특별실·날짜·교시·과목·학년반·기기)는 남긴다.
 */
export async function POST(req: Request) {
  if (!(await isAdminRequest()))
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });

  const { beforeDate } = (await req.json().catch(() => ({}))) as { beforeDate?: string };
  if (!beforeDate || !/^\d{4}-\d{2}-\d{2}$/.test(beforeDate))
    return NextResponse.json({ error: "기준 날짜를 확인해 주세요." }, { status: 400 });

  const count = await getRepo().anonymizeBefore(beforeDate);
  return NextResponse.json({ count });
}
