# P2-T02 report

- Status: implementation complete; awaiting independent reviewer / Owner merge
- Branch: `agent/P2-T02-litellm-service-config`（base = main `9903d71`）
- Writer: claude-code-fable5-xhigh（WBS 指定どおり orchestrator が実装） /
  Reviewer: codex-gpt56-sol-high（AGMSG-TASK `P2-T02-REVIEW`）

## Delivered

- `deploy/litellm/config.yaml`: inference-only proxy config（v1.96.2）。
  `include: model-aliases.yaml`（P2-T01 manifest が唯一の model source）、
  `litellm_settings.telemetry: false`、callbacks は OSS `otel` のみ、
  `general_settings` は master key / database_url とも `os.environ/` 参照のみ、
  `store_model_in_db: false`（DB/UI 経由の model 登録で alias 契約を迂回させない）、
  provenance に register の immutable digest を宣言
- `deploy/litellm/config.yaml` の `aiops_deployment` 節: private_ingress=true /
  public_endpoints=[] / 専用論理 DB `litellm`・role `litellm_app` / health endpoints /
  metrics 経路（otel-collector）を宣言（LiteLLM は読まず、check と P10-T01 IaC が消費）
- `deploy/litellm/env.example`: 値なしの env 契約（8 model ID env、master key、DB URL、
  pricing revision、ANTHROPIC_API_KEY、OTEL endpoint）。long-lived AWS key と
  enterprise env（LITELLM_LICENSE）は禁止と明記し check が強制
- `deploy/litellm/smoke.sh`: pinned digest を起動し liveliness + 禁止 env 不在を検証
  （SMOKE_RUNTIME/SMOKE_MEMORY/SMOKE_ADDR で runtime 非依存）
- `contracts/model-routing/check-service-config.mjs` + `service-config.test.mjs` +
  負 fixture 3 種: 上記 acceptance（MCP/A2A 無効 / digest 固定 / enterprise 不在 /
  telemetry off / native fallback 空 / private ingress）を既存 `node --test` 系列で機械検証。
  `contracts/package.json` の test 行に 1 ファイル追加（P2-T01-001 裁定の先例に従う結線）

## Acceptance mapping（WBS P2-T02 + P2-ENTRY binding）

| acceptance | 実現 |
| --- | --- |
| MCP/A2A disabled | config にキー面なし + check の forbidden key scan + 正典 `disabled_litellm_features` 突合（既存 T01 check） |
| private ingress | `aiops_deployment.private_ingress` + public_endpoints=[] を check が強制（実 IaC は P10-T01） |
| immutable image digest | provenance.image を check が register 値と exact 一致で強制 |
| enterprise absent (binding) | check（config/env 検分）+ smoke（runtime env 検分）。物理同梱は Owner 裁定どおり受容 |
| telemetry disabled | `litellm_settings.telemetry: false` を check が強制 |

## Known scope notes

- `/v1/models`（master key）は fallback alias も列挙する。application virtual key への
  alias スコープ制限（FR-LLM-005）は P2-T05/T06 の key 管理で実装する（T02 範囲外）
- T01 handoff どおり native `router_settings.fallbacks` は空のまま。
  `aiops_settings` の error-classification guard 実行系は client 側移行タスクで結線

## レビュー是正（P2-T02-001..003、2026-08-12）

- **001**: `supported_db_objects: []` 明示（v1.96.2 は未設定で DB-backed mcp/agents/
  pass_through を全ロード）、anthropic 資格を `LITELLM_ANTHROPIC_API_KEY` へ改名し
  `litellm_params.api_key` で束縛（常設 /anthropic passthrough の fallback 資格を枯渇）、
  agents/agent_list キー面の拒否、実 image negative smoke probe 追加。
  再指摘（管理 route の live 登録・task-role 下の /bedrock）には **runtime route
  boundary** で対応: 派生 image（oss.2）に sitecustomize default-deny ASGI middleware を
  内蔵し、MCP/A2A/passthrough とその管理 route を認証・資格解決前に 403 遮断
  （allowlist = route-allowlist.json、validator と共有。credentialed instance でも遮断を実証）
- **002**: Owner 裁定 B（公式 image の無条件 enterprise import 実証を受け、
  `deploy/litellm/Dockerfile` で litellm-enterprise と /app/enterprise を除去した
  OSS-only 派生 image `ghcr.io/mryfmo/aiops-litellm-oss:v1.96.2-oss.1@sha256:c11bd714…` に
  再 pin。runtime unimportable を smoke で機械検証）。register 改訂 = PR #186
- **003**: validator が register から image 参照集合を抽出し image/base_image の帰属を
  強制、dist marker 追加（境界一致）、enterprise 6 marker の負 fixture 網羅

## 前提是正（同日実施）

- PR #183: `.gitignore` の `.orchestration/` 撤去 + P2-ENTRY/P2-T01 証跡 sync（merge 待ち）
- PR #184: WBS deploy/azure→deploy/aws 実体化（P2-T02-PRE、codex approve 済み、merge 待ち）
- PR #186: license register 改訂（Owner 裁定 B の記録 + 派生 image pin。#185 より先に merge）
- 残置事項: 2026-07-13 の旧 autostash（agent/T-P1-04 の config.ts 変更）を stash@{0} に
  発見 — 本タスク無関係のため未処置で報告のみ
