/**
 * packages/web/src/middleware.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。/dashboard 配下（basePath "/app" 配下の
 *   /app/dashboard）を認証必須にする。Next.js の middleware は matcher にも
 *   pathname 判定にも basePath を含めない値（自動的にstrip済み）で動作するため、
 *   "/dashboard" プレフィクスで判定する。未認証時は /login（実URLは /app/login）へ
 *   リダイレクトする。
 *
 * リダイレクト判定自体は server/middlewarePolicy.ts の純粋関数に切り出してあり、
 * 本ファイルはNextAuthの`auth()`ラッパーとNextResponseへ結線するだけの薄い層とする
 * （CLAUDE.md原則1）。
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "./auth";
import { decideDashboardRedirect } from "./server/middlewarePolicy";

export default auth((req: NextRequest & { auth?: unknown }) => {
  const { pathname } = req.nextUrl;
  const redirectTo = decideDashboardRedirect(pathname, Boolean(req.auth));
  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, req.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
