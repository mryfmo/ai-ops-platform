# P10-T01: Implement AWS Terraform module structure

- task_id: P10-T01
- writer: codex-deep-dot（Owner 指示 2026-08-15 により実務委任。WBS 原記載
  writer=claude。orchestrator は起票・adversarial review・acceptance）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P0-T07 ✅ / P1-T08 ✅
- requirement_refs: PRD-010 / FR-CP-008 / FR-OBS-005
- adr_refs: ADR-0016 / ADR-0028
- acceptance_gate_ids: REL-001（staging apply は AWS env 到達後 —
  本タスクは fmt/validate/plan まで）
- risk: medium
- **並行注意**: open PR #243-#247。deploy/aws/** は
  `deploy/aws/temporal/**`・`deploy/aws/floci/**` が既存（P3-T01/DEV-T01）—
  **既存ファイルは変更禁止**、新規 module ツリーのみ追加

## Canon / 前提

- WBS deliverables: **CloudFront / WAF / ALB / ECS Fargate / ECR / RDS /
  Secrets Manager / identity(IAM) / network(VPC) modules**
- ADR-0016 / ADR-0028（AWS 実行基盤・構成決定）と
  `03_architecture/02_runtime_and_deployment.md`（internal-only ingress・
  egress allowlist・専用論理 DB/role）
- 既存 pin 済み構成との整合（参照値として）: LiteLLM / agentgateway / OPA /
  Temporal の digest・port・internal-only posture（各 deploy/ 台帳が正本 —
  Terraform 側は変数で受け、値の重複定義をしない）
- **DEV-T01 floci 事前検証**（deploy/aws/floci、既存 validate-temporal.sh の
  パターン）: AWS 実 env 不在でも plan を floci endpoint に対して実行する
  dev-only 検証系。credential guard（実 AWS へ向かない保証）を踏襲

## Objective

1. `deploy/aws/modules/`（新規）: 上記 9 領域の module 構造 —
   変数/出力の型付き interface、provider version 固定（required_providers
   pin）、tag 規約、環境分離（dev/staging/prod の tfvars 構造。
   **実値・実 ARN・実 account ID は placeholder**）
2. `deploy/aws/envs/`（新規）: 環境 composition root（backend 設定は
   placeholder + コメントで手順化。state backend の実体化は env 到達後）
3. **no portal-only required resource**: 全リソースがコード化されている
   ことを README で宣言し、手動前提（例: 初回 OIDC provider 等）があれば
   明示列挙して bootstrap 手順化
4. **検証系**: `deploy/aws/validate-modules.sh`（fmt -check / validate /
   floci に対する plan — DEV-T01 の credential guard 踏襲、実 AWS 到達不能を
   検証内で保証）。CI への組込みは不要（terraform は CI runner に無い前提。
   local + floci 検証の証跡を validation へ）

## Acceptance（WBS）

- terraform plan clean（floci 事前検証で実測。実 env plan は AWS 到達後）
- no portal-only required resource（宣言 + bootstrap 明示）

## Forbidden

- 実 credential・実 account ID・実 ARN の commit（placeholder のみ）
- 実 AWS への apply/plan（floci のみ。credential guard 必須）
- 既存 deploy/aws/temporal・floci ファイルの変更 / 他 open PR ファイル接触
- 依存追加 / main direct push / merge / approve

## Scope / allowed_paths

- `deploy/aws/modules/**` / `deploy/aws/envs/**` /
  `deploy/aws/validate-modules.sh` / `deploy/aws/README.md`（新規）
- `.orchestration/**`（証跡）

## Validation

- `terraform fmt -check` / `validate` 全 module green、floci plan の証跡
- fresh DB で `mise run ci` exit 0（単独判定 — 影響は traceability/gitleaks 面）

## PR / blocked-auth

- branch `agent/P10-T01-aws-terraform-modules`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P10-T01-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P10-T01 status=ready_for_review

## Floci runtime disposition（2026-08-16、orchestrator 裁定）

- 事実: floci compose の実行には Docker + Compose が必要で本機に不在
  （Apple container CLI は compose 非対応）。DEV-T01 文書どおり runtime は
  Owner-managed
- 裁定: **fmt -check / validate / init の green + credential guard の実装 +
  fail-closed 動作（runtime 不在時に plan へ進まず安全停止）の実証**を
  本タスクの受入範囲とする。floci に対する実 plan は
  「Owner runtime 提供後の deferred verification」として validation に
  明記（P3-T12 deferral と同じ記録形式）。実 AWS plan は従来どおり
  AWS env 到達後
- guard の fail-closed 実証（runtime 不在 → 非ゼロ exit + 実 AWS 非到達）を
  validation に記録すること
