"use client";

import { useState } from "react";

export default function AdminLogin({ devPassword }: { devPassword: string | null }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "로그인에 실패했습니다.");
        return;
      }
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h1 className="mb-1 text-lg font-bold text-slate-900">관리자 로그인</h1>
      <p className="mb-4 text-sm text-slate-500">고정 점유·휴업일·예약 관리를 위한 화면입니다.</p>

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && password && !busy) void submit();
        }}
        placeholder="관리자 비밀번호"
        className="w-full rounded-lg border border-slate-300 px-3 py-2"
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        disabled={!password || busy}
        onClick={submit}
        className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:bg-slate-300"
      >
        {busy ? "확인 중…" : "로그인"}
      </button>

      {devPassword && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ADMIN_PASSWORD 환경변수가 없어 개발용 기본 비밀번호(<b>{devPassword}</b>)로 동작합니다.
          배포 전에 반드시 설정하세요.
        </p>
      )}

      <a href="/" className="mt-4 block text-center text-sm text-slate-500 hover:text-slate-800">
        ← 예약 화면으로
      </a>
    </div>
  );
}
