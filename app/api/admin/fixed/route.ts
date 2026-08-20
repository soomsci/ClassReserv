import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin";
import { PERIODS, ROOMS, periodExists } from "@/lib/config";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";

async function guard() {
  return (await isAdminRequest())
    ? null
    : NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
}

/** GET /api/admin/fixed — 고정 점유 전체 목록 */
export async function GET() {
  const denied = await guard();
  if (denied) return denied;

  const data = await getRepo().listAllFixedBlocks();
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

type BulkItem = {
  weekday: number;
  periodNo: number;
  label: string;
  teacherLabel?: string;
};

type CreateBody = {
  roomId: string;
  startDate: string;
  endDate: string;
  // 방식 1: 요일·교시를 다중 선택해 같은 라벨로 한 번에 등록
  weekdays?: number[];
  periods?: number[];
  label?: string;
  teacherLabel?: string;
  // 방식 2: 붙여넣기로 요일·교시·라벨이 서로 다른 여러 줄을 한 번에 등록
  items?: BulkItem[];
};

/** POST /api/admin/fixed — 요일·교시를 여러 개 골라 한 번에 등록, 또는 items로 여러 줄을 한 번에 등록 */
export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  if (!ROOMS.some((r) => r.id === body.roomId))
    return NextResponse.json({ error: "특별실을 선택해 주세요." }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(body.endDate))
    return NextResponse.json({ error: "적용 기간을 올바르게 입력해 주세요." }, { status: 400 });
  if (body.startDate > body.endDate)
    return NextResponse.json({ error: "종료일이 시작일보다 빠릅니다." }, { status: 400 });

  const repo = getRepo();
  let created = 0;

  if (Array.isArray(body.items)) {
    if (body.items.length === 0)
      return NextResponse.json({ error: "등록할 항목이 없습니다." }, { status: 400 });

    for (const item of body.items) {
      const weekday = Number(item.weekday);
      const periodNo = Number(item.periodNo);
      const label = (item.label ?? "").trim();
      if (weekday < 1 || weekday > 5) continue;
      if (!PERIODS.some((p) => p.no === periodNo)) continue;
      if (!periodExists(weekday, periodNo)) continue; // 해당 요일에 없는 교시는 건너뛴다
      if (!label) continue;
      await repo.createFixedBlock({
        roomId: body.roomId,
        weekday,
        periodNo,
        label,
        teacherLabel: item.teacherLabel?.trim() || null,
        startDate: body.startDate,
        endDate: body.endDate,
        isActive: true,
      });
      created += 1;
    }

    return NextResponse.json({ created }, { status: 201 });
  }

  if (!body.weekdays?.length || !body.periods?.length)
    return NextResponse.json({ error: "요일과 교시를 선택해 주세요." }, { status: 400 });
  if (!body.label?.trim())
    return NextResponse.json({ error: "표시할 이름(라벨)을 입력해 주세요." }, { status: 400 });

  for (const weekday of body.weekdays) {
    if (weekday < 1 || weekday > 5) continue;
    for (const periodNo of body.periods) {
      if (!PERIODS.some((p) => p.no === periodNo)) continue;
      if (!periodExists(weekday, periodNo)) continue; // 해당 요일에 없는 교시는 건너뛴다
      await repo.createFixedBlock({
        roomId: body.roomId,
        weekday,
        periodNo,
        label: body.label.trim(),
        teacherLabel: body.teacherLabel?.trim() || null,
        startDate: body.startDate,
        endDate: body.endDate,
        isActive: true,
      });
      created += 1;
    }
  }

  return NextResponse.json({ created }, { status: 201 });
}

/** DELETE /api/admin/fixed?id=... */
export async function DELETE(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  await getRepo().deleteFixedBlock(id);
  return NextResponse.json({ ok: true });
}
