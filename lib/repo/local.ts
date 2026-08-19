import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  FixedBlockRow,
  FixedExceptionRow,
  HolidayRow,
  ReservationRow,
} from "@/lib/types";
import type { CreateResult, NewReservation, ReservationPatch, Repo } from "./types";

/**
 * 로컬 개발용 JSON 파일 저장소.
 * Supabase 환경변수가 없을 때만 쓰이며, 운영 배포에서는 사용하지 않는다.
 */

type DbShape = {
  reservations: ReservationRow[];
  fixedBlocks: FixedBlockRow[];
  fixedExceptions: FixedExceptionRow[];
  holidays: HolidayRow[];
};

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "dev.json");

const empty: DbShape = {
  reservations: [],
  fixedBlocks: [],
  fixedExceptions: [],
  holidays: [],
};

/** 쓰기 순서를 보장하기 위한 단순 직렬화 큐 */
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function load(): Promise<DbShape> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return { ...empty, ...(JSON.parse(raw) as Partial<DbShape>) };
  } catch {
    return structuredClone(empty);
  }
}

async function save(db: DbShape): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

export const localRepo: Repo = {
  kind: "local",

  async listReservations(roomId, start, end) {
    const db = await load();
    return db.reservations.filter(
      (r) =>
        r.roomId === roomId &&
        r.status === "active" &&
        r.date >= start &&
        r.date <= end,
    );
  },

  async getReservation(id) {
    const db = await load();
    return db.reservations.find((r) => r.id === id) ?? null;
  },

  async createReservation(row: NewReservation): Promise<CreateResult> {
    return serialize(async () => {
      const db = await load();
      const clash = db.reservations.some(
        (r) =>
          r.status === "active" &&
          r.roomId === row.roomId &&
          r.date === row.date &&
          r.periodNo === row.periodNo,
      );
      if (clash) return { ok: false, reason: "conflict" } as CreateResult;

      const now = new Date().toISOString();
      const created: ReservationRow = {
        ...row,
        id: randomUUID(),
        failedCount: 0,
        lockedUntil: null,
        status: "active",
        isAnonymized: false,
        createdAt: now,
        updatedAt: now,
      };
      db.reservations.push(created);
      await save(db);
      return { ok: true, id: created.id } as CreateResult;
    });
  },

  async updateReservation(id, patch: ReservationPatch) {
    await serialize(async () => {
      const db = await load();
      const row = db.reservations.find((r) => r.id === id);
      if (!row) return;
      Object.assign(row, patch, { updatedAt: new Date().toISOString() });
      await save(db);
    });
  },

  async cancelReservation(id) {
    await serialize(async () => {
      const db = await load();
      const row = db.reservations.find((r) => r.id === id);
      if (!row) return;
      row.status = "cancelled";
      row.updatedAt = new Date().toISOString();
      await save(db);
    });
  },

  async setPinState(id, failedCount, lockedUntil) {
    await serialize(async () => {
      const db = await load();
      const row = db.reservations.find((r) => r.id === id);
      if (!row) return;
      row.failedCount = failedCount;
      row.lockedUntil = lockedUntil;
      await save(db);
    });
  },

  async listFixedBlocks(roomId, start, end) {
    const db = await load();
    const blocks = db.fixedBlocks.filter(
      (b) => b.roomId === roomId && b.isActive && b.startDate <= end && b.endDate >= start,
    );
    const ids = new Set(blocks.map((b) => b.id));
    const exceptions = db.fixedExceptions.filter(
      (e) => ids.has(e.fixedBlockId) && e.date >= start && e.date <= end,
    );
    return { blocks, exceptions };
  },

  async listHolidays(start, end) {
    const db = await load();
    return db.holidays.filter((h) => h.date >= start && h.date <= end);
  },
};
