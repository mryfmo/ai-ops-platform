/**
 * packages/web/src/server/viewSpec.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード：チャットによる動的表示切替）。
 *   チャットのtool call結果として返す「どのビューを表示するか」の宣言的な仕様（ViewSpec）を定義する。
 *   CLAUDE.md設計原則2（数値・色・表はコード算出、LLMは表示パラメータのみ）に従い、
 *   LLMが決定してよいのはViewSpec（=表示するビューの種類・表示パラメータ）のみであり、
 *   実データ（数値・件数等）はこのモジュールには一切含まれない。実データの取得は
 *   ViewSpecを受け取った側（DashboardClient）が既存の /api/data/* を呼び出して行う。
 *
 * スコープ: 既存で実装済みのデータ種別（executive-summary / manager-summary / projects /
 *   agent-activity）に対応するViewSpecのみを対象とする。heatmap/dora等、reportData層に
 *   未実装のデータ種別は本タスクの対象外とし、次フェーズで追加する。
 *
 * agentActivity（ADR-0006 4b: AIコーディングエージェント稼働可視化）は現状PRF-G
 *   （DevOpsマネージャー）専用（server/chat/tools.tsのbuildToolsForPersona参照）。
 */

/** マネージャーサマリのバーンダウン集計期間（日数）。未指定時は呼び出し側の既定値（28日）を用いる。 */
export type ManagerSummaryPeriodDays = 7 | 14 | 28;

export type ViewSpec =
  | { kind: "executiveSummary" }
  | { kind: "investorSummary" }
  | { kind: "managerSummary"; periodDays?: ManagerSummaryPeriodDays }
  | { kind: "projectList" }
  | { kind: "agentActivity" };
