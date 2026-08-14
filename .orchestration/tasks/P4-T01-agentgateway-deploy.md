# P4-T01: Deploy agentgateway in MCP/A2A-only mode

- task_id: P4-T01
- writer: claude-code-fable5-xhigh（= orchestrator が実装。P2-T02 と同型）
- reviewer: codex-gpt56-sol-high（AGMSG-TASK `P4-T01-REVIEW` で独立レビュー発注）
- depends_on: P1-T03 ✅ / P1-T08 ✅（P4 entry は P3 完了に依存しない — WBS 準拠）
- requirement_refs: PRD-003 / PRD-005 / FR-MCP-001..007
- adr_refs: ADR-0023
- acceptance_gate_ids: MCP-001（default deny tool policy / unknown tool denied — blocking）

## P4 entry gate（P4-T01-004、Owner 裁定待ち）

- 正本の P4 entry（03_phase_acceptance.md）と P0 baseline 決定は、agentgateway/OPA
  の exact pin と Apache notice/license review 完了を P4 entry の前提とする。
  license register 上、agentgateway の SBOM/依存 license/NOTICE review と
  承認 role は **OPEN** のまま
- 本タスクの成果物は **non-enabled preparatory configuration** として扱う:
  どの runtime からも参照・起動されず、runtime 有効化・P4 entry クローズは
  Owner/Security の register クローズ裁定後。この分類の追認（または entry
  クローズ）を Owner 裁定事項として Owner 待ち backlog に追加する

## Objective

agentgateway v1.4.1 を MCP/A2A 専用モードで導入する構成一式
（private ingress・auth・OTel・health）を `deploy/agentgateway/` に置き、
「LLM routes disabled」「production stdio disabled」を機械検分可能にする。

## Scope / allowed_paths

- `deploy/agentgateway/**`（新規）
- `contracts/mcp-gateway/**` + `contracts/package.json`（test 1 行）—
  P2-T02 と同じ「検証結線のための明示拡張」。MCP-001 の config-level evidence を
  既存 contracts gate（`mise run ci` 経由）に載せるため
- `.orchestration/**`（証跡）
- `deploy/aws/**` は今回未使用: IaC 本体は P10-T01 管轄、AWS env は Owner 待ち。
  dev 事前検証は DEV-T01（floci）の枠組みを流用可能

## Forbidden

- main direct push / production configuration without approved environment gate
- LLM(`ai`) backend・`policies.ai` の追加（ADR-0023: LLM routing は使わない）
- 本番 config への `stdio` target（canon: production stdio disabled）
- 実 provider 資格情報・secrets の commit

## Deliverables

1. `deploy/agentgateway/config.yaml` — vendor schema 準拠の本番形:
   adminAddr off / readinessAddr / statsAddr / tracing(OTLP)、
   MCP route（jwtAuth + mcpAuthorization allowlist rules = default deny）、
   A2A route marker、`ai` backend なし、`stdio` target なし
2. `deploy/agentgateway/deployment.yaml` — platform 側 provenance/posture
   （pinned digest `ghcr.io/agentgateway/agentgateway:v1.4.1@sha256:efd79355…`、
   internal-only ingress、port 台帳）
3. `deploy/agentgateway/smoke.sh` — Apple container CLI 1.2.2 で pinned digest を起動し
   readiness 200 / admin closed / metrics 応答を検分
4. `contracts/mcp-gateway/` — check-gateway-config.mjs + gateway-config.test.mjs
   （負 fixture: ai backend 混入 / stdio 混入 / mcpAuthorization 欠落 /
   digest 非固定 / adminAddr 有効）
5. README（private ingress 前提・rollback = PR revert）

## Validation

- `mise run contracts`（新 check の正負 fixture green）
- `deploy/agentgateway/smoke.sh` の実行証跡（validation ファイルへ）
- fresh DB で `mise run ci` exit 0（単独判定）

## Artifacts

- report: `.orchestration/reports/P4-T01-REPORT.md`
- validation: `.orchestration/validation/P4-T01-VALIDATION.md`
- review: `.orchestration/reviews/P4-T01-REVIEW.md`（codex）
- acceptance: `.orchestration/acceptance/P4-T01-ACCEPTANCE.md`
