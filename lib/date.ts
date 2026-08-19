/**
 * 날짜 유틸. 저장·비교는 모두 'YYYY-MM-DD' 문자열로 하고,
 * "지금"은 항상 Asia/Seoul 기준으로 계산한다.
 */

const TZ = "Asia/Seoul";

function seoulParts(d: Date = new Date()): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const out: Record<string, string> = {};
  for (const p of parts) out[p.type] = p.value;
  return out;
}

/** 서울 기준 오늘 (YYYY-MM-DD) */
export function todayISO(): string {
  const p = seoulParts();
  return `${p.year}-${p.month}-${p.day}`;
}

/** 서울 기준 현재 시각 (HH:MM) */
export function nowHM(): string {
  const p = seoulParts();
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${hour}:${p.minute}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86400000;
  const dt = new Date(t);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

/** 1=월 ... 7=일 */
export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=일
  return day === 0 ? 7 : day;
}

/** 해당 날짜가 속한 주의 월요일 */
export function mondayOf(iso: string): string {
  return addDays(iso, -(weekdayOf(iso) - 1));
}

/** 월~금 5일치 날짜 */
export function weekDates(monday: string): string[] {
  return [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
}

/** 두 날짜 사이의 일 수 (b - a) */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** '8/17' */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/** '2026-08-17 ~ 08-21 (8월 3주)' */
export function weekLabel(monday: string): string {
  const friday = addDays(monday, 4);
  const [, m, d] = monday.split("-");
  const [, fm, fd] = friday.split("-");
  const nth = Math.ceil(Number(d) / 7);
  return `${monday} ~ ${fm}-${fd} (${Number(m)}월 ${nth}주)`;
}

/** 해당 날짜·교시가 이미 지났는지 (교시 종료 시각 기준) */
export function isPastSlot(date: string, periodEnd: string): boolean {
  const today = todayISO();
  if (date < today) return true;
  if (date > today) return false;
  return nowHM() >= periodEnd;
}

/** 'HH:MM' 이 [start, end) 범위에 있는지 */
export function withinTime(hm: string, start: string, end: string): boolean {
  return hm >= start && hm < end;
}
