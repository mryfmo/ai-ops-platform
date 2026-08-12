# P2-T07 Web AI SDK provider の gateway 移行

- task_id: `P2-T07`
- 根拠: FinalArch:LLM-001 / FinalArch:LLM-004 / PRD-003 / FR-LLM-001..007 / ADR-0022 / ADR-0009(Recharts)無関係 / ADR-0013(ページエージェント)
- Writer: codex-gpt56-sol-high（WBS 指定） / Reviewer: claude-code-fable5-xhigh
- depends_on: P2-T05（#188 merged）/ P2-T06（#189 merged、先例パターン）
- branch: `agent/P2-T07-web-ai-sdk-gateway`（base = main `8ab347e` 以降）

## allowed_paths

1. `packages/web/src/**` / `packages/web/tests/**`（WBS）
2. `docs/reference/configuration.md`・`.env.example`（web Zod schema へ env を追加する場合、
   traceability gate の config inventory 3 点セットが必須 — P2-T06 の確立済み先例）

## 前提（P2-T05/T06 で確立済みの契約 — 逸脱しない）

- gateway 構成 env: `LITELLM_BASE_URL` + web 用 virtual key（新 env 名は `LITELLM_*` 系で
  server と衝突しない名前に。例 `LITELLM_WEB_VIRTUAL_KEY`。値は Secrets 注入・値なし例）
- model は logical alias のみ（`claude-standard` 等 5 alias。正典
  `deploy/litellm/model-aliases.yaml` の `application_aliases`）。provider 生 model ID・
  provider key を web runtime に持ち込まない
- direct fallback は正典 flag `inference.anthropic_direct_fallback.enabled` の背後のみ。
  per-call 政策境界が無いなら **direct を構成しない fail-closed**（P2-T06-001/007 の裁定）
- fitness 相当の regression 検査（`@anthropic-ai/` raw ban・provider host raw ban 等）を
  web にも置く場合は packages/server/tests/llmGatewayFitness.test.ts の oracle 自己検証
  パターンを踏襲

## deliverables / acceptance（WBS）

- **LiteLLM-compatible provider factory**: Vercel AI SDK の provider を gateway
  （baseURL + virtual key + alias）で構築する factory。構成不備は fail-fast
- **streaming/reasoning/tool UI preserved**: 既存チャット UI の streaming・reasoning 表示・
  ViewSpec tool call が provider 差し替え後も不変（既存テストを壊さない + 必要な追加テスト）
- **persona/data rules unchanged**: 権限フィルタ・persona 解決・データ取得側強制
  （AGENTS.md 原則 6）に一切触れない

## verification

- web tests（vitest。ネットワークなし・mock fetch）
- **real gateway smoke**: ローカル LiteLLM（`deploy/litellm/smoke.sh` の要領で
  `ghcr.io/mryfmo/aiops-litellm-oss:v1.96.2-oss.3@sha256:2518a427…` を Apple `container`
  + postgres:16-alpine sidecar で起動、`SMOKE_MEMORY=4g` 必須）に対し、
  provider factory 経由で (a) /v1/models に 8 alias が見えること
  (b) alias への streaming リクエストが gateway に到達し、dummy provider 資格による
  上流エラーが transport エラーではなく正常な error path として返ること、を確認。
  **実 provider 資格は使用禁止**（test tenant は P2-T03/T04 で整備予定 —
  full E2E はそこまで保留と validation に明記）
- fresh 使い捨て DB（55432、db:require の指示 env と同一シェル）で `mise run ci` exit 0 を
  単独判定してから push。lockfile 変更禁止（AI SDK の新規依存が必要なら停止して報告）

## フロー

App token（`~/.config/aiops/mint-aiops-pr-token.sh`）で push/PR、`ai-generated` ラベル、
merge しない。gitleaks 注意: スクリプト・テスト内で `curl -H "Authorization: Bearer <literal>"`
形を作らない（変数間接化 — P2-T02 learning）。

## 成果物パス

- report: `.orchestration/reports/P2-T07-report.md`
- validation: `.orchestration/validation/P2-T07-validation.md`
- sandbox: `.orchestration/sandboxes/P2-T07-sandbox.md`
- learning: `.orchestration/learning/P2-T07-learning.md`
- autoskill: `.orchestration/autoskill/runs/P2-T07-autoskill.md`
