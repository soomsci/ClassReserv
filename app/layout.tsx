import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "특별실 예약",
  description: "학교 특별실(컴퓨터실·AI실) 주간 예약 및 현황판",
  // 교사 이름이 표시되는 화면이므로 검색엔진 색인을 막는다.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
