/**
 * packages/web/src/server/middlewarePolicy.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード認証必須化の判定ロジック）。
 *   spec-reviewer指摘: proxy.ts はNextAuthの`auth()`ラッパーに直接ロジックを
 *   書いており単体テストが無かった（Next.js Proxyは実行にNextAuth設定全体の
 *   解決を要するため）。判定部分のみを外部依存のない純粋関数として切り出し、
 *   CLAUDE.md原則1（lib/=純粋関数とagents/結線層の分離）に沿ってテスト可能にする。
 */

/**
 * `/dashboard`配下（basePath "/app"適用後の相対パス）を未認証で閲覧しようとした場合に
 * リダイレクト先パスを返す。認証済み、または対象外パスならnull。
 */
export function decideDashboardRedirect(pathname: string, isAuthenticated: boolean): string | null {
  if (pathname.startsWith("/dashboard") && !isAuthenticated) {
    return "/login";
  }
  return null;
}
