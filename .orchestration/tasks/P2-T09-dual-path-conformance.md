# P2-T09 synthetic dual-path conformance

- task_id: `P2-T09`
- 根拠: FinalArch:LLM-002 / FinalArch:LLM-004 / FinalArch:LLM-005 / PRD-003 / FR-LLM-001..007 / ADR-0022
- Writer: codex-gpt56-sol-high（WBS 指定） / Reviewer: claude-code-fable5-xhigh
- depends_on: P2-T06（#189）/ P2-T07（#191）/ P2-T08（#193）— すべて merged
- branch: `agent/P2-T09-dual-path-conformance`（base = main `5975b06` 以降）

## allowed_paths（WBS）

1. `verification/model-gateway/**`（新設。harness・fixtures・レポートすべてここに閉じる）

（注: 既存 package / deploy / contracts への変更は不可。suite の実行は独立コマンドとし、
`mise run ci` への結線はしない — ci gate 追加は別途 Owner 判断のタスク）

## deliverables / acceptance（WBS）

- **Bedrock vs Anthropic compatibility report**（`verification/model-gateway/` 配下の md）:
  両 provider path（bedrock 系 alias / anthropic 系 fallback alias）の挙動差・互換性を
  合成的（synthetic）に検証した結果の報告書
- **カバレッジ必須 5 次元**: tool use（forced tool_choice + input_schema）/ streaming /
  thinking（extended thinking ヘッダ・reasoning ブロック）/ cache（cache_control
  ephemeral の usage 反映）/ **error mapping**（HTTP status・エラー形が正典
  error class 語彙 — shared の FALLBACK_ALLOWED/FORBIDDEN_ERROR_CLASSES、
  `deploy/litellm/model-aliases.yaml` の on_errors/forbidden — に正しく写像されること）
- **no sensitive production data**: fixtures は完全合成データのみ。実プロンプト・実ログ・
  秘密の混入禁止

## 実装方式の指針（synthetic = 実 provider 資格ゼロで決定的に）

- ローカル gateway: pinned `ghcr.io/mryfmo/aiops-litellm-oss:v1.96.2-oss.3@sha256:2518a427…`
  + postgres:16-alpine（`deploy/litellm/smoke.sh` の要領、SMOKE_MEMORY=4g）
- **suite 専用の model config**（`verification/model-gateway/` 配下に置き container へ
  mount）で LiteLLM の `mock_response` / mock 機構を使い、Bedrock 側・Anthropic 側の
  応答エンベロープ（正常・エラー各種）を決定的に再現する。正典 manifest
  （deploy/litellm/model-aliases.yaml）は変更しない
- suite は将来 P2-T03/T04 の実 tenant で再実行できるよう、base URL / key / mock 有無を
  env で切替可能にする（report にその旨と実行手順を記載）
- 実 provider 資格・実データの使用禁止。gitleaks 罠（curl Bearer リテラル）回避

## verification

- **compatibility test suite** が単独コマンドで再現可能（node --test / vitest いずれか。
  新規依存・lockfile 変更禁止 — 既存 devDependencies の範囲で）
- suite green のエビデンス + 5 次元それぞれの検証内容を validation に記録
- fresh 使い捨て DB（55432、db:require env 同一シェル）で `mise run ci` exit 0 を単独判定
  （suite 自体は ci 外だが、リポジトリ全体の green を維持していることの確認）

## フロー

App token で push/PR、`ai-generated` ラベル、merge しない。

## 成果物パス

- report: `.orchestration/reports/P2-T09-report.md`
- validation: `.orchestration/validation/P2-T09-validation.md`
- sandbox: `.orchestration/sandboxes/P2-T09-sandbox.md`
- learning: `.orchestration/learning/P2-T09-learning.md`
- autoskill: `.orchestration/autoskill/runs/P2-T09-autoskill.md`
