import "server-only";

import { localRepo } from "./local";
import { supabaseRepo } from "./supabase";
import type { Repo } from "./types";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** 환경변수가 있으면 Supabase, 없으면 로컬 JSON 파일 저장소 */
export function getRepo(): Repo {
  return isSupabaseConfigured() ? supabaseRepo : localRepo;
}

export type { Repo } from "./types";
