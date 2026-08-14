# P4-T04: Integrate gateway with OPA and action ledger

- task_id: P4-T04
- writer: codex-deep-dot（Owner 指示 2026-08-15「codexに実務はやらせるべき」により
  実装実務を worker へ委任。WBS 原記載は writer=claude だが、orchestrator は
  本 task file での仕様確定と adversarial review / acceptance に徹する）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P4-T02 ✅（#231 merged, main a29f13c）/ P4-T03（PR #229 ✅）/ P1-T05 ✅
- requirement_refs: PRD-003 / PRD-005 / FR-MCP-001..007
- adr_refs: ADR-0023
- acceptance_gate_ids: MCP-001
- risk: medium

## Entry 条件と governance（Owner 裁定 2026-08-15 との整合）

- 本タスクは **code-only preparatory integration**: preauthorization /
  receipts のライブラリと結線コードを実装するが、実 gateway / 実 OPA への
  live 結線・enabled 化は行わない（DI mock による integration tests のみ）。
  execution は既存 flag 体系で default 無効
- live 有効化は license register（agentgateway/OPA 行）クローズ後の
  別タスク（環境到達後）。この分割により裁定の
  「P4-T04 以降の結線タスクは register クローズを entry 条件に含める」を
  code-only 部分と live 部分に分けて満たす

## Objective

すべての tool call に policy decision を紐づける:

1. **Tool preauthorization**: tool 呼び出し前に `OpaDecisionClient.decide()`
   （P4-T03）→ 決定を action ledger（P1-T05 `ActionLedgerRepo`）へ記録。
   deny は呼び出し自体を遮断（fail-closed、E-code 伝搬）
2. **Invocation receipts**: 呼び出し結果（成功/失敗/遮断）を ledger に
   追記し、`policyBundleVersion`・decision・decisionId を receipt に常在させる
   （MCP-002 の「bundle version in receipts」結線）
3. **L2/L3 linked approval**: decision = require_approval の場合、既存
   approvals authority（P1-T05 DELTA-03: approvals table が正本）+
   P3-T03 approval workflow へ链接し、承認完了までツール実行を保留。
   auto-approval 禁止（既存不変条件）
4. registry（P4-T02）の allowed_callers / risk を decision input へ正しく
   写像する glue（`PolicyInput` 組み立て）

## 設計制約（既存不変条件の継承）

- lib/agents 分離: 判定・状態遷移は pure lib、結線は薄い層（AGENTS.md 原則 1）
- ledger は追記のみ・三値/status 遷移は P1-T05 の `ActionLedgerStatus` に従う。
  timeout→success 遷移禁止・pending 非再送などの P3 台帳規範を踏襲
- `OpaDecisionClient` の baseUrl は `pathname === "/"` を guard
  （P4-T03 review non-blocking note の解消）
- 外部クライアントは DI（FetchLike / repo 注入）。テストはネットワークなし
- 秘密・実資格情報なし。監査ログは AuditLogWriter.append() のみ

## Scope / allowed_paths（WBS）

- `packages/control-plane/**` / `packages/integrations/**` /
  `packages/server/src/db/**`（必要時の repo 拡張。schema 変更が必要なら
  migrations は P1-T05 手順に従い同一 PR で repo/tests 同伴）
- `.orchestration/**`（証跡）

## Acceptance（WBS）

- every tool call has policy decision（decision なしで実行に到達する経路が
  型/テストで存在しないこと）
- L2/L3 linked approval（require_approval → approvals 正本への链接と保留、
  approve/reject 双方の整合）

## Validation

- integration tests（DI mock: allow / deny / require_approval→approved /
  require_approval→rejected / OPA 障害時 fail-closed 遮断 / receipt に
  bundle version 常在）
- fresh DB で `mise run ci` exit 0（単独判定）

## Artifacts

- report: `.orchestration/reports/P4-T04-REPORT.md`
- validation: `.orchestration/validation/P4-T04-VALIDATION.md`
- review: `.orchestration/reviews/P4-T04-REVIEW.md`（orchestrator=claude が記録）
- acceptance: `.orchestration/acceptance/P4-T04-ACCEPTANCE.md`

## Worker 向け補足（blocked-auth / PR 手順）

- branch `agent/P4-T04-gateway-opa-ledger` を最新 main から作成、
  commit は worker 名義、AIOPS_PR_TOKEN 未保持のため commit 完了後に
  AGMSG-RESULT（head SHA 付き）で通知 → push/PR は orchestrator が App token で代行
- PR は draft 禁止。fresh DB `mise run ci` exit 0 を validation に記録
- 既存 approvals / action ledger の repo 実装（P1-T05）と P3-T03 approval
  workflow の契約を必ず読み込み、DELTA-03（approvals 正本、並行 authority
  新設禁止）を遵守

## Scope amendment（2026-08-15、orchestrator 承認）

- 追加 allowed_paths（P4-T03 review non-blocking note の解消のため、最小限）:
  - `packages/policy/src/decisionClient.ts`（baseUrl `pathname === "/"` guard の追加のみ）
  - `packages/policy/tests/decisionClient.test.ts`（同 guard の test）
- 上記以外の packages/policy/** は変更禁止。他 scope / forbidden 不変
