import { NextResponse } from "next/server";

import { ADMIN_COOKIE, checkPassword, makeSessionValue } from "@/lib/admin";
import { clientKey, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** POST /api/admin/session — 관리자 로그인 */
export async function POST(req: Request) {
  if (!rateLimit(clientKey(req, "admin-login"), 10, 60_000)) {
    return NextResponse.json(
      { error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 },
    );
  }

  const { password } = (await req.json().catch(() => ({}))) as { password?: string };

  if (!checkPassword(password ?? "")) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const session = makeSessionValue();
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: session.name,
    value: session.value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: session.maxAge,
  });
  return res;
}

/** DELETE /api/admin/session — 로그아웃 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: ADMIN_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
