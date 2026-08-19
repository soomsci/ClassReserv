import type {
  FixedBlockRow,
  FixedExceptionRow,
  HolidayRow,
  ReservationRow,
} from "@/lib/types";

export type NewReservation = Omit<
  ReservationRow,
  "id" | "createdAt" | "updatedAt" | "failedCount" | "lockedUntil" | "status" | "isAnonymized"
>;

export type ReservationPatch = Partial<
  Pick<
    ReservationRow,
    "subject" | "teacherName" | "grade" | "classNo" | "device" | "notes"
  >
>;

export type CreateResult = { ok: true; id: string } | { ok: false; reason: "conflict" };

/**
 * 저장소 인터페이스.
 * 운영은 Supabase, 로컬 개발(환경변수 미설정)은 JSON 파일 어댑터를 쓴다.
 */
export interface Repo {
  kind: "supabase" | "local";

  /** status='active' 인 예약만 반환 */
  listReservations(roomId: string, start: string, end: string): Promise<ReservationRow[]>;
  getReservation(id: string): Promise<ReservationRow | null>;
  createReservation(row: NewReservation): Promise<CreateResult>;
  updateReservation(id: string, patch: ReservationPatch): Promise<void>;
  cancelReservation(id: string): Promise<void>;
  setPinState(id: string, failedCount: number, lockedUntil: string | null): Promise<void>;

  listFixedBlocks(
    roomId: string,
    start: string,
    end: string,
  ): Promise<{ blocks: FixedBlockRow[]; exceptions: FixedExceptionRow[] }>;

  listHolidays(start: string, end: string): Promise<HolidayRow[]>;

  // --- 관리자 전용 ---
  listAllFixedBlocks(): Promise<{ blocks: FixedBlockRow[]; exceptions: FixedExceptionRow[] }>;
  createFixedBlock(row: Omit<FixedBlockRow, "id">): Promise<string>;
  deleteFixedBlock(id: string): Promise<void>;
  addFixedException(fixedBlockId: string, date: string): Promise<void>;
  deleteFixedException(id: string): Promise<void>;

  listAllHolidays(): Promise<HolidayRow[]>;
  createHoliday(date: string, name: string): Promise<void>;
  deleteHoliday(id: string): Promise<void>;

  /** 원본 이름·준비사항 포함. 관리자 화면에서만 사용한다. */
  listReservationsForAdmin(
    start: string,
    end: string,
    roomId?: string,
  ): Promise<ReservationRow[]>;

  /** 지정 날짜 이전 예약의 이름·준비사항을 지우고 통계용 필드만 남긴다. */
  anonymizeBefore(date: string): Promise<number>;
}
