"use client";

import { useEffect, useState } from "react";

import {
  GRADE_OPTIONS,
  NOTES_MAX,
  SUBJECTS,
  classOptions,
  devicesForRoom,
  periodTime,
  roomName,
} from "@/lib/config";
import { shortDate, weekdayOf } from "@/lib/date";
import { WEEKDAY_LABELS } from "@/lib/config";
import type { OwnerReservation, PublicReservation } from "@/lib/types";

const LAST_NAME_KEY = "classreserv:lastName";
const LAST_SUBJECT_KEY = "classreserv:lastSubject";
const MINE_KEY = "classreserv:mine";

export function rememberMine(id: string) {
  try {
    const raw = window.localStorage.getItem(MINE_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(id)) ids.push(id);
    window.localStorage.setItem(MINE_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    /* localStorage 사용 불가 환경은 무시 */
  }
}

export function readMine(): string[] {
  try {
    const raw = window.localStorage.getItem(MINE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

type Props = {
  roomId: string;
  date: string;
  periodNo: number;
  existing: PublicReservation | null;
  onClose: (changed: boolean) => void;
};

type Form = {
  subject: string;
  teacherName: string;
  grade: string;
  classNo: string;
  device: string;
  needsAiCoordinator: boolean;
  notes: string;
};

const emptyForm: Form = {
  subject: "",
  teacherName: "",
  grade: "",
  classNo: "",
  device: "",
  needsAiCoordinator: false,
  notes: "",
};

export default function ReservationModal({ roomId, date, periodNo, existing, onClose }: Props) {
  const [mode, setMode] = useState<"create" | "view" | "edit">(existing ? "view" : "create");
  const [form, setForm] = useState<Form>(emptyForm);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (existing) return;
    try {
      const lastName = window.localStorage.getItem(LAST_NAME_KEY) ?? "";
      const lastSubject = window.localStorage.getItem(LAST_SUBJECT_KEY) ?? "";
      setForm((f) => ({
        ...f,
        teacherName: lastName || f.teacherName,
        subject: lastSubject || f.subject,
      }));
    } catch {
      /* 무시 */
    }
  }, [existing]);

  const { start, end } = periodTime(periodNo);
  const weekday = WEEKDAY_LABELS[weekdayOf(date) % 7];
  const title = `${roomName(roomId)} · ${shortDate(date)}(${weekday}) ${periodNo}교시 ${start}~${end}`;

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => (key === "grade" ? { ...f, grade: value as string, classNo: "" } : { ...f, [key]: value }));
  }

  async function submitCreate() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, roomId, date, periodNo, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "예약에 실패했습니다.");
        return;
      }
      try {
        window.localStorage.setItem(LAST_NAME_KEY, form.teacherName.trim());
        window.localStorage.setItem(LAST_SUBJECT_KEY, form.subject.trim());
      } catch {
        /* 무시 */
      }
      rememberMine(data.id);
      onClose(true);
    } finally {
      setBusy(false);
    }
  }

  /** PIN 확인 후 수정 폼으로 전환 */
  async function startEdit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/reservations/${existing!.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "PIN 확인에 실패했습니다.");
        return;
      }
      const owner = data as OwnerReservation;
      setForm({
        subject: owner.subject,
        teacherName: owner.teacherName,
        grade: owner.grade,
        classNo: owner.classNo,
        device: owner.device,
        needsAiCoordinator: owner.needsAiCoordinator,
        notes: owner.notes ?? "",
      });
      setMode("edit");
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/reservations/${existing!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, roomId, date, periodNo, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "수정에 실패했습니다.");
        return;
      }
      onClose(true);
    } finally {
      setBusy(false);
    }
  }

  async function submitCancel() {
    if (!window.confirm("이 예약을 취소할까요?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/reservations/${existing!.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "취소에 실패했습니다.");
        return;
      }
      onClose(true);
    } finally {
      setBusy(false);
    }
  }

  const formFilled =
    form.subject.trim() &&
    form.teacherName.trim().length >= 2 &&
    form.grade &&
    form.classNo &&
    form.device;
  const canSubmit = Boolean(formFilled) && /^\d{4}$/.test(pin) && !busy;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(false);
      }}
    >
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={() => onClose(false)}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {mode === "view" && existing && (
          <div className="space-y-4">
            <dl className="grid grid-cols-3 gap-y-2 rounded-xl bg-slate-50 p-4 text-sm">
              <dt className="text-slate-500">과목</dt>
              <dd className="col-span-2 font-medium">{existing.subject}</dd>
              <dt className="text-slate-500">교사</dt>
              <dd className="col-span-2 font-medium">{existing.maskedName}</dd>
              <dt className="text-slate-500">학년·반</dt>
              <dd className="col-span-2 font-medium">{gradeClassLabel(existing)}</dd>
              <dt className="text-slate-500">활용기기</dt>
              <dd className="col-span-2 font-medium">{existing.device}</dd>
              <dt className="text-slate-500">AI 코디네이터</dt>
              <dd className="col-span-2 font-medium">
                {existing.needsAiCoordinator ? "필요 (보조강사 요청)" : "불필요"}
              </dd>
              <dt className="text-slate-500">준비사항</dt>
              <dd className="col-span-2 text-slate-500">
                {existing.hasNotes ? "작성됨 (관리자만 열람)" : "없음"}
              </dd>
            </dl>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                수정·취소하려면 예약할 때 정한 PIN 4자리를 입력하세요
              </label>
              <input
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="w-32 rounded-lg border border-slate-300 px-3 py-2 tracking-[0.4em]"
                placeholder="••••"
                type="password"
              />
              <p className="mt-1 text-xs text-slate-500">
                PIN을 잊으셨다면 관리자에게 문의해 주세요.
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={!/^\d{4}$/.test(pin) || busy}
                onClick={startEdit}
                className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:bg-slate-300"
              >
                수정하기
              </button>
              <button
                type="button"
                disabled={!/^\d{4}$/.test(pin) || busy}
                onClick={submitCancel}
                className="flex-1 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 disabled:opacity-40"
              >
                예약 취소
              </button>
            </div>
          </div>
        )}

        {(mode === "create" || mode === "edit") && (
          <div className="space-y-3">
            <Field label="과목">
              <input
                value={form.subject}
                onChange={(e) => set("subject", e.target.value)}
                maxLength={20}
                list="subject-suggestions"
                placeholder="예: 국어"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <datalist id="subject-suggestions">
                {SUBJECTS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>

            <Field label="교사명">
              <input
                value={form.teacherName}
                onChange={(e) => set("teacherName", e.target.value)}
                maxLength={10}
                placeholder="예: 김철수"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <p className="mt-1 text-xs text-slate-500">
                현황판에는 가운데 글자를 가려 <b>김O수</b> 형태로만 표시됩니다.
              </p>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="학년">
                <select
                  value={form.grade}
                  onChange={(e) => set("grade", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="">선택</option>
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="반">
                <select
                  value={form.classNo}
                  onChange={(e) => set("classNo", e.target.value)}
                  disabled={!form.grade}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                >
                  <option value="">선택</option>
                  {classOptions(form.grade).map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="활용기기">
              <select
                value={form.device}
                onChange={(e) => set("device", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="">선택하세요</option>
                {devicesForRoom(roomId).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>

            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.needsAiCoordinator}
                onChange={(e) => set("needsAiCoordinator", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              AI 코디네이터(보조강사) 필요
            </label>

            <Field label="필요 및 준비사항 (선택)">
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value.slice(0, NOTES_MAX))}
                rows={3}
                placeholder="예: 헤드셋 30개 준비, 프로그램 사전 설치 요청"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <p className="mt-1 text-xs text-amber-700">
                ⚠ 학생 이름 등 개인정보는 적지 마세요. ({form.notes.length}/{NOTES_MAX})
              </p>
            </Field>

            <Field label={mode === "create" ? "수정용 PIN (숫자 4자리)" : "PIN 확인"}>
              <input
                inputMode="numeric"
                maxLength={4}
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="w-32 rounded-lg border border-slate-300 px-3 py-2 tracking-[0.4em]"
                placeholder="••••"
              />
              {mode === "create" && (
                <p className="mt-1 text-xs text-slate-500">
                  나중에 이 예약을 수정·취소할 때 필요합니다. 잊지 마세요.
                </p>
              )}
            </Field>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => onClose(false)}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
              >
                닫기
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={mode === "create" ? submitCreate : submitEdit}
                className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:bg-slate-300"
              >
                {busy ? "처리 중…" : mode === "create" ? "예약하기" : "수정 저장"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

export function gradeClassLabel(r: { grade: string; classNo: string }): string {
  const grade =
    r.grade === "all" ? "전학년" : r.grade === "none" ? "해당없음" : `${r.grade}학년`;
  if (r.grade === "none") return "해당없음";
  const cls = r.classNo === "all" ? "전체" : r.classNo === "none" ? "" : `${r.classNo}반`;
  return cls ? `${grade} ${cls}` : grade;
}
