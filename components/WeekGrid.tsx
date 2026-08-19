"use client";

import { useCallback, useEffect, useState } from "react";

import {
  LUNCH,
  PERIODS,
  ROOMS,
  WEEKDAY_LABELS,
  periodExists,
  periodTime,
} from "@/lib/config";
import { addDays, isPastSlot, mondayOf, shortDate, todayISO, weekLabel, weekdayOf } from "@/lib/date";
import type { PublicReservation, WeekSchedule } from "@/lib/types";
import ReservationModal, { gradeClassLabel, readMine } from "./ReservationModal";

type Target = {
  roomId: string;
  date: string;
  periodNo: number;
  existing: PublicReservation | null;
};

/** 모든 칸의 내용물을 같은 높이로 고정한다 (고정 점유·예약·빈 칸 모두 동일). */
const CELL = "flex h-[3.75rem] w-full ";

export default function WeekGrid() {
  // roomId는 모바일(하루씩 보기)에서 어떤 특별실을 볼지에만 쓰인다.
  // PC에서는 두 특별실을 함께 보여준다.
  const [roomId, setRoomId] = useState<string>(ROOMS[0].id);
  const [monday, setMonday] = useState<string>(() => mondayOf(todayISO()));
  const [schedules, setSchedules] = useState<Record<string, WeekSchedule | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [target, setTarget] = useState<Target | null>(null);
  const [mine, setMine] = useState<string[]>([]);

  useEffect(() => setMine(readMine()), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const results = await Promise.all(
        ROOMS.map(async (room) => {
          const res = await fetch(`/api/schedule?room=${room.id}&monday=${monday}`, {
            cache: "no-store",
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "시간표를 불러오지 못했습니다.");
          return [room.id, (await res.json()) as WeekSchedule] as const;
        }),
      );
      setSchedules(Object.fromEntries(results));
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [monday]);

  useEffect(() => {
    void load();
  }, [load]);

  const dates = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
  const today = todayISO();

  function cellData(room: string, date: string, periodNo: number) {
    const schedule = schedules[room] ?? null;
    const holiday = schedule?.holidays.find((h) => h.date === date);
    const fixed = schedule?.fixedBlocks.find((f) => f.date === date && f.periodNo === periodNo);
    const reservation = schedule?.reservations.find(
      (r) => r.date === date && r.periodNo === periodNo,
    );
    return { holiday, fixed, reservation };
  }

  return (
    <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">특별실 예약</h1>
          <p className="text-sm text-slate-500">빈 칸을 눌러 예약하세요.</p>
        </div>
        <a
          href="/board"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          현황판 보기 →
        </a>
      </header>

      {/* 특별실 탭 — 모바일 전용 (PC는 두 실을 함께 표시) */}
      <div className="mb-3 flex gap-2 sm:hidden">
        {ROOMS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRoomId(r.id)}
            className={
              "rounded-lg px-4 py-2 text-sm font-medium transition " +
              (roomId === r.id
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")
            }
          >
            {r.name}
          </button>
        ))}
      </div>

      {/* 주간 이동 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMonday(addDays(monday, -7))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          ◀ 이전 주
        </button>
        <span className="order-last w-full text-center text-sm font-medium text-slate-700 sm:order-none sm:w-auto sm:min-w-[15rem]">
          {weekLabel(monday)}
        </span>
        <button
          type="button"
          onClick={() => setMonday(addDays(monday, 7))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          다음 주 ▶
        </button>
        <button
          type="button"
          onClick={() => setMonday(mondayOf(todayISO()))}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
        >
          이번 주
        </button>
        {loading && <span className="text-xs text-slate-400">불러오는 중…</span>}
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* 모바일 세로: 선택한 특별실을 하루씩 보기 (표는 가로 스크롤이 필요해 숨긴다) */}
      <div className="sm:hidden">
        <DayList
          roomId={roomId}
          dates={dates}
          today={today}
          mine={mine}
          cellData={cellData}
          onPick={(t) => setTarget(t)}
        />
      </div>

      {/* 태블릿·PC: 두 특별실을 함께 표시 */}
      <div className="hidden space-y-4 sm:block">
        {ROOMS.map((room) => (
          <RoomTable
            key={room.id}
            room={room}
            dates={dates}
            today={today}
            mine={mine}
            cellData={cellData}
            onPick={(t) => setTarget(t)}
          />
        ))}
      </div>

      <Legend />

      {target && (
        <ReservationModal
          roomId={target.roomId}
          date={target.date}
          periodNo={target.periodNo}
          existing={target.existing}
          onClose={(changed) => {
            setTarget(null);
            setMine(readMine());
            if (changed) void load();
          }}
        />
      )}
    </div>
  );
}

type CellReader = (
  room: string,
  date: string,
  periodNo: number,
) => {
  holiday?: { name: string };
  fixed?: { label: string };
  reservation?: PublicReservation;
};

/** PC용 특별실 1개 주간 표 */
function RoomTable({
  room,
  dates,
  today,
  mine,
  cellData,
  onPick,
}: {
  room: { id: string; name: string };
  dates: string[];
  today: string;
  mine: string[];
  cellData: CellReader;
  onPick: (t: Target) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-base font-bold text-slate-900">
        {room.name}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-20 border-b border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-500">
                교시
              </th>
              {dates.map((d) => (
                <th
                  key={d}
                  className={
                    "border-b border-l border-slate-200 px-2 py-2 text-sm font-semibold " +
                    (d === today ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-700")
                  }
                >
                  {WEEKDAY_LABELS[weekdayOf(d) % 7]} {shortDate(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p) => (
              <PeriodRow
                key={p.no}
                roomId={room.id}
                periodNo={p.no}
                dates={dates}
                today={today}
                mine={mine}
                cellData={cellData}
                onPick={onPick}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** 모바일 세로용 하루씩 보기 */
function DayList({
  roomId,
  dates,
  today,
  mine,
  cellData,
  onPick,
}: {
  roomId: string;
  dates: string[];
  today: string;
  mine: string[];
  cellData: CellReader;
  onPick: (t: Target) => void;
}) {
  const [selected, setSelected] = useState<string>(dates.includes(today) ? today : dates[0]);
  const monday = dates[0];

  // 주를 이동하면 그 주의 오늘(없으면 월요일)로 맞춘다.
  useEffect(() => {
    setSelected((prev) => {
      const inWeek = prev >= monday && prev <= addDays(monday, 4);
      if (inWeek) return prev;
      return today >= monday && today <= addDays(monday, 4) ? today : monday;
    });
  }, [monday, today]);

  const weekday = weekdayOf(selected);
  const holiday = cellData(roomId, selected, 1).holiday;
  const periods = PERIODS.filter((p) => periodExists(weekday, p.no));

  return (
    <div>
      <div className="mb-2 grid grid-cols-5 gap-1">
        {dates.map((d) => {
          const active = d === selected;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setSelected(d)}
              className={
                "rounded-lg py-2 text-center transition " +
                (active
                  ? "bg-slate-900 text-white"
                  : d === today
                    ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                    : "bg-white text-slate-600 ring-1 ring-slate-200")
              }
            >
              <div className="text-sm font-semibold">{WEEKDAY_LABELS[weekdayOf(d) % 7]}</div>
              <div className="text-[11px] opacity-80">{shortDate(d)}</div>
            </button>
          );
        })}
      </div>

      {holiday ? (
        <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          {holiday.name} — 휴업일이라 예약할 수 없습니다.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          {periods.map((p) => {
            const { fixed, reservation } = cellData(roomId, selected, p.no);
            const past = isPastSlot(selected, p.end);
            const isMine = reservation ? mine.includes(reservation.id) : false;

            return (
              <li key={p.no} className="border-b border-slate-100 last:border-0">
                {p.no === LUNCH.afterPeriod + 1 && (
                  <div className="border-b border-slate-100 bg-slate-50 py-1 text-center text-[11px] text-slate-500">
                    점심시간 {LUNCH.start} ~ {LUNCH.end}
                  </div>
                )}

                <div className="flex items-stretch gap-2 p-2">
                  <div className="w-16 shrink-0 py-1 text-center">
                    <div className="text-sm font-semibold text-slate-700">{p.no}교시</div>
                    <div className="text-[10px] text-slate-400">{p.start}</div>
                  </div>

                  <div className="min-w-0 flex-1">
                    {fixed ? (
                      <div className="rounded-lg bg-amber-50 px-3 py-2">
                        <div className="text-[11px] font-medium text-amber-800">🔒 고정 점유</div>
                        <div className="truncate text-sm text-amber-900">{fixed.label}</div>
                      </div>
                    ) : reservation ? (
                      <button
                        type="button"
                        onClick={() => onPick({ roomId, date: selected, periodNo: p.no, existing: reservation })}
                        className={
                          "w-full rounded-lg px-3 py-2 text-left " +
                          (isMine ? "bg-blue-100 ring-1 ring-blue-300" : "bg-slate-100")
                        }
                      >
                        <div className="truncate text-sm font-semibold text-slate-800">
                          {reservation.subject} · {reservation.maskedName}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {gradeClassLabel(reservation)} · {reservation.device}
                        </div>
                      </button>
                    ) : past ? (
                      <div className="px-3 py-3 text-xs text-slate-300">지난 시간</div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onPick({ roomId, date: selected, periodNo: p.no, existing: null })}
                        className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-400"
                      >
                        + 예약
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PeriodRow({
  roomId,
  periodNo,
  dates,
  today,
  mine,
  cellData,
  onPick,
}: {
  roomId: string;
  periodNo: number;
  dates: string[];
  today: string;
  mine: string[];
  cellData: CellReader;
  onPick: (t: Target) => void;
}) {
  const { start, end } = periodTime(periodNo);

  return (
    <>
      <tr>
        <th className="border-b border-slate-100 bg-slate-50/60 px-2 py-2 text-center align-middle">
          <div className="text-sm font-semibold text-slate-700">{periodNo}교시</div>
          <div className="text-[11px] text-slate-400">
            {start}~{end}
          </div>
        </th>
        {dates.map((date) => {
          const weekday = weekdayOf(date);
          const { holiday, fixed, reservation } = cellData(roomId, date, periodNo);
          const exists = periodExists(weekday, periodNo);
          const past = isPastSlot(date, end);

          // 칸 높이는 내용과 무관하게 항상 같게 유지한다.
          const base =
            "border-b border-l border-slate-100 p-1.5 align-middle " +
            (date === today ? "bg-blue-50/30 " : "");

          if (!exists) {
            return (
              <td key={date} className={base + "bg-slate-100/70"}>
                <div className={CELL + "items-center justify-center text-[11px] text-slate-400"}>
                  —
                </div>
              </td>
            );
          }

          if (holiday) {
            return (
              <td key={date} className={base + "bg-slate-100/70"}>
                <div className={CELL + "items-center justify-center text-[11px] text-slate-500"}>
                  {holiday.name}
                </div>
              </td>
            );
          }

          if (fixed) {
            return (
              <td key={date} className={base}>
                <div
                  className={
                    CELL +
                    "flex-col justify-center rounded-lg bg-amber-50 px-2 ring-1 ring-amber-100"
                  }
                >
                  <div className="text-[11px] font-medium text-amber-800">🔒 고정</div>
                  <div className="w-full truncate text-[12px] leading-tight text-amber-900">
                    {fixed.label}
                  </div>
                </div>
              </td>
            );
          }

          if (reservation) {
            const isMine = mine.includes(reservation.id);
            return (
              <td key={date} className={base}>
                <button
                  type="button"
                  onClick={() => onPick({ roomId, date, periodNo, existing: reservation })}
                  className={
                    CELL +
                    "flex-col justify-center overflow-hidden rounded-lg px-2 text-left transition " +
                    (isMine
                      ? "bg-blue-100 ring-1 ring-blue-300 hover:bg-blue-200"
                      : "bg-slate-100 hover:bg-slate-200")
                  }
                >
                  <div className="w-full truncate text-[13px] font-semibold leading-tight text-slate-800">
                    {reservation.subject}
                  </div>
                  <div className="w-full truncate text-[12px] leading-tight text-slate-600">
                    {reservation.maskedName}
                  </div>
                  <div className="w-full truncate text-[11px] leading-tight text-slate-500">
                    {gradeClassLabel(reservation)}
                  </div>
                </button>
              </td>
            );
          }

          if (past) {
            return (
              <td key={date} className={base + "bg-slate-50"}>
                <div className={CELL} />
              </td>
            );
          }

          return (
            <td key={date} className={base}>
              <button
                type="button"
                onClick={() => onPick({ roomId, date, periodNo, existing: null })}
                className={
                  CELL +
                  "items-center justify-center rounded-lg border border-dashed border-slate-200 text-[12px] text-slate-400 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-600"
                }
              >
                + 예약
              </button>
            </td>
          );
        })}
      </tr>

      {periodNo === LUNCH.afterPeriod && (
        <tr>
          <td
            colSpan={dates.length + 1}
            className="border-b border-slate-200 bg-slate-100/80 px-3 py-1 text-center text-[11px] tracking-wide text-slate-500"
          >
            점심시간 {LUNCH.start} ~ {LUNCH.end}
          </td>
        </tr>
      )}
    </>
  );
}

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
      <span>
        <span className="mr-1 inline-block h-3 w-3 rounded bg-blue-100 ring-1 ring-blue-300 align-middle" />
        이 기기에서 만든 예약
      </span>
      <span>
        <span className="mr-1 inline-block h-3 w-3 rounded bg-slate-100 align-middle" />
        다른 예약
      </span>
      <span>
        <span className="mr-1 inline-block h-3 w-3 rounded bg-amber-50 ring-1 ring-amber-200 align-middle" />
        고정 점유
      </span>
      <span>교사명은 가운데 글자를 가려 표시합니다.</span>
    </div>
  );
}
