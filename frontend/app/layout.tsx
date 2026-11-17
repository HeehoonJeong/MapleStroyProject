import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MapleStory Chatbot",
  description: "공식 공지와 게임 문서를 검색해 답하는 메이플스토리 AI 챗봇",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
