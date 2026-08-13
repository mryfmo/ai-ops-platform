# AGMSG-TASK: DEV-T01 — floci による dev-only Terraform 事前検証

- task_id: DEV-T01
- writer: codex-gpt56-sol-high（worker 実装）
- reviewer: claude-code-fable5-xhigh（orchestrator acceptance review）
- 出自: Owner 指示 2026-08-13「AWSのかわりに開発時のみ floci-io/floci を活用」→
  「dev-only Terraform 事前検証として導入」
- risk: low（dev-only。受入 gate・CI 証跡には使わない）
- branch: `agent/DEV-T01-floci-prevalidation`

## 目的

AWS env（Owner 準備待ち）到達前に、`deploy/aws/temporal/`（および将来の
`deploy/aws/litellm/`）の Terraform 配線ミス（task definition・secrets 注入・
Cloud Map・per-worker token secret 等）を floci（AWS ローカルエミュレータ、
localhost:4566）への `terraform plan/apply` で検出可能にする。

## 位置づけ（must）

- **dev-only**。CI gate・受入証跡・staging/prod 判断には一切使わない。
  SG/IAM/mTLS の実挙動検証の代替にならないことを README/ENV-DEC 注記に明記
- Bedrock Runtime は stub のため P2-T03/T04/T10 の代替にはならない旨も明記
- 既存 `deploy/temporal/docker-compose.yml` + smoke（Apple container）経路は不変更

## allowed_paths

1. `deploy/aws/floci/**`（新設: compose/README/env example/検証 script）
2. `deploy/aws/temporal/`（**dev-only provider override の分離ファイルのみ**。
   例: `floci_override.tf.example` または `-backend-config`/`*.tfvars` 方式。
   本番系 main.tf/variables.tf の挙動を変えない形に限る）
3. `docs/decisions/`（ENV-DEC への dev-only 注記 1 枚）

## 実装要件

- floci image は digest で exact pin（`floci/floci:<ver>@sha256:...`、最新安定版）
- Docker ランタイム前提を README に明記（本開発機は Apple container のため、
  ECS/RDS 実 Docker 系 emulation には colima 等が必要。導入手順は README 記載のみ、
  ランタイムのインストール自体は Owner 操作）
- provider override は AWS_ENDPOINT_URL / dummy credential 方式。
  実 AWS credential と混線しない guard（env 確認）を script に含める
- 検証 script: floci 起動 → `terraform init/plan`（可能なら apply→smoke→destroy）
  → 結果要約。ネットワーク遮断環境では skip を明示
- gitleaks/format/traceability の全 gate green。既存 CI に floci を組み込まない

## forbidden_actions

- main direct push / draft PR / merge
- CI workflow への floci 追加、受入 gate の書き換え
- `deploy/aws/temporal/main.tf`・`variables.tf` の本番挙動変更
- 実 AWS credential の使用・記載

## expected artifacts

- report: `.orchestration/reports/DEV-T01-report.md`
- validation: `.orchestration/validation/DEV-T01-validation.md`
- sandbox: `.orchestration/sandboxes/DEV-T01-sandbox.md`
- learning: `.orchestration/learning/DEV-T01-learning.md`
- autoskill: `.orchestration/autoskill/runs/DEV-T01-autoskill.md`
- done_signal: AGMSG-RESULT
