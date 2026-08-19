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

type Target = { date: string; periodNo: number; existing: PublicReservation | null };

export default function WeekGrid() {
  const [roomId, setRoomId] = useState<string>(ROOMS[0].id);
  const [monday, setMonday] = useState<string>(() => mondayOf(todayISO()));
  const [schedule, setSchedule] = useState<WeekSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [target, setTarget] = useState<Target | null>(null);
  const [mine, setMine] = useState<string[]>([]);

  useEffect(() => setMine(readMine()), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/schedule?room=${roomId}&monday=${monday}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "시간표를 불러오지 못했습니다.");
        return;
      }
      setSchedule(data as WeekSchedule);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [roomId, monday]);

  useEffect(() => {
    void load();
  }, [load]);

  const dates = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
  const today = todayISO();

  function cellData(date: string, periodNo: number) {
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

      {/* 특별실 탭 */}
      <div className="mb-3 flex gap-2">
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
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMonday(addDays(monday, -7))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          ◀ 이전 주
        </button>
        <span className="min-w-[15rem] text-center text-sm font-medium text-slate-700">
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

      {/* 시간표 */}
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
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
                periodNo={p.no}
                dates={dates}
                today={today}
                mine={mine}
                cellData={cellData}
                onPick={(t) => setTarget(t)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <Legend />

      {target && (
        <ReservationModal
          roomId={roomId}
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

function PeriodRow({
  periodNo,
  dates,
  today,
  mine,
  cellData,
  onPick,
}: {
  periodNo: number;
  dates: string[];
  today: string;
  mine: string[];
  cellData: (date: string, periodNo: number) => {
    holiday?: { name: string };
    fixed?: { label: string };
    reservation?: PublicReservation;
  };
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
          const { holiday, fixed, reservation } = cellData(date, periodNo);
          const exists = periodExists(weekday, periodNo);
          const past = isPastSlot(date, end);

          const base =
            "border-b border-l border-slate-100 px-1.5 py-1.5 align-top h-16 " +
            (date === today ? "bg-blue-50/30 " : "");

          if (!exists) {
            return (
              <td key={date} className={base + "bg-slate-100/70"}>
                <span className="text-[11px] text-slate-400">—</span>
              </td>
            );
          }

          if (holiday) {
            return (
              <td key={date} className={base + "bg-slate-100/70"}>
                <span className="text-[11px] text-slate-500">{holiday.name}</span>
              </td>
            );
          }

          if (fixed) {
            return (
              <td key={date} className={base + "bg-amber-50"}>
                <div className="text-[11px] font-medium text-amber-800">🔒 고정</div>
                <div className="truncate text-[12px] text-amber-900">{fixed.label}</div>
              </td>
            );
          }

          if (reservation) {
            const isMine = mine.includes(reservation.id);
            return (
              <td key={date} className={base}>
                <button
                  type="button"
                  onClick={() => onPick({ date, periodNo, existing: reservation })}
                  className={
                    "h-full w-full rounded-lg px-2 py-1.5 text-left transition " +
                    (isMine
                      ? "bg-blue-100 ring-1 ring-blue-300 hover:bg-blue-200"
                      : "bg-slate-100 hover:bg-slate-200")
                  }
                >
                  <div className="truncate text-[13px] font-semibold text-slate-800">
                    {reservation.subject}
                  </div>
                  <div className="truncate text-[12px] text-slate-600">
                    {reservation.maskedName}
                  </div>
                  <div className="truncate text-[11px] text-slate-500">
                    {gradeClassLabel(reservation)}
                  </div>
                </button>
              </td>
            );
          }

          if (past) {
            return <td key={date} className={base + "bg-slate-50"} />;
          }

          return (
            <td key={date} className={base}>
              <button
                type="button"
                onClick={() => onPick({ date, periodNo, existing: null })}
                className="h-full w-full rounded-lg border border-dashed border-slate-200 text-[12px] text-slate-400 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-600"
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
