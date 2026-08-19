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
}
