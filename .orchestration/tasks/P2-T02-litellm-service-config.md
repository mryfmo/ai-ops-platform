# P2-T02 LiteLLM private service configuration

- task_id: `P2-T02`
- 根拠: FinalArch:LLM-001 / FinalArch:LLM-003 / PRD-003 / FR-LLM-001..007 / ADR-0022 / ADR-0029
- Writer: claude-code-fable5-xhigh（orchestrator、WBS 指定） / Reviewer: codex-gpt56-sol-high
- depends_on: P2-T01（#182 merged）/ P0-T09（P0 完了）
- 前提是正: PR #184（WBS deploy/azure→deploy/aws 実体化、P2-T02-PRE）レビュー中。
  本タスクの実装は是正前後どちらの WBS でも許可される `deploy/litellm/**` +
  検証結線の `contracts/model-routing/**` に閉じる（config-only。IaC 本体は P10-T01）
- branch: `agent/P2-T02-litellm-service-config`（base = main `9903d71` 以降）

## allowed_paths

1. `deploy/litellm/**`
2. `contracts/model-routing/**`（P2-T01 が確立した検証系列の拡張。
   `contracts/package.json` の test 行 1 行結線は P2-T01-001 裁定の先例に従い許可）

## deliverables / acceptance（WBS + P2-ENTRY binding）

- **inference-only proxy config**（`deploy/litellm/config.yaml`、v1.96.2 形式）:
  `model-aliases.yaml` を消費、master key / DB URL は `os.environ/` 参照のみ
- **MCP/A2A/passthrough 無効**（正典 `disabled_litellm_features` の 3 項目が config 上で
  有効化されていないことを機械検証）
- **immutable image digest**: register の
  `ghcr.io/berriai/litellm:v1.96.2@sha256:154e23bb5f31b1f10e16392a8ef299bd2cde08de3a64a6849002cfcc25ce3c63`
  を config provenance に宣言し、検証で register 値と一致を強制
- **enterprise packaged-but-disabled proof（binding、Owner 裁定 2026-08-12）**:
  enterprise 名称群（cloudformation_stack / dist / enterprise_hooks / enterprise_ui /
  litellm_enterprise）と LITELLM_LICENSE 等の enterprise env が config / env contract に
  不在であることを機械検証
- **telemetry 無効**: `litellm_settings.telemetry: false` を機械検証
- **health / metrics / DB**: `/health` 系エンドポイント（smoke で実証）、metrics は
  OSS の OTel 経路（ADR-0029: CloudWatch + OTel Collector が正本。enterprise 系
  callback は使用しない）、DB は専用論理 DB/role を指す env 参照
- **T01 handoff 制約**: native `router_settings.fallbacks` は空のまま。
  fallback 選択は `aiops_settings`（error-classification guard 付き）が正

## verification

- `contracts/model-routing/` に service-config check + 負 fixture
  （telemetry on / enterprise env / mcp 有効）を追加し、既存 `node --test` 系列に結線
  → `mise run contracts` / `mise run ci` で機械検証
- container smoke: Apple `container` CLI で pinned digest を起動し `/health` 応答 +
  コンテナ env に enterprise env が無いことを確認、出力を validation に記録
- fresh 使い捨て DB（port 55432、dropdb/createdb aiops_p001）で `mise run ci` exit 0 を
  単独判定してから push
- lockfile 変更禁止（必要が生じたら停止して報告）

## フロー

App token push/PR、`ai-generated` ラベル、merge しない（approve 後 Owner merge）。
レビューは AGMSG-TASK `P2-T02-REVIEW` で codex に発注。

## 成果物パス

- report: `.orchestration/reports/P2-T02-report.md`
- validation: `.orchestration/validation/P2-T02-validation.md`
- sandbox: `.orchestration/sandboxes/P2-T02-sandbox.md`
- learning: `.orchestration/learning/P2-T02-learning.md`
- autoskill: `.orchestration/autoskill/runs/P2-T02-autoskill.md`
