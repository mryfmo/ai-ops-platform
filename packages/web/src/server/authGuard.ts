/**
 * packages/web/src/server/authGuard.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。/api/data/* や /api/chat 等が今後利用する
 *   認可ゲートの共通部品。本タスクではゲート関数の実装とユニットテストまでを対象とし、
 *   実際のAPI Routeへの接続は次タスクの担当とする。
 *
 * 設計: 呼び出し側（将来のAPI Route）が catch して任意のHTTPステータス（401/403）に
 *   変換できるよう、判別可能なエラークラスを例外として投げる方式にする
 *   （テスト容易性・呼び出し側の自由度を優先）。
 */
import type { Session } from "next-auth";
import type { PersonaResolver, ResolvedPersona } from "./personaResolver";

export class UnauthorizedError extends Error {
  public readonly status = 401 as const;
  constructor(message = "E-AUTH01: authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  public readonly status = 403 as const;
  constructor(message = "E-AUTH02: no matching persona for this account") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Auth.js のセッション取得関数を受け取り、認証済みセッションを検証する。
 * セッション自体の取得方法（auth()）は呼び出し側から注入する
 * （web パッケージのテストが next-auth の実行時解決に依存しないようにするため）。
 */
export async function requireSession(getSession: () => Promise<Session | null>): Promise<Session> {
  const session = await getSession();
  if (!session || !session.user || !session.user.email) {
    throw new UnauthorizedError();
  }
  return session;
}

/**
 * email に対応するペルソナを resolver で解決し、0件であれば ForbiddenError を投げる。
 * domain を指定した場合は該当ドメインのペルソナのみへ絞り込む。
 */
export async function requirePersona(
  email: string,
  resolver: PersonaResolver,
  domain?: ResolvedPersona["domain"],
): Promise<ResolvedPersona[]> {
  const personas = await resolver.resolveByEmail(email);
  const filtered = domain ? personas.filter((p) => p.domain === domain) : personas;
  if (filtered.length === 0) {
    throw new ForbiddenError();
  }
  return filtered;
}
