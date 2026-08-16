# P5-T08: Implement source reference and permission-trim evidence

- task_id: P5-T08
- writer: codex-deep-dot（WBS どおり codex）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P5-T02 ✅（main f14fd6d）
- requirement_refs: PRD-007 / FR-M365-001..006
- adr_refs: ADR-0024
- acceptance_gate_ids: WIQ-001 / WIQ-002 / WIQ-005（code/DB 面。
  「real tenant tests」の実行自体は sandbox-m365 到達後 — 本タスクは
  その test harness / 証跡基盤を実行可能な形で整備する）
- risk: medium

## Objective

Work IQ 呼出の **provenance 証跡と permission-trim 検証基盤**:

1. **query receipt 永続化**（`packages/server/src/db/`）: Work IQ ask/fetch の
   呼出ごとに receipt（subject/tenant・tool・question hash（原文não）・
   sourceReferences・permissionContext・provenanceComplete・decisionId 相関・
   結果 status/E-code）を追記専用で記録する repo。**question/response の
   原文は保存しない**（hash + metadata のみ。sanitize 3 層遵守）。
   schema 変更が要る場合は P1-T05 手順（migrations + repo + tests 同一 PR）
2. **source-ref evidence lib**（`packages/integrations/src/workiq/`）:
   - 「results cite accessible sources only」の検証関数:
     ask/fetch 応答の sourceReferences を、同一 user token での fetch
     到達可能性と突き合わせる **accessibility probe**（DI、合成 fixture で
     unit 検証。実 tenant では WIQ-002 two-user differential に使用）
   - permission negative probe: user A の refs を user B の context で
     検証した際に inaccessible が検出される判定ロジック
3. **real-tenant test harness**（実行は後続）: 上記 probe を実 tenant で
   走らせる手順・期待値・記録先を validation に文書化（env 変数名の定義まで。
   実資格情報なし）

## Forbidden

- question/response 原文の DB 保存 / 実資格情報 / app-only
- audit_log の UPDATE/DELETE（追記のみ — receipt テーブルも同方針）
- 依存追加（workspace link が必要なら要 amendment 申請）
- main direct push / merge / approve

## Scope / allowed_paths（WBS + test 規約）

- `packages/integrations/src/workiq/**` + `packages/integrations/tests/**`
- `packages/server/src/db/**` + `packages/server/tests/**`
- schema 変更時: `packages/devops/src/db/migrations/**` + schema.sql
  （P1-T05 手順、要 amendment 申請）
- `.orchestration/**`（証跡）

## Acceptance（WBS）

- results cite accessible sources only（合成 fixture での probe 正負 +
  実 tenant 手順の文書化）

## Validation

- unit/repo tests green / fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P5-T08-workiq-evidence`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P5-T08-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P5-T08 status=ready_for_review

## Scope amendment（2026-08-16、orchestrator 承認 — schema）

- 追加 allowed_paths: `packages/devops/src/db/schema.sql` /
  `packages/devops/src/db/migrations/2026081600xx_work_iq_query_receipts.sql`
  （P1-T05 手順どおり: fresh-DB 形は schema.sql、既存テーブルへの inline ALTER
  禁止、migration + repo + tests 同一 PR）
- 条件:
  1. 新テーブルは **追記専用**（app role へ UPDATE/DELETE 権限を付与しない）
  2. 既存 `tool_invocations` / `audit_log` / approvals 系の変更禁止
  3. DELTA-03 整合: 本テーブルは「delegated /m365/query 経路の receipt」専用。
     gateway 経由 MCP 呼出の receipt（tool_invocations）と**役割重複させない**。
     将来 P5-T04 で Work IQ が gateway 経由になった場合の相関方針
     （decisionId/traceId で相関、二重記録しない）をコード根拠コメントに明記
  4. 原文列（question/response text）を持たない schema であること
