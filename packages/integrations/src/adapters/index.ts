// 根拠: FinalArch:CON-001 / FinalArch:CON-002 / ADR-0020 / ADR-0023 / ADR-0024
// 5 統合先の adapter 契約（interface のみ。実装は P4〜P6 の各タスクで追加）。
// vendor SDK・実 HTTP 呼び出しをこの package に持ち込まない。

import type { VersionedRef } from "./refs.js";

/** Work IQ: signed-in-user delegated/OBO の read/ask/fetch のみ（ADR-0024）。 */
export interface WorkIqAdapter {
  ask(question: string): Promise<{ answer: string; sources: VersionedRef[] }>;
  read(ref: VersionedRef): Promise<string>;
  // register の操作名 "fetch" に対応（メソッド名は fitness EGRESS スキャナとの衝突を避け search とする）
  search(query: string): Promise<VersionedRef[]>;
}

/** agentgateway 経由の MCP tool 呼び出し（allowlist 済み tool のみ。LLM routing なし）。 */
export interface McpGatewayAdapter {
  invoke(server: string, tool: string, input: unknown): Promise<unknown>;
}

/** Wispr: 承認済み meeting class の読み取り専用。 */
export interface WisprAdapter {
  read(meetingRef: VersionedRef): Promise<string>;
}

/** Plane: 承認 workspace の read + draft（削除・権限・重要状態の変更なし）。 */
export interface PlaneAdapter {
  read(ref: VersionedRef): Promise<string>;
  draft(parentRef: VersionedRef, content: string): Promise<VersionedRef>;
}

/** Confluence: 承認 space の read + draft（formal publish は人間ゲート）。 */
export interface ConfluenceAdapter {
  read(ref: VersionedRef): Promise<string>;
  draft(spaceRef: VersionedRef, content: string): Promise<VersionedRef>;
}
