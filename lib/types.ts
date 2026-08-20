/** 서버 내부에서만 다루는 예약 원본 (이름 원본·준비사항·PIN 해시 포함) */
export type ReservationRow = {
  id: string;
  roomId: string;
  date: string; // YYYY-MM-DD
  periodNo: number;
  subject: string;
  teacherName: string;
  grade: string;
  classNo: string;
  device: string;
  needsAiCoordinator: boolean;
  notes: string | null;
  pinHash: string;
  failedCount: number;
  lockedUntil: string | null; // ISO datetime
  status: "active" | "cancelled";
  isAnonymized: boolean;
  createdAt: string;
  updatedAt: string;
};

/** 클라이언트로 내보내는 공개 정보 (마스킹된 이름, 준비사항 제외) */
export type PublicReservation = {
  id: string;
  roomId: string;
  date: string;
  periodNo: number;
  subject: string;
  maskedName: string;
  grade: string;
  classNo: string;
  device: string;
  needsAiCoordinator: boolean;
  hasNotes: boolean;
};

/** PIN 확인 후 본인에게만 돌려주는 전체 내용 */
export type OwnerReservation = {
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
};

export type FixedBlockRow = {
  id: string;
  roomId: string;
  weekday: number; // 1=월 ~ 5=금
  periodNo: number;
  label: string;
  teacherLabel: string | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

/** 특정 날짜에만 고정 점유를 해제하는 예외 */
export type FixedExceptionRow = {
  id: string;
  fixedBlockId: string;
  date: string;
};

export type HolidayRow = {
  id: string;
  date: string;
  name: string;
};

/** 주간 시간표 화면이 필요로 하는 한 주치 데이터 */
export type WeekSchedule = {
  roomId: string;
  monday: string;
  reservations: PublicReservation[];
  fixedBlocks: { date: string; periodNo: number; label: string }[];
  holidays: HolidayRow[];
};

export type ReservationInput = {
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
  pin: string;
};
