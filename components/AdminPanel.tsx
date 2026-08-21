"use client";

import { useCallback, useEffect, useState } from "react";

import { PERIODS, ROOMS, WEEKDAY_LABELS, roomName } from "@/lib/config";
import { addDays, mondayOf, todayISO } from "@/lib/date";
import type { FixedBlockRow, FixedExceptionRow, HolidayRow } from "@/lib/types";
import { gradeClassLabel } from "./ReservationModal";

type Tab = "fixed" | "holidays" | "reservations" | "privacy";

type AdminReservation = {
  id: string;
  roomId: string;
  date: string;
  periodNo: number;
  subject: string;
  teacherName: string;
  grade: string;
  classNo: string;
  device: string;
  needsAiCoordinator: boolean;
  notes: string;
  status: "active" | "cancelled";
};

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>("fixed");

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">관리자</h1>
          <p className="text-sm text-slate-500">
            고정 점유·휴업일 설정과 예약 관리, 개인정보 삭제를 할 수 있습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          >
            예약 화면
          </a>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/admin/session", { method: "DELETE" });
              window.location.reload();
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          >
            로그아웃
          </button>
        </div>
      </header>

      <nav className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["fixed", "고정 점유"],
            ["holidays", "휴업일"],
            ["reservations", "예약 관리"],
            ["privacy", "개인정보"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              "rounded-lg px-4 py-2 text-sm font-medium " +
              (tab === key
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200")
            }
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "fixed" && <FixedTab />}
      {tab === "holidays" && <HolidayTab />}
      {tab === "reservations" && <ReservationTab />}
      {tab === "privacy" && <PrivacyTab />}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-3 text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

/* ------------------------------- 고정 점유 ------------------------------- */

const WEEKDAY_NAME_TO_NUM: Record<string, number> = {
  "월": 1, "월요일": 1,
  "화": 2, "화요일": 2,
  "수": 3, "수요일": 3,
  "목": 4, "목요일": 4,
  "금": 5, "금요일": 5,
};

type BulkRow = { weekday: number; periodNo: number; label: string; teacherLabel: string };

/** 엑셀에서 복사한 표(탭 구분) 또는 쉼표 구분 텍스트를 파싱한다.
 *  한 줄 형식: 요일  교시  라벨  [담당표시] */
function parseBulkRows(text: string): { items: BulkRow[]; errors: string[] } {
  const items: BulkRow[] = [];
  const errors: string[] = [];

  text.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;

    let cells = line.split("\t").map((c) => c.trim());
    if (cells.length < 3) cells = line.split(",").map((c) => c.trim());
    if (cells.length < 3) cells = line.split(/\s{2,}/).map((c) => c.trim());
    if (cells.length < 3) {
      errors.push(`${idx + 1}행: 요일·교시·라벨을 구분할 수 없습니다 — "${line}"`);
      return;
    }

    const [weekdayRaw, periodRaw, label, teacherLabel = ""] = cells;
    const weekday = WEEKDAY_NAME_TO_NUM[weekdayRaw] ?? Number(weekdayRaw);
    const periodNo = Number(periodRaw);

    if (!weekday || weekday < 1 || weekday > 5) {
      errors.push(`${idx + 1}행: 요일을 알 수 없습니다 — "${weekdayRaw}"`);
      return;
    }
    if (!periodNo || !Number.isInteger(periodNo)) {
      errors.push(`${idx + 1}행: 교시를 알 수 없습니다 — "${periodRaw}"`);
      return;
    }
    if (!label) {
      errors.push(`${idx + 1}행: 표시 이름이 비어 있습니다.`);
      return;
    }

    items.push({ weekday, periodNo, label, teacherLabel });
  });

  return { items, errors };
}

function FixedTab() {
  const [blocks, setBlocks] = useState<FixedBlockRow[]>([]);
  const [exceptions, setExceptions] = useState<FixedExceptionRow[]>([]);
  const [message, setMessage] = useState("");

  const [roomId, setRoomId] = useState(ROOMS[0].id);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [periods, setPeriods] = useState<number[]>([]);
  const [label, setLabel] = useState("");
  const [teacherLabel, setTeacherLabel] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(addDays(todayISO(), 120));

  const [bulkText, setBulkText] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/fixed", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as {
      blocks: FixedBlockRow[];
      exceptions: FixedExceptionRow[];
    };
    setBlocks(data.blocks);
    setExceptions(data.exceptions);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(list: number[], value: number, set: (v: number[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value].sort());
  }

  async function submit() {
    setMessage("");
    const res = await fetch("/api/admin/fixed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, weekdays, periods, label, teacherLabel, startDate, endDate }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "등록에 실패했습니다.");
      return;
    }
    setMessage(`${data.created}개의 고정 점유를 등록했습니다.`);
    setWeekdays([]);
    setPeriods([]);
    setLabel("");
    setTeacherLabel("");
    void load();
  }

  async function submitBulk() {
    setBulkMessage("");
    const { items, errors } = parseBulkRows(bulkText);
    setBulkErrors(errors);

    if (items.length === 0) {
      setBulkMessage(
        errors.length > 0 ? "등록할 수 있는 줄이 없습니다. 형식을 확인해 주세요." : "붙여넣은 내용이 없습니다.",
      );
      return;
    }

    const res = await fetch("/api/admin/fixed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, startDate, endDate, items }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBulkMessage(data.error ?? "등록에 실패했습니다.");
      return;
    }
    setBulkMessage(
      `${data.created}개 등록 완료` + (errors.length > 0 ? ` · 형식 오류 ${errors.length}줄은 건너뛰었습니다.` : ""),
    );
    setBulkText("");
    void load();
  }

  return (
    <>
      <Card title="고정 점유 등록">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>특별실</Label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value as typeof roomId)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {ROOMS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>표시 이름 (예: 정보 정규수업)</Label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="정보 정규수업"
            />
          </div>

          <div>
            <Label>요일 (복수 선택)</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => toggle(weekdays, w, setWeekdays)}
                  className={
                    "h-9 w-9 rounded-lg text-sm font-medium " +
                    (weekdays.includes(w)
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 text-slate-600")
                  }
                >
                  {WEEKDAY_LABELS[w]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>교시 (복수 선택)</Label>
            <div className="flex flex-wrap gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p.no}
                  type="button"
                  onClick={() => toggle(periods, p.no, setPeriods)}
                  className={
                    "h-9 w-9 rounded-lg text-sm font-medium " +
                    (periods.includes(p.no)
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 text-slate-600")
                  }
                >
                  {p.no}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>담당 표시 (선택)</Label>
            <input
              value={teacherLabel}
              onChange={(e) => setTeacherLabel(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="예: 3-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>시작일</Label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <Label>종료일</Label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
          </div>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          해당 요일에 없는 교시(월·수·금 7교시)는 자동으로 제외됩니다.
        </p>

        {message && <p className="mt-2 text-sm text-slate-700">{message}</p>}

        <button
          type="button"
          onClick={submit}
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
        >
          등록
        </button>
      </Card>

      <Card title="여러 개 한 번에 등록 (엑셀 붙여넣기)">
        <p className="mb-2 text-sm text-slate-600">
          위에서 선택한 <b>{roomName(roomId)}</b> · 적용 기간 <b>{startDate} ~ {endDate}</b> 에 등록됩니다.
          엑셀에서 <b>요일 · 교시 · 라벨</b>(선택: 담당 표시) 순서로 표를 만들어 복사한 뒤 그대로 붙여넣으세요.
          한 줄에 한 칸씩, 탭이나 쉼표로 구분됩니다.
        </p>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          rows={6}
          placeholder={"월\t1\t정보 3-1\n월\t2\t정보 3-2\n화\t1\t정보 2-1\n화\t2\t정보 2-2"}
          spellCheck={false}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
        />

        {bulkErrors.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-amber-700">
            {bulkErrors.map((e, i) => (
              <li key={i}>⚠ {e}</li>
            ))}
          </ul>
        )}

        {bulkMessage && <p className="mt-2 text-sm text-slate-700">{bulkMessage}</p>}

        <button
          type="button"
          onClick={submitBulk}
          disabled={!bulkText.trim()}
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:bg-slate-300"
        >
          일괄 등록
        </button>
      </Card>

      <Card title={`등록된 고정 점유 (${blocks.length})`}>
        {blocks.length === 0 ? (
          <p className="text-sm text-slate-500">아직 등록된 고정 점유가 없습니다.</p>
        ) : (
          <div className="space-y-6">
            {ROOMS.filter((room) => blocks.some((b) => b.roomId === room.id)).map((room) => {
              const roomBlocks = blocks.filter((b) => b.roomId === room.id);
              return (
                <div key={room.id}>
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">
                    {room.name}{" "}
                    <span className="font-normal text-slate-400">({roomBlocks.length})</span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[40rem] text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                          <th className="py-2">요일·교시</th>
                          <th>표시 이름</th>
                          <th>적용 기간</th>
                          <th>해제된 날짜</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {roomBlocks.map((b) => (
                          <FixedRow
                            key={b.id}
                            block={b}
                            exceptions={exceptions.filter((e) => e.fixedBlockId === b.id)}
                            onChanged={load}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}

function FixedRow({
  block,
  exceptions,
  onChanged,
}: {
  block: FixedBlockRow;
  exceptions: FixedExceptionRow[];
  onChanged: () => void;
}) {
  const [exDate, setExDate] = useState("");

  async function addException() {
    if (!exDate) return;
    await fetch("/api/admin/exceptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixedBlockId: block.id, date: exDate }),
    });
    setExDate("");
    onChanged();
  }

  return (
    <tr className="border-b border-slate-100 align-top">
      <td className="py-2">
        {WEEKDAY_LABELS[block.weekday]}요일 {block.periodNo}교시
      </td>
      <td>
        {block.label}
        {block.teacherLabel ? ` ${block.teacherLabel}` : ""}
      </td>
      <td className="text-slate-500">
        {block.startDate} ~ {block.endDate}
      </td>
      <td>
        <div className="flex flex-wrap gap-1">
          {exceptions.map((e) => (
            <button
              key={e.id}
              type="button"
              title="해제 취소"
              onClick={async () => {
                await fetch(`/api/admin/exceptions?id=${e.id}`, { method: "DELETE" });
                onChanged();
              }}
              className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-red-50 hover:text-red-700"
            >
              {e.date} ✕
            </button>
          ))}
        </div>
        <div className="mt-1 flex gap-1">
          <input
            type="date"
            value={exDate}
            onChange={(ev) => setExDate(ev.target.value)}
            className="rounded border border-slate-300 px-1.5 py-1 text-xs"
          />
          <button
            type="button"
            onClick={addException}
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          >
            이 날 해제
          </button>
        </div>
      </td>
      <td className="text-right">
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm("이 고정 점유를 삭제할까요?")) return;
            await fetch(`/api/admin/fixed?id=${block.id}`, { method: "DELETE" });
            onChanged();
          }}
          className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
        >
          삭제
        </button>
      </td>
    </tr>
  );
}

/* -------------------------------- 휴업일 -------------------------------- */

function HolidayTab() {
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [date, setDate] = useState(todayISO());
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/holidays", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { holidays: HolidayRow[] };
    setHolidays(data.holidays);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card title="휴업일 / 공휴일">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label>날짜</Label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <div className="flex-1">
          <Label>이름</Label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 개교기념일"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <button
          type="button"
          onClick={async () => {
            setMessage("");
            const res = await fetch("/api/admin/holidays", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date, name }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              setMessage(data.error ?? "등록에 실패했습니다.");
              return;
            }
            setName("");
            void load();
          }}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
        >
          등록
        </button>
      </div>

      {message && <p className="mt-2 text-sm text-red-600">{message}</p>}

      <p className="mt-2 text-xs text-slate-500">
        등록한 날짜는 시간표에서 회색으로 표시되고 예약이 차단됩니다.
      </p>

      <ul className="mt-3 divide-y divide-slate-100">
        {holidays.length === 0 && <li className="py-2 text-sm text-slate-500">등록된 휴업일이 없습니다.</li>}
        {holidays.map((h) => (
          <li key={h.id} className="flex items-center justify-between py-2 text-sm">
            <span>
              <b>{h.date}</b> · {h.name}
            </span>
            <button
              type="button"
              onClick={async () => {
                await fetch(`/api/admin/holidays?id=${h.id}`, { method: "DELETE" });
                void load();
              }}
              className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ------------------------------ 예약 관리 ------------------------------ */

function ReservationTab() {
  const [start, setStart] = useState(mondayOf(todayISO()));
  const [end, setEnd] = useState(addDays(mondayOf(todayISO()), 4));
  const [room, setRoom] = useState("");
  const [rows, setRows] = useState<AdminReservation[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ start, end });
    if (room) params.set("room", room);
    const res = await fetch(`/api/admin/reservations?${params}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { reservations: AdminReservation[] };
    setRows(data.reservations);
    setLoaded(true);
  }, [start, end, room]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportParams = new URLSearchParams({ start, end });
  if (room) exportParams.set("room", room);

  return (
    <Card title="예약 현황">
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div>
          <Label>시작일</Label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <Label>종료일</Label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <Label>특별실</Label>
          <select
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">전체</option>
            {ROOMS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
        >
          조회
        </button>
        <a
          href={`/api/admin/export?${exportParams}`}
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
        >
          CSV 내보내기
        </a>
      </div>

      <p className="mb-2 text-xs text-amber-700">
        이 표에는 원본 교사명과 준비사항이 표시됩니다. 화면 공유 시 주의하세요.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2">날짜</th>
              <th>특별실</th>
              <th>교시</th>
              <th>과목</th>
              <th>교사명</th>
              <th>학년·반</th>
              <th>기기</th>
              <th>AI코디</th>
              <th>준비사항</th>
              <th>상태</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loaded && rows.length === 0 && (
              <tr>
                <td colSpan={11} className="py-4 text-center text-slate-500">
                  해당 기간에 예약이 없습니다.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 align-top">
                <td className="py-2 whitespace-nowrap">{r.date}</td>
                <td className="whitespace-nowrap">{roomName(r.roomId)}</td>
                <td className="whitespace-nowrap">{r.periodNo}교시</td>
                <td>{r.subject}</td>
                <td>{r.teacherName}</td>
                <td className="whitespace-nowrap">{gradeClassLabel(r)}</td>
                <td>{r.device}</td>
                <td className="whitespace-nowrap">{r.needsAiCoordinator ? "필요" : "-"}</td>
                <td className="max-w-[16rem] text-slate-600">{r.notes}</td>
                <td className={r.status === "active" ? "text-slate-700" : "text-slate-400"}>
                  {r.status === "active" ? "예약" : "취소됨"}
                </td>
                <td className="text-right">
                  {r.status === "active" && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm("이 예약을 강제로 취소할까요?")) return;
                        await fetch(`/api/admin/reservations?id=${r.id}`, { method: "DELETE" });
                        void load();
                      }}
                      className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
                    >
                      강제 취소
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ------------------------------- 개인정보 ------------------------------- */

function PrivacyTab() {
  const [beforeDate, setBeforeDate] = useState(todayISO());
  const [message, setMessage] = useState("");

  return (
    <Card title="개인정보 삭제 (익명화)">
      <p className="mb-3 text-sm text-slate-600">
        기준 날짜 <b>이전</b> 예약에서 교사명과 준비사항을 지웁니다. 특별실·날짜·교시·과목·학년반·기기
        정보는 통계용으로 남습니다. 되돌릴 수 없습니다.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label>기준 날짜</Label>
          <input
            type="date"
            value={beforeDate}
            onChange={(e) => setBeforeDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm(`${beforeDate} 이전 예약의 이름·준비사항을 지웁니다. 계속할까요?`))
              return;
            setMessage("");
            const res = await fetch("/api/admin/anonymize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ beforeDate }),
            });
            const data = await res.json();
            setMessage(res.ok ? `${data.count}건을 익명화했습니다.` : (data.error ?? "실패했습니다."));
          }}
          className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white"
        >
          익명화 실행
        </button>
      </div>

      {message && <p className="mt-2 text-sm text-slate-700">{message}</p>}

      <p className="mt-4 text-xs text-slate-500">
        학년도 종료 후 한 번씩 실행하는 것을 권장합니다.
      </p>
    </Card>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-sm font-medium text-slate-700">{children}</label>;
}
