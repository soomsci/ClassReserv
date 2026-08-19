"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  LUNCH,
  PERIODS,
  ROOMS,
  WEEKDAY_LABELS,
  periodExists,
  periodTime,
} from "@/lib/config";
import {
  addDays,
  mondayOf,
  nowHM,
  shortDate,
  todayISO,
  weekLabel,
  weekdayOf,
  withinTime,
} from "@/lib/date";
import type { PublicReservation, WeekSchedule } from "@/lib/types";
import { gradeClassLabel } from "./ReservationModal";

const REFRESH_MS = 60_000;
const PREF_KEY = "classreserv:boardPrefs";

type Prefs = { big: boolean; dark: boolean };

export default function BoardView() {
  const [view, setView] = useState<"today" | "week">("today");
  const [prefs, setPrefs] = useState<Prefs>({ big: false, dark: false });
  const [schedules, setSchedules] = useState<Record<string, WeekSchedule | null>>({});
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [now, setNow] = useState<string>(nowHM());
  const [today, setToday] = useState<string>(todayISO());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PREF_KEY);
      if (raw) setPrefs(JSON.parse(raw) as Prefs);
    } catch {
      /* 무시 */
    }
  }, []);

  function savePrefs(next: Prefs) {
    setPrefs(next);
    try {
      window.localStorage.setItem(PREF_KEY, JSON.stringify(next));
    } catch {
      /* 무시 */
    }
  }

  const load = useCallback(async () => {
    const monday = mondayOf(todayISO());
    const results = await Promise.all(
      ROOMS.map(async (room) => {
        try {
          const res = await fetch(`/api/schedule?room=${room.id}&monday=${monday}`, {
            cache: "no-store",
          });
          return [room.id, res.ok ? ((await res.json()) as WeekSchedule) : null] as const;
        } catch {
          return [room.id, null] as const;
        }
      }),
    );
    setSchedules(Object.fromEntries(results));
    setUpdatedAt(nowHM());
    setNow(nowHM());
    setToday(todayISO());
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    const clock = setInterval(() => setNow(nowHM()), 30_000);
    return () => {
      clearInterval(timer);
      clearInterval(clock);
    };
  }, [load]);

  const currentPeriod = useMemo(() => {
    for (const p of PERIODS) if (withinTime(now, p.start, p.end)) return p.no;
    return null;
  }, [now]);

  const isLunch = withinTime(now, LUNCH.start, LUNCH.end);
  const weekday = weekdayOf(today);
  const isSchoolDay = weekday <= 5;

  const text = prefs.big ? "text-lg" : "text-sm";

  return (
    <div className={prefs.dark ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className={"mx-auto max-w-[110rem] px-4 py-4 " + text}>
          <header className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className={"font-bold " + (prefs.big ? "text-4xl" : "text-2xl")}>
                특별실 사용 현황
              </h1>
              <p className="text-slate-500 dark:text-slate-400">
                {today} ({WEEKDAY_LABELS[weekday % 7]}) · 현재 {now}
                {isLunch && " · 점심시간"}
                {currentPeriod && ` · ${currentPeriod}교시 진행 중`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Toggle active={view === "today"} onClick={() => setView("today")}>
                오늘
              </Toggle>
              <Toggle active={view === "week"} onClick={() => setView("week")}>
                이번 주
              </Toggle>
              <Toggle active={prefs.big} onClick={() => savePrefs({ ...prefs, big: !prefs.big })}>
                큰 글씨
              </Toggle>
              <Toggle active={prefs.dark} onClick={() => savePrefs({ ...prefs, dark: !prefs.dark })}>
                {prefs.dark ? "밝게" : "어둡게"}
              </Toggle>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg border border-slate-300 px-3 py-1.5 dark:border-slate-700"
              >
                인쇄
              </button>
              <a
                href="/"
                className="rounded-lg border border-slate-300 px-3 py-1.5 dark:border-slate-700"
              >
                예약하기 →
              </a>
            </div>
          </header>

          {view === "today" && !isSchoolDay && (
            <p className="rounded-xl bg-white p-6 text-center text-slate-500 shadow-sm dark:bg-slate-900">
              오늘은 주말입니다. 특별실 예약은 월~금만 운영합니다.
            </p>
          )}

          {view === "today" && isSchoolDay && (
            <div className="grid gap-4 lg:grid-cols-2">
              {ROOMS.map((room) => (
                <TodayCard
                  key={room.id}
                  roomName={room.name}
                  schedule={schedules[room.id] ?? null}
                  date={today}
                  currentPeriod={currentPeriod}
                  big={prefs.big}
                />
              ))}
            </div>
          )}

          {view === "week" && (
            <div className="space-y-4">
              {ROOMS.map((room) => (
                <WeekCard
                  key={room.id}
                  roomName={room.name}
                  schedule={schedules[room.id] ?? null}
                  today={today}
                  big={prefs.big}
                />
              ))}
            </div>
          )}

          <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>최종 갱신 {updatedAt || "—"} · 1분마다 자동 갱신</span>
            <span>교사명은 개인정보 보호를 위해 가운데 글자를 가려 표시합니다.</span>
          </footer>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-lg px-3 py-1.5 font-medium transition " +
        (active
          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
          : "border border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300")
      }
    >
      {children}
    </button>
  );
}

function findSlot(schedule: WeekSchedule | null, date: string, periodNo: number) {
  const fixed = schedule?.fixedBlocks.find((f) => f.date === date && f.periodNo === periodNo);
  const reservation = schedule?.reservations.find(
    (r) => r.date === date && r.periodNo === periodNo,
  );
  const holiday = schedule?.holidays.find((h) => h.date === date);
  return { fixed, reservation, holiday };
}

function TodayCard({
  roomName,
  schedule,
  date,
  currentPeriod,
  big,
}: {
  roomName: string;
  schedule: WeekSchedule | null;
  date: string;
  currentPeriod: number | null;
  big: boolean;
}) {
  const weekday = weekdayOf(date);

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <h2
        className={
          "border-b border-slate-100 px-4 py-3 font-bold dark:border-slate-800 " +
          (big ? "text-2xl" : "text-lg")
        }
      >
        {roomName}
      </h2>
      <ul>
        {PERIODS.filter((p) => periodExists(weekday, p.no)).map((p) => {
          const { fixed, reservation, holiday } = findSlot(schedule, date, p.no);
          const isNow = currentPeriod === p.no;

          return (
            <li
              key={p.no}
              className={
                "flex items-center gap-3 border-b border-slate-50 px-4 py-2.5 last:border-0 dark:border-slate-800/60 " +
                (isNow ? "bg-blue-50 dark:bg-blue-950/40" : "")
              }
            >
              <div className="w-24 shrink-0">
                <div className="font-semibold">
                  {p.no}교시
                  {isNow && (
                    <span className="ml-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white align-middle">
                      진행 중
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  {p.start}~{p.end}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                {holiday ? (
                  <span className="text-slate-400">{holiday.name} (휴업일)</span>
                ) : fixed ? (
                  <span className="text-amber-700 dark:text-amber-400">🔒 {fixed.label}</span>
                ) : reservation ? (
                  <SlotText r={reservation} />
                ) : (
                  <span className="text-slate-300 dark:text-slate-600">비어 있음</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SlotText({ r }: { r: PublicReservation }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <b className="font-semibold">{r.subject}</b>
      <span>{r.maskedName}</span>
      <span className="text-slate-500 dark:text-slate-400">{gradeClassLabel(r)}</span>
      <span className="text-slate-400 dark:text-slate-500">· {r.device}</span>
    </span>
  );
}

function WeekCard({
  roomName,
  schedule,
  today,
  big,
}: {
  roomName: string;
  schedule: WeekSchedule | null;
  today: string;
  big: boolean;
}) {
  const monday = schedule?.monday ?? mondayOf(today);
  const dates = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <h2
        className={
          "flex items-baseline gap-3 border-b border-slate-100 px-4 py-3 font-bold dark:border-slate-800 " +
          (big ? "text-2xl" : "text-lg")
        }
      >
        {roomName}
        <span className="text-xs font-normal text-slate-400">{weekLabel(monday)}</span>
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse">
          <thead>
            <tr>
              <th className="w-16 border-b border-slate-100 px-2 py-2 text-xs text-slate-400 dark:border-slate-800">
                교시
              </th>
              {dates.map((d) => (
                <th
                  key={d}
                  className={
                    "border-b border-l border-slate-100 px-2 py-2 font-semibold dark:border-slate-800 " +
                    (d === today ? "text-blue-600 dark:text-blue-400" : "")
                  }
                >
                  {WEEKDAY_LABELS[weekdayOf(d) % 7]} {shortDate(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p) => (
              <tr key={p.no}>
                <th className="border-b border-slate-50 px-2 py-1.5 text-center text-xs font-medium text-slate-500 dark:border-slate-800/60">
                  {p.no}
                </th>
                {dates.map((date) => {
                  const weekday = weekdayOf(date);
                  const { fixed, reservation, holiday } = findSlot(schedule, date, p.no);

                  if (!periodExists(weekday, p.no)) {
                    return (
                      <td
                        key={date}
                        className="border-b border-l border-slate-50 bg-slate-100/60 dark:border-slate-800/60 dark:bg-slate-800/40"
                      />
                    );
                  }

                  return (
                    <td
                      key={date}
                      className="border-b border-l border-slate-50 px-2 py-1.5 align-top dark:border-slate-800/60"
                    >
                      {holiday ? (
                        <span className="text-xs text-slate-400">{holiday.name}</span>
                      ) : fixed ? (
                        <span className="text-xs text-amber-700 dark:text-amber-400">
                          🔒 {fixed.label}
                        </span>
                      ) : reservation ? (
                        <div className="leading-tight">
                          <div className="truncate font-semibold">{reservation.subject}</div>
                          <div className="truncate text-slate-600 dark:text-slate-300">
                            {reservation.maskedName}
                          </div>
                          <div className="truncate text-xs text-slate-400">
                            {gradeClassLabel(reservation)} · {reservation.device}
                          </div>
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
