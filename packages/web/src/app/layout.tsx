/**
 * packages/web/src/app/layout.tsx
 *
 * 根拠: ADR-0005（常駐サーバ + WebUIダッシュボード）
 * ルートレイアウト: lang="ja"、グローバルCSS読込、共通ヘッダー。
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "AI Ops Platform",
  description: "PrjOps AI基盤 + DevOps運用基盤 WebUIダッシュボード",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50 font-sans text-gray-900 antialiased">
        <header className="border-b border-gray-200 bg-white px-6 py-3">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <span className="text-lg font-bold tracking-tight">AI Ops Platform</span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-6">{children}</main>
      </body>
    </html>
  );
}
