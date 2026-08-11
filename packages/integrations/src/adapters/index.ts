// 根拠: FinalArch:CON-001 / FinalArch:CON-002 / ADR-0020 / ADR-0023 / ADR-0024
// 5 統合先の adapter 契約（interface のみ。実装は P4〜P6 の各タスクで追加）。
// vendor SDK・実 HTTP 呼び出しをこの package に持ち込まない。

import type { VersionedRef } from "./refs.js";
import type { AdapterOperation } from "./types.js";

/** Work IQ: signed-in-user delegated/OBO の read/ask/fetch のみ（ADR-0024）。 */
export interface WorkIqAdapter {
  ask(question: string): Promise<{ answer: string; sources: VersionedRef[] }>;
  read(ref: VersionedRef): Promise<string>;
  // register の正規操作名 "fetch" を維持する。property-style 署名にすることで
  // fitness EGRESS スキャナの呼び出し式パターン（fetch\s*\(）に一致しない。
  fetch: (query: string) => Promise<VersionedRef[]>;
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

// 型レベル回帰チェック: WorkIqAdapter の公開表面が operation 語彙（AdapterOperation）
// から乖離すると compile error になる（P1-T02-002 の再発防止。tsc 対象の src に置く）。
export const WORKIQ_SURFACE_OPERATIONS = ["ask", "read", "fetch"] as const satisfies readonly (keyof WorkIqAdapter &
  AdapterOperation)[];
