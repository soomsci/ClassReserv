import WeekGrid from "@/components/WeekGrid";
import { isSupabaseConfigured } from "@/lib/repo";

export default function ReservePage() {
  const local = !isSupabaseConfigured();

  return (
    <main>
      {local && (
        <div className="bg-amber-100 px-4 py-2 text-center text-xs text-amber-900">
          개발 모드 — Supabase 환경변수가 없어 로컬 파일(<code>.data/dev.json</code>)에 저장하고
          있습니다.
        </div>
      )}
      <WeekGrid />
    </main>
  );
}
