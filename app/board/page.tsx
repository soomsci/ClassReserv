import type { Metadata } from "next";

import BoardView from "@/components/BoardView";

export const metadata: Metadata = {
  title: "특별실 사용 현황",
  robots: { index: false, follow: false },
};

/** 현황판 — 로그인 없이 열람하는 읽기 전용 화면 */
export default function BoardPage() {
  return <BoardView />;
}
