# P5-T01: Define Work IQ Entra/OBO application contract

- task_id: P5-T01
- writer: codex-deep-dot（Owner 指示 2026-08-15 により実務委任。WBS 原記載
  writer=claude。orchestrator は起票・adversarial review・acceptance）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P0-T09 ✅ / P1-T04 ✅
- requirement_refs: PRD-007 / FR-M365-001..006
- adr_refs: ADR-0024
- acceptance_gate_ids: WIQ-001 / WIQ-005（実 tenant E2E は sandbox-m365 到達後。
  本タスクの verification は WBS どおり token-flow tests / design review）
- risk: high

## Canon（必読）

- `docs/plans/2026-08-final-architecture/04_component_specs/04_work_iq_graph.md`
  — Work IQ は delegated/OBO のみ（app-only fallback **禁止**）、initial
  allowlist（fetch/ask/get_schema + 最小 search/list）、write 系 flag off、
  OBO token flow 6 段（subject/tenant/audience 検証、cache 分離
  subject/tenant/scope/resource、gateway 経由時 conformance）
- `docs/adr/0024-work-iq-graph-separation.md` — Work IQ/Graph の分離、
  issuer/tenant/audience conformance、OPA classification/minimization

## Objective（定義タスク — 実 tenant 不要）

1. **application contract 文書**（`docs/contracts/workiq-obo.md` 等）:
   - scopes（least-privilege の具体列挙と根拠）、audiences、token flow
     （6 段の各検証項目と失敗時挙動 = fail-closed）、admin consent plan
     （tenant 管理者が実施する consent 手順・対象 scope 一覧）
   - **app-only rejected** の仕様化: client credentials で取得した token /
     audience 不一致 / tenant 不一致 / subject 欠落を必ず拒否する検証規則
   - token cache 分離キー（subject/tenant/scope/resource）と TTL/失効規則
   - gateway 経由時の token exchange / audience preservation conformance
     項目（P4 の agentgateway 前提。不適合時の Control API 直呼び例外は
     ADR 追記が必要な旨を明記）
2. **型/検証 lib**（`packages/integrations/src/workiq/`）:
   - token claim 検証の pure 関数（iss/tid/aud/sub/scp の fail-closed 検証。
     app-only（scp 欠落・roles のみ）を reject する判定を型で固定）
   - 実網羅 unit tests（正常 delegated / app-only / audience 混同 /
     tenant 混同 / scope 過剰の負 fixture）。ネットワークなし・実 token なし
     （fixture は自作の合成 claim。実資格情報・実 tenant ID の commit 禁止）

## Forbidden

- 実資格情報・実 tenant/app ID の commit（placeholder は `<TENANT_ID>` 形式）
- app-only fallback を許す仕様・コード
- Graph 側（app-only/background）の実装（P5-T03 以降の管轄）
- 依存追加 / main direct push / merge / approve

## Scope / allowed_paths（WBS）

- `docs/contracts/**` / `deploy/aws/**`（今回不要なら触らない）/
  `packages/integrations/src/workiq/**` + `packages/integrations/tests/**`
  （repo 規約準拠の test 置場として事前承認）
- `.orchestration/**`（証跡）

## Acceptance（WBS）

- app-only rejected（負 fixture で機械検証）
- least scopes documented（scope ごとに用途根拠が文書化されている）

## Validation

- token-flow unit tests green / fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P5-T01-workiq-obo-contract`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止。
  **open PR #236 の対象ファイル（docs/security/**）には触れない**

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P5-T01-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P5-T01 status=ready_for_review

## Scope amendment（2026-08-15、orchestrator 承認）

- 追加 allowed_paths: `packages/integrations/src/index.ts`
  （workiq validator の re-export 行の追加のみ — P4-T04/T10 の既存パターン踏襲）
