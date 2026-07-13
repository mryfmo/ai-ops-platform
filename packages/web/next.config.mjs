/**
 * packages/web/next.config.mjs
 *
 * 根拠: ADR-0005（常駐サーバ + WebUIダッシュボード + Teams統合）
 *   - output "standalone": コンテナ配備向けの自己完結ビルド
 *   - basePath "/app": server（Hono）のリバースプロキシ配下 /app で配信
 *   - transpilePackages: モノレポ内ESMワークスペースパッケージをNext.jsビルドで変換
 *   - outputFileTracingRoot: pnpmモノレポのルートを明示（トレース対象の正確化）
 *
 * 注意1: ビルド時に ANTHROPIC_API_KEY 等の環境変数を要求しない構成を維持する
 * （環境変数はランタイム参照。ビルド時評価されるモジュールに秘匿情報を置かない）。
 * 注意2: Windows開発機では standalone 出力のトレースコピーが pnpm の symlink 構造を
 * symlink(2) で複製しようとして EPERM になる（Developer Mode/管理者権限が必要）。
 * このため win32 では standalone を無効化する（コンテナ/CI は Linux のため常に有効。
 * Windows で強制したい場合は WEB_FORCE_STANDALONE=1 を指定）。
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const enableStandalone = process.platform !== "win32" || process.env.WEB_FORCE_STANDALONE === "1";

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next App Router emits inline bootstrap scripts; unsafe-inline is the minimum relaxation without per-request nonces.
  "script-src 'self' 'unsafe-inline'",
  // ChatPanel has one React inline style; keep styles self-hosted apart from that existing attribute.
  "style-src 'self' 'unsafe-inline'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(enableStandalone ? { output: "standalone" } : {}),
  basePath: "/app",
  transpilePackages: ["@aiops/shared", "@aiops/prjops", "@aiops/devops"],
  outputFileTracingRoot: repoRoot,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
