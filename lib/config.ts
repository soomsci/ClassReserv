/**
 * 학교 운영 설정값.
 * M3(관리자 페이지)에서 DB settings 테이블로 옮겨 편집 가능하게 만들 예정이며,
 * 지금은 이 파일의 값이 초기값 겸 기본값 역할을 한다.
 */

export type RoomId = "computer" | "ai";

export const ROOMS: { id: RoomId; name: string; sortOrder: number }[] = [
  { id: "computer", name: "컴퓨터실", sortOrder: 1 },
  { id: "ai", name: "AI실", sortOrder: 2 },
];

export function roomName(id: string): string {
  return ROOMS.find((r) => r.id === id)?.name ?? id;
}

/** 45분 수업 + 10분 쉬는 시간, 점심 12:20~13:20 */
export const PERIODS: { no: number; start: string; end: string }[] = [
  { no: 1, start: "08:50", end: "09:35" },
  { no: 2, start: "09:45", end: "10:30" },
  { no: 3, start: "10:40", end: "11:25" },
  { no: 4, start: "11:35", end: "12:20" },
  { no: 5, start: "13:20", end: "14:05" },
  { no: 6, start: "14:15", end: "15:00" },
  { no: 7, start: "15:10", end: "15:55" },
];

export const LUNCH = { afterPeriod: 4, start: "12:20", end: "13:20" };

/** 요일(1=월 ~ 5=금)별 마지막 교시 */
export const WEEKDAY_MAX_PERIOD: Record<number, number> = {
  1: 6,
  2: 7,
  3: 6,
  4: 7,
  5: 6,
};

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function periodExists(weekday: number, periodNo: number): boolean {
  const max = WEEKDAY_MAX_PERIOD[weekday];
  return max !== undefined && periodNo <= max;
}

export function periodTime(no: number): { start: string; end: string } {
  const p = PERIODS.find((x) => x.no === no);
  return p ? { start: p.start, end: p.end } : { start: "", end: "" };
}

export const SUBJECTS = [
  "국어",
  "수학",
  "영어",
  "사회",
  "역사",
  "과학",
  "정보",
  "기술가정",
  "미술",
  "음악",
  "체육",
  "도덕",
  "창의적체험활동",
  "자유학기",
  "방과후",
  "기타",
];

/** roomId가 null이면 모든 특별실 공통 항목 */
export const DEVICES: { name: string; roomId: RoomId | null }[] = [
  { name: "데스크톱PC", roomId: null },
  { name: "노트북", roomId: null },
  { name: "태블릿", roomId: null },
  { name: "VR기기", roomId: "ai" },
  { name: "AI학습도구", roomId: "ai" },
  { name: "3D프린터", roomId: "ai" },
  { name: "기기 미사용", roomId: null },
  { name: "기타", roomId: null },
];

export function devicesForRoom(roomId: string): string[] {
  return DEVICES.filter((d) => d.roomId === null || d.roomId === roomId).map((d) => d.name);
}

export const GRADE_OPTIONS = [
  { value: "1", label: "1학년" },
  { value: "2", label: "2학년" },
  { value: "3", label: "3학년" },
  { value: "all", label: "전학년" },
  { value: "none", label: "해당없음" },
];

/** 학년별 반 수 (1·2·3학년 각 4반) */
export const CLASS_COUNT: Record<string, number> = { "1": 4, "2": 4, "3": 4 };

export function classOptions(grade: string): { value: string; label: string }[] {
  const count = CLASS_COUNT[grade];
  const base = count
    ? Array.from({ length: count }, (_, i) => ({ value: String(i + 1), label: `${i + 1}반` }))
    : [];
  return [...base, { value: "all", label: "전체" }, { value: "none", label: "해당없음" }];
}

/** 예약 가능 범위: 이번 주 + 향후 N주 */
export const BOOKING_WEEKS_AHEAD = 3;

/** 준비사항 최대 길이 */
export const NOTES_MAX = 500;

/** PIN 오류 잠금 정책 */
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 10;
