# P10-T03: Implement identity and secret provisioning

- task_id: P10-T03
- writer: codex-deep-dot（Owner 指示 2026-08-15 により実務委任。WBS 原記載
  writer=claude。orchestrator は起票・adversarial review・acceptance）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P10-T01 ✅（#248）/ P0-T09 ✅
- requirement_refs: PRD-010 / FR-CP-008 / FR-OBS-005
- adr_refs: ADR-0016 / ADR-0028
- acceptance_gate_ids: REL-001（identity negative tests — code/plan 面。
  実 env 検証は AWS 到達後）
- risk: **critical**
- **並行注意**: open PR #254（deploy/aws/modules/rds・envs/main.tf・
  validate-modules.sh・README・runbooks/backup-restore.md 等）。
  **#254 の変更ファイルへ接触禁止** — identity/secrets-manager module は
  #254 非接触なので拡張可。envs/main.tf と validate-modules.sh が必要な場合は
  **#254 merge 後に rebase して結線**（P6-T11 と同じ順序条件。それまで
  module 側で完結）

## Canon / 前提

- runtime spec: 環境分離（dev/staging/prod）、least-privilege IAM task role、
  GitHub Actions は **OIDC federation**（long-lived key 禁止 — P2 で確立した
  「長期資格情報を持たない」原則の IaC 化）
- P10-T01 の identity/secrets-manager module 構造・credential guard
- P10-T04 の Secrets Manager 参照パターン（DB password）と整合
- runbooks 既存構造（rotation/break-glass の手順書配置先）

## Objective

1. **IAM**（identity module 拡張）: サービス別 task role
   （server/litellm/temporal/agentgateway/opa — 各 deploy 台帳の posture と
   整合する最小権限）、GitHub Actions **OIDC provider + role**
   （repo/branch 条件で assume 制限、実 org/repo は変数 + placeholder）、
   環境分離（role/policy の env prefix、cross-env assume 禁止）
2. **Secrets Manager**（module 拡張）: secret 階層設計（env/service 別）、
   **KMS CMK + resource policy**（cross-env 読取禁止・管理者と利用者の
   role 分離）、rotation 設定の枠（rotation lambda は placeholder —
   実装は env 到達後と明記）
3. **rotation / break-glass runbook**（`runbooks/`）: 定期 rotation 手順・
   緊急 break-glass（監査記録必須）手順
4. **identity negative tests**: policy を機械検証 —
   cross-env assume / cross-env secret 読取 / task role の越権
   （例: litellm role が Temporal secret を読めない）が **deny になることを
   IAM policy simulation 相当のローカル検証**（policy JSON の構造 assert +
   floci plan での資源生成確認。実 simulation は AWS 到達後 deferred）

## Acceptance（WBS）

- environment separation（cross-env deny の構造 assert）
- rotation/break-glass（runbook + IaC の rotation 枠）

## Forbidden

- 実 credential/ARN/account ID・実 AWS 到達 / long-lived access key の作成
- open PR #254 変更ファイルへの接触（envs/main.tf 等は merge 後に結線）
- 依存追加 / main direct push / merge / approve

## Scope / allowed_paths

- `deploy/aws/modules/identity/**` / `deploy/aws/modules/secrets-manager/**` /
  `deploy/aws/**`（新規ファイル。#254 対象は merge 後）
- `runbooks/**`（新規 rotation/break-glass — backup-restore.md は #254 対象
  につき非接触）
- `.orchestration/**`（証跡）

## Validation

- fmt/validate green + policy 構造 assert green + floci plan（可能な範囲）
- fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P10-T03-identity-secrets`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P10-T03-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P10-T03 status=ready_for_review

## Web boundary 裁定（2026-08-17、orchestrator）

- 承認: 固定 5 service（server/litellm/temporal/agentgateway/opa）は
  専用 role map。**web は server 等への alias 禁止**とし、暫定として
  legacy 互換の execution/task pair（legacy secret_arns は空・ECR scope は
  web 限定）を使う worker 提案の minimum safe wiring を採択
- 条件: web の専用 boundary 昇格（runtime 要件確定後の dedicated role map 化）
  を **staging apply 前の必須 follow-up** として report / handoff に記録する
