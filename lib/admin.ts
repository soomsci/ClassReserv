import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * 관리자 인증.
 * 비밀번호 1개(ADMIN_PASSWORD)로 로그인하고, HMAC 서명된 HttpOnly 쿠키로 8시간 세션을 유지한다.
 */

const COOKIE_NAME = "cr_admin";
const TTL_MS = 8 * 60 * 60 * 1000;

/** 개발 편의를 위한 기본 비밀번호. 운영(NODE_ENV=production)에서는 쓰이지 않는다. */
const DEV_PASSWORD = "admin1234";

const fallbackSecret = randomBytes(32).toString("hex");

function configuredPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}

export function isAdminConfigured(): boolean {
  return configuredPassword().length > 0;
}

/** 운영에서 ADMIN_PASSWORD 가 없으면 로그인 자체를 막는다. */
export function usableDevPassword(): string | null {
  if (isAdminConfigured()) return null;
  return process.env.NODE_ENV === "production" ? null : DEV_PASSWORD;
}

function secret(): string {
  const explicit = process.env.ADMIN_SESSION_SECRET?.trim();
  if (explicit) return explicit;
  const pw = configuredPassword() || usableDevPassword();
  return pw ? `${pw}::classreserv` : fallbackSecret;
}

function sign(expires: number): string {
  const mac = createHmac("sha256", secret()).update(String(expires)).digest("hex");
  return `${expires}.${mac}`;
}

function equal(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkPassword(input: string): boolean {
  const expected = configuredPassword() || usableDevPassword() || "";
  if (!expected) return false;
  return equal(input ?? "", expected);
}

export function makeSessionValue(): { name: string; value: string; maxAge: number } {
  const expires = Date.now() + TTL_MS;
  return { name: COOKIE_NAME, value: sign(expires), maxAge: Math.floor(TTL_MS / 1000) };
}

export function verifySessionValue(value: string | undefined): boolean {
  if (!value) return false;
  const [expStr, mac] = value.split(".");
  if (!expStr || !mac) return false;
  const expires = Number(expStr);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  return equal(sign(expires), value);
}

/** 서버 컴포넌트/라우트에서 현재 요청이 관리자 세션인지 확인 */
export async function isAdminRequest(): Promise<boolean> {
  const store = await cookies();
  return verifySessionValue(store.get(COOKIE_NAME)?.value);
}

export const ADMIN_COOKIE = COOKIE_NAME;
