import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const suit = localFont({
  src: "./fonts/SUIT-Variable.woff2",
  variable: "--font-suit",
  display: "swap",
  weight: "100 900",
  adjustFontFallback: "Arial",
});

export const metadata: Metadata = {
  title: "MapleStory Chatbot",
  description: "공식 공지와 게임 문서를 검색해 답하는 메이플스토리 AI 챗봇",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={suit.variable}>
      <body>{children}</body>
    </html>
  );
}
