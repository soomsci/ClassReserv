import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  FixedBlockRow,
  FixedExceptionRow,
  HolidayRow,
  ReservationRow,
} from "@/lib/types";
import type { CreateResult, NewReservation, ReservationPatch, Repo } from "./types";

/**
 * 운영용 Supabase 어댑터.
 * 서비스 키를 쓰므로 서버(라우트 핸들러)에서만 import 되어야 한다.
 */

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

type DbReservation = {
  id: string;
  room_id: string;
  date: string;
  period_no: number;
  subject: string;
  teacher_name: string;
  grade: string;
  class_no: string;
  device: string;
  notes: string | null;
  pin_hash: string;
  failed_count: number;
  locked_until: string | null;
  status: "active" | "cancelled";
  is_anonymized: boolean;
  created_at: string;
  updated_at: string;
};

function toRow(r: DbReservation): ReservationRow {
  return {
    id: r.id,
    roomId: r.room_id,
    date: r.date,
    periodNo: r.period_no,
    subject: r.subject,
    teacherName: r.teacher_name,
    grade: r.grade,
    classNo: r.class_no,
    device: r.device,
    notes: r.notes,
    pinHash: r.pin_hash,
    failedCount: r.failed_count,
    lockedUntil: r.locked_until,
    status: r.status,
    isAnonymized: r.is_anonymized,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const supabaseRepo: Repo = {
  kind: "supabase",

  async listReservations(roomId, start, end) {
    const { data, error } = await db()
      .from("reservations")
      .select("*")
      .eq("room_id", roomId)
      .eq("status", "active")
      .gte("date", start)
      .lte("date", end);
    if (error) throw new Error(error.message);
    return (data as DbReservation[]).map(toRow);
  },

  async getReservation(id) {
    const { data, error } = await db().from("reservations").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toRow(data as DbReservation) : null;
  },

  async createReservation(row: NewReservation): Promise<CreateResult> {
    const { data, error } = await db()
      .from("reservations")
      .insert({
        room_id: row.roomId,
        date: row.date,
        period_no: row.periodNo,
        subject: row.subject,
        teacher_name: row.teacherName,
        grade: row.grade,
        class_no: row.classNo,
        device: row.device,
        notes: row.notes,
        pin_hash: row.pinHash,
      })
      .select("id")
      .single();

    // 23505 = unique_violation → 같은 칸에 이미 예약이 있음
    if (error) {
      if (error.code === "23505") return { ok: false, reason: "conflict" };
      throw new Error(error.message);
    }
    return { ok: true, id: (data as { id: string }).id };
  },

  async updateReservation(id, patch: ReservationPatch) {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.subject !== undefined) payload.subject = patch.subject;
    if (patch.teacherName !== undefined) payload.teacher_name = patch.teacherName;
    if (patch.grade !== undefined) payload.grade = patch.grade;
    if (patch.classNo !== undefined) payload.class_no = patch.classNo;
    if (patch.device !== undefined) payload.device = patch.device;
    if (patch.notes !== undefined) payload.notes = patch.notes;

    const { error } = await db().from("reservations").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  },

  async cancelReservation(id) {
    const { error } = await db()
      .from("reservations")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },

  async setPinState(id, failedCount, lockedUntil) {
    const { error } = await db()
      .from("reservations")
      .update({ failed_count: failedCount, locked_until: lockedUntil })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },

  async listFixedBlocks(roomId, start, end) {
    const { data, error } = await db()
      .from("fixed_blocks")
      .select("*")
      .eq("room_id", roomId)
      .eq("is_active", true)
      .lte("start_date", end)
      .gte("end_date", start);
    if (error) throw new Error(error.message);

    const blocks: FixedBlockRow[] = (data as Record<string, never>[]).map((b) => ({
      id: b.id,
      roomId: b.room_id,
      weekday: b.weekday,
      periodNo: b.period_no,
      label: b.label,
      teacherLabel: b.teacher_label ?? null,
      startDate: b.start_date,
      endDate: b.end_date,
      isActive: b.is_active,
    }));

    if (blocks.length === 0) return { blocks, exceptions: [] };

    const { data: exData, error: exError } = await db()
      .from("fixed_exceptions")
      .select("*")
      .in(
        "fixed_block_id",
        blocks.map((b) => b.id),
      )
      .gte("date", start)
      .lte("date", end);
    if (exError) throw new Error(exError.message);

    const exceptions: FixedExceptionRow[] = (exData as Record<string, never>[]).map((e) => ({
      id: e.id,
      fixedBlockId: e.fixed_block_id,
      date: e.date,
    }));

    return { blocks, exceptions };
  },

  async listHolidays(start, end) {
    const { data, error } = await db()
      .from("holidays")
      .select("*")
      .gte("date", start)
      .lte("date", end);
    if (error) throw new Error(error.message);
    return (data as HolidayRow[]).map((h) => ({ id: h.id, date: h.date, name: h.name }));
  },
};
