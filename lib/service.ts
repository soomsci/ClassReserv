import "server-only";

import bcrypt from "bcryptjs";

import {
  BOOKING_WEEKS_AHEAD,
  CLASS_COUNT,
  GRADE_OPTIONS,
  NOTES_MAX,
  PERIODS,
  PIN_LOCK_MINUTES,
  PIN_MAX_ATTEMPTS,
  ROOMS,
  devicesForRoom,
  periodExists,
  periodTime,
} from "@/lib/config";
import {
  addDays,
  daysBetween,
  isPastSlot,
  mondayOf,
  todayISO,
  weekDates,
  weekdayOf,
} from "@/lib/date";
import { maskName } from "@/lib/mask";
import { getRepo } from "@/lib/repo";
import type {
  OwnerReservation,
  PublicReservation,
  ReservationInput,
  ReservationRow,
  WeekSchedule,
} from "@/lib/types";

export type ServiceError = { error: string };
export type Result<T> = T | ServiceError;

export function isError<T>(v: Result<T>): v is ServiceError {
  return typeof v === "object" && v !== null && "error" in v;
}

function toPublic(r: ReservationRow): PublicReservation {
  return {
    id: r.id,
    roomId: r.roomId,
    date: r.date,
    periodNo: r.periodNo,
    subject: r.subject,
    maskedName: maskName(r.teacherName),
    grade: r.grade,
    classNo: r.classNo,
    device: r.device,
    needsAiCoordinator: r.needsAiCoordinator,
    hasNotes: Boolean(r.notes && r.notes.trim()),
  };
}

function toOwner(r: ReservationRow): OwnerReservation {
  return {
    id: r.id,
    roomId: r.roomId,
    date: r.date,
    periodNo: r.periodNo,
    subject: r.subject,
    teacherName: r.teacherName,
    grade: r.grade,
    classNo: r.classNo,
    device: r.device,
    needsAiCoordinator: r.needsAiCoordinator,
    notes: r.notes ?? "",
  };
}

/** 한 주(월~금)의 예약·고정 점유·휴업일을 한 번에 조회 */
export async function getWeekSchedule(
  roomId: string,
  mondayInput: string,
): Promise<Result<WeekSchedule>> {
  if (!ROOMS.some((r) => r.id === roomId)) return { error: "알 수 없는 특별실입니다." };

  const monday = mondayOf(mondayInput);
  const friday = addDays(monday, 4);
  const dates = weekDates(monday);
  const repo = getRepo();

  const [reservations, fixed, holidays] = await Promise.all([
    repo.listReservations(roomId, monday, friday),
    repo.listFixedBlocks(roomId, monday, friday),
    repo.listHolidays(monday, friday),
  ]);

  // 고정 점유는 행을 미리 만들지 않고 조회 시 날짜에 합성한다.
  const excepted = new Set(fixed.exceptions.map((e) => `${e.fixedBlockId}|${e.date}`));
  const fixedBlocks: WeekSchedule["fixedBlocks"] = [];

  for (const date of dates) {
    const weekday = weekdayOf(date);
    for (const b of fixed.blocks) {
      if (b.weekday !== weekday) continue;
      if (date < b.startDate || date > b.endDate) continue;
      if (excepted.has(`${b.id}|${date}`)) continue;
      if (!periodExists(weekday, b.periodNo)) continue;
      fixedBlocks.push({
        date,
        periodNo: b.periodNo,
        label: b.teacherLabel ? `${b.label} ${b.teacherLabel}` : b.label,
      });
    }
  }

  return {
    roomId,
    monday,
    reservations: reservations.map(toPublic),
    fixedBlocks,
    holidays,
  };
}

/** 입력값 검증. 문제가 없으면 null */
function validateInput(input: ReservationInput): string | null {
  if (!ROOMS.some((r) => r.id === input.roomId)) return "알 수 없는 특별실입니다.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return "날짜 형식이 올바르지 않습니다.";
  if (!PERIODS.some((p) => p.no === input.periodNo)) return "교시가 올바르지 않습니다.";

  const weekday = weekdayOf(input.date);
  if (weekday > 5) return "주말은 예약할 수 없습니다.";
  if (!periodExists(weekday, input.periodNo)) return "해당 요일에는 없는 교시입니다.";

  const subject = (input.subject ?? "").trim();
  if (subject.length < 1 || subject.length > 20) return "과목은 1~20자로 입력해 주세요.";

  const name = (input.teacherName ?? "").trim();
  if (name.length < 2 || name.length > 10) return "교사명은 2~10자로 입력해 주세요.";

  if (!GRADE_OPTIONS.some((g) => g.value === input.grade)) return "학년을 선택해 주세요.";

  const validClass =
    input.classNo === "all" ||
    input.classNo === "none" ||
    (CLASS_COUNT[input.grade] !== undefined &&
      Number(input.classNo) >= 1 &&
      Number(input.classNo) <= CLASS_COUNT[input.grade]);
  if (!validClass) return "반을 선택해 주세요.";

  if (!devicesForRoom(input.roomId).includes(input.device)) return "활용기기를 선택해 주세요.";
  if ((input.notes ?? "").length > NOTES_MAX)
    return `필요 및 준비사항은 ${NOTES_MAX}자까지 입력할 수 있습니다.`;
  if (!/^\d{4}$/.test(input.pin ?? "")) return "PIN은 숫자 4자리로 입력해 주세요.";

  return null;
}

/** 해당 날짜·교시를 지금 예약할 수 있는지 (지난 시간·예약 가능 범위·휴업일) */
async function checkBookable(
  roomId: string,
  date: string,
  periodNo: number,
): Promise<string | null> {
  const { end } = periodTime(periodNo);
  if (isPastSlot(date, end)) return "이미 지난 시간은 예약할 수 없습니다.";

  const lastBookable = addDays(mondayOf(todayISO()), 7 * BOOKING_WEEKS_AHEAD + 4);
  if (daysBetween(date, lastBookable) < 0)
    return `예약은 이번 주부터 ${BOOKING_WEEKS_AHEAD}주 뒤까지만 가능합니다.`;

  const holidays = await getRepo().listHolidays(date, date);
  if (holidays.length > 0) return `휴업일(${holidays[0].name})에는 예약할 수 없습니다.`;

  const fixed = await getRepo().listFixedBlocks(roomId, date, date);
  const weekday = weekdayOf(date);
  const blocked = fixed.blocks.some(
    (b) =>
      b.weekday === weekday &&
      b.periodNo === periodNo &&
      date >= b.startDate &&
      date <= b.endDate &&
      !fixed.exceptions.some((e) => e.fixedBlockId === b.id && e.date === date),
  );
  if (blocked) return "고정 점유 시간이라 예약할 수 없습니다.";

  return null;
}

export async function createReservation(
  input: ReservationInput,
): Promise<Result<{ id: string }>> {
  const invalid = validateInput(input);
  if (invalid) return { error: invalid };

  const notBookable = await checkBookable(input.roomId, input.date, input.periodNo);
  if (notBookable) return { error: notBookable };

  const pinHash = await bcrypt.hash(input.pin, 10);
  const result = await getRepo().createReservation({
    roomId: input.roomId,
    date: input.date,
    periodNo: input.periodNo,
    subject: input.subject.trim(),
    teacherName: input.teacherName.trim(),
    grade: input.grade,
    classNo: input.classNo,
    device: input.device,
    needsAiCoordinator: Boolean(input.needsAiCoordinator),
    notes: input.notes?.trim() ? input.notes.trim() : null,
    pinHash,
  });

  if (!result.ok) return { error: "방금 다른 분이 같은 시간을 예약했습니다. 새로고침 후 다시 확인해 주세요." };
  return { id: result.id };
}

/** PIN 확인. 성공하면 본인용 전체 정보를 돌려준다. */
export async function verifyPin(id: string, pin: string): Promise<Result<OwnerReservation>> {
  const row = await getRepo().getReservation(id);
  if (!row || row.status !== "active") return { error: "예약을 찾을 수 없습니다." };

  if (row.lockedUntil && new Date(row.lockedUntil) > new Date()) {
    return { error: `PIN 오류가 많아 잠시 잠겼습니다. ${PIN_LOCK_MINUTES}분 뒤 다시 시도해 주세요.` };
  }

  const ok = await bcrypt.compare(pin ?? "", row.pinHash);
  if (!ok) {
    const failed = row.failedCount + 1;
    if (failed >= PIN_MAX_ATTEMPTS) {
      const until = new Date(Date.now() + PIN_LOCK_MINUTES * 60_000).toISOString();
      await getRepo().setPinState(id, 0, until);
      return { error: `PIN을 ${PIN_MAX_ATTEMPTS}회 틀려 ${PIN_LOCK_MINUTES}분간 잠겼습니다.` };
    }
    await getRepo().setPinState(id, failed, null);
    return { error: `PIN이 일치하지 않습니다. (${failed}/${PIN_MAX_ATTEMPTS})` };
  }

  if (row.failedCount !== 0 || row.lockedUntil) await getRepo().setPinState(id, 0, null);
  return toOwner(row);
}

export async function updateReservation(
  id: string,
  pin: string,
  input: ReservationInput,
): Promise<Result<{ id: string }>> {
  const verified = await verifyPin(id, pin);
  if (isError(verified)) return verified;

  // 칸(특별실·날짜·교시) 이동은 지원하지 않는다. 취소 후 다시 예약해야 한다.
  const merged: ReservationInput = {
    ...input,
    roomId: verified.roomId,
    date: verified.date,
    periodNo: verified.periodNo,
    pin,
  };
  const invalid = validateInput(merged);
  if (invalid) return { error: invalid };

  const { end } = periodTime(verified.periodNo);
  if (isPastSlot(verified.date, end)) return { error: "이미 지난 예약은 수정할 수 없습니다." };

  await getRepo().updateReservation(id, {
    subject: merged.subject.trim(),
    teacherName: merged.teacherName.trim(),
    grade: merged.grade,
    classNo: merged.classNo,
    device: merged.device,
    needsAiCoordinator: Boolean(merged.needsAiCoordinator),
    notes: merged.notes?.trim() ? merged.notes.trim() : null,
  });
  return { id };
}

export async function cancelReservation(id: string, pin: string): Promise<Result<{ id: string }>> {
  const verified = await verifyPin(id, pin);
  if (isError(verified)) return verified;

  const { end } = periodTime(verified.periodNo);
  if (isPastSlot(verified.date, end)) return { error: "이미 지난 예약은 취소할 수 없습니다." };

  await getRepo().cancelReservation(id);
  return { id };
}
