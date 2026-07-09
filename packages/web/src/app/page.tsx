/**
 * packages/web/src/app/page.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード）
 * トップページ（仮）: ダッシュボードへの導線のみを提供するプレースホルダ。
 */
import Link from "next/link";
import { Card } from "../components/ui/Card";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">AI Ops Platform</h1>
      <Card title="ダッシュボード">
        <p className="mb-3 text-sm text-gray-600">プロジェクト進捗・DevOps運用状況のダッシュボードへ移動します。</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        >
          ダッシュボードを開く
        </Link>
      </Card>
    </div>
  );
}
