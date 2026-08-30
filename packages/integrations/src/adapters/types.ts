// 根拠: FinalArch:CON-001 / FinalArch:CON-002 / FinalArch:PRD-005 / ADR-0020 / ADR-0023 / ADR-0024
// 外部統合 adapter の共通契約。vendor SDK をここに import しない（ドメインへの漏出防止は
// tests/no-vendor-sdk.test.ts が機械検証）。fetch 実装とトークン取得は必ず注入する
// （既存 FetchLike / TokenProvider パターン踏襲）。

import type { FetchLike } from "@aiops/shared";

/** 認証トークンの取得を外部へ委譲する（既存 GraphTokenProvider 等と同型）。 */
export interface TokenProvider {
  getAccessToken(): Promise<string>;
}

/** 全 adapter が受け取る注入依存の最小形。 */
export interface AdapterDependencies {
  readonly fetchImpl: FetchLike;
  readonly tokenProvider: TokenProvider;
  readonly baseUrl: string;
}

/** adapter 種別（license register / tool-risk-catalog の製品境界と対応）。 */
export const ADAPTER_KINDS = ["workiq", "mcp-gateway", "wispr", "jira", "plane", "confluence"] as const;
export type AdapterKind = (typeof ADAPTER_KINDS)[number];

/** adapter 操作。register の承認境界（read / draft / ask 等）を型で固定する。 */
export type AdapterOperation = "read" | "ask" | "fetch" | "draft" | "invoke" | "project_development";
