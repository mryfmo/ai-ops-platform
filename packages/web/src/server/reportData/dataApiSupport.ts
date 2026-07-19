/**
 * packages/web/src/server/reportData/dataApiSupport.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。/api/data/* Route Handler群が共通で必要とする
 *   認可（requireSession + requirePersona）とエラー→HTTPステータス変換をまとめた薄いヘルパー。
 *
 * 設計: 既存 authGuard.ts の requireSession(getSession) と同じDI方針を踏襲し、
 *   getSession/resolver を呼び出し側から注入できる形にする（CLAUDE.md設計原則7:
 *   外部クライアントは注入可能に。web パッケージのユニットテストが next-auth の実行時解決や
 *   実DBに依存しないようにするため）。route.ts 側は本番用の getSession/resolver/db を
 *   組み立てて各ハンドラへ渡す薄い配線のみを担う。
 */
import type { Session } from "next-auth";
import type { PersonaResolver, ResolvedPersona } from "../personaResolver";
import { ConflictError, ForbiddenError, requirePersona, requireSession, UnauthorizedError } from "../authGuard";
import { PrjopsDataAccessDeniedError, PrjopsDataUnavailableError } from "./pinnedPrjopsReportDataProvider";

/** stable subject を requirePersona へ渡す（未認証401/権限外403/選択必須409はここで例外化）。 */
export async function resolvePersonas(
  getSession: () => Promise<Session | null>,
  resolver: PersonaResolver,
  domain?: ResolvedPersona["domain"],
  selectedPersona?: string,
): Promise<ResolvedPersona[]> {
  const session = await requireSession(getSession);
  return requirePersona(session.user.subject, resolver, domain, selectedPersona);
}

/**
 * 既知のauth error（statusプロパティ持ち）をNext.js Responseへ変換する。
 *
 * security-reviewer指摘(中〜高): 401/403以外（DB接続エラー等）で`err.message`をそのまま
 * 返すと、pgのエラーメッセージに含まれうるホスト名・DB名等の内部情報が外部に漏洩しうる。
 * 401/403/409（authGuard.tsが定義する既知の安全な文言のみ）はそのまま返し、それ以外は固定文言のみ
 * 返却し、詳細はサーバ側ログにのみ出力する。
 */
export function toErrorResponse(err: unknown): Response {
  if (
    err instanceof UnauthorizedError ||
    err instanceof ForbiddenError ||
    err instanceof ConflictError ||
    err instanceof PrjopsDataAccessDeniedError ||
    err instanceof PrjopsDataUnavailableError
  ) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error("[api/data] unhandled error:", err);
  return Response.json({ error: "internal server error" }, { status: 500 });
}
