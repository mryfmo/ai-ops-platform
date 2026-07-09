/**
 * packages/web/src/app/api/health/route.ts
 *
 * 根拠: ADR-0005（常駐サーバ + WebUIダッシュボード）
 * ヘルスチェック: GET /app/api/health → { ok: true }
 *
 * 各ワークスペースパッケージ（@aiops/shared / @aiops/prjops / @aiops/devops）を
 * import することで、next.config.mjs の transpilePackages がビルドで機能することを
 * 恒常的に検証する（ビルド時に環境変数は不要。実行はランタイムのみ）。
 */
import { isValidId } from "@aiops/shared";
import { judgeStatus } from "@aiops/prjops";
import { calculateRiskScore } from "@aiops/devops";

export const dynamic = "force-dynamic";

export function GET(): Response {
  const workspaceModulesLoaded =
    typeof isValidId === "function" && typeof judgeStatus === "function" && typeof calculateRiskScore === "function";
  return Response.json({ ok: workspaceModulesLoaded });
}
