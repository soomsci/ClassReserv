import WeekGrid from "@/components/WeekGrid";
import { isSupabaseConfigured } from "@/lib/repo";

// 개발 모드 안내 배너는 빌드 시점이 아니라 실행 시점의 환경변수로 판단해야 한다.
export const dynamic = "force-dynamic";

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
