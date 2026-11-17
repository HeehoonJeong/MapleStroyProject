import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maple Story / AI",
  description: "메이플스토리 캐릭터와 게임 데이터를 돕는 AI 어시스턴트",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
