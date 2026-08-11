# T12: Phase I6 — ページエージェント組込(Reasoning UI + Generative UI)

## Objective

各ダッシュボードページにページエージェントを組み込み、Reasoning UI(推論・ツール実行過程のストリーム可視化)+ Generative UI(tool call → 実ダッシュボードコンポーネントの動的生成)を実現する。設計根拠: `.orchestration/research/2026-07-09-page-agent-ai-sdk.md`(**必読 — 特に v5/v7 ドキュメント乖離の注意**)。既存の ChatPanel / chatHandler / tools / viewSpec / personaResolver 基盤の発展として実装する。

## 最初に ADR-0013 を起案

`docs/adr/0013-page-agent-reasoning-generative-ui.md` を既存書式で作成。決定事項(確定済み):

- client-side Generative UI(useChat typed tool parts → React コンポーネント)を採用。`ai/rsc`/`streamUI` は公式 experimental のため不使用
- Reasoning UI は `toUIMessageStreamResponse({ sendReasoning: true })` + Anthropic extended thinking(`providerOptions.anthropic.thinking: { type: 'enabled', budgetTokens }` — budget は設定可能に)
- エージェントループは素の `streamText` + `stopWhen: stepCountIs(N)` + `prepareStep`(`Experimental_Agent` は不使用 — v7 で改名されるため)
- 「数値はコード算出、LLM は表示パラメータのみ」を維持: tool の execute はコード算出済み ViewSpec を返す
- 破壊的操作(あれば)は v5 手動 HITL パターン(execute なし tool + addToolOutput)。`toolApproval` は v6+ のため不使用
- resumable streams は今回導入しない(Redis 依存+abort 非互換のため、要件実証まで見送り)
- ドキュメント参照は ai-sdk.dev/v5/... に限定する旨を ADR に明記

## 実装スコープ

### 1. サーバ(packages/web/src/server/chat/)

- chatHandler を拡張: `streamText` に `stopWhen: stepCountIs(N)`(既定 5、設定可能)、`providerOptions.anthropic.thinking`、`toUIMessageStreamResponse({ sendReasoning: true })`
- **ページコンテキスト注入**: リクエストにページ状態(persona、選択期間 period、選択 projectId、現在ビュー)を含め、systemPrompt に構造化して渡す。authGuard/personaResolver で検証(クライアント申告の persona を信用しない — 既存の認可解決を用いる)
- tools 拡張(既存 viewSpec 流儀で、各ペルソナのデータハンドラを再利用):
  - `show_timeseries`(period/kind → 時系列 ViewSpec)
  - `show_seven_keys`(プロジェクト × キー RAG マトリクス ViewSpec)
  - `show_dora`(サービス単位 DORA ViewSpec)
  - `show_investor_kpis`(投資家 KPI ViewSpec)
  - `show_burndown` / `show_projects_table` など既存データ API を網羅
  - 全 tool の execute はコード算出済みデータを返す。権限フィルタはデータ取得側で強制(persona 越境不可のテスト必須)
- LLM 入力前サニタイズ(既存 sanitizeForLlmInput)をページコンテキスト・ユーザー入力に適用

### 2. クライアント(packages/web/src/components/)

- ChatPanel を全ページ共通の PageAgentPanel に発展(各ペルソナビューに常駐、開閉可能):
  - `part.type === 'reasoning'` → 折りたたみ思考ブロック(ストリーミング中は開、完了で自動折りたたみ。「推論中…」インジケータ)
  - `'step-start'` → ステップ区切り表示
  - `'tool-<name>'` → state で switch: input-streaming/input-available → 対応コンポーネントのスケルトン、output-available → **T11 の実コンポーネント(Recharts チャート/KPI タイル/RAG マトリクス)を part.output の ViewSpec でレンダリング**、output-error → 統一エラー表示
- 生成されたビューは「ページに固定」ボタンでダッシュボード側に反映できる(ページ状態の update — 実装が重い場合は最小の期間/ビュー切替連動のみとし、report に判断を記載)
- デザインは T11 のトークン/コンポーネントを使用(独自スタイル追加は最小限)

### 3. テスト

- サーバ: chatHandler のストリーム構成(sendReasoning、stopWhen)、ツールの権限フィルタ(persona 越境拒否)、コンテキスト注入のサニタイズ — モックで
- クライアント: parts 種別ごとのレンダリング分岐(reasoning/step-start/tool states)を既存流儀で
- describe/it に仕様 ID。新規 REQ/SPEC-INT/AC は ADR-0013 で採番し登録(既存 ID と衝突しない末尾採番)

## ブランチ戦略

- `agent/T12` を `agent/T11` から作成、PR base は `agent/T11`(スタック継続、PR 説明に明記)

## 規約

- DoD: 並列 `mise run ci` green。依存追加なし(ai/@ai-sdk/react/@ai-sdk/anthropic は導入済み。resumable-stream 等は追加しない)
- 実 LLM 呼び出し禁止(テストはモック)。Conventional Commits、PR(`ai-generated`)、マージ禁止、`.orchestration/` は commit しない

## Forbidden actions

- 依存追加、`ai/rsc`/`streamUI`/`Experimental_Agent`/`toolApproval` の使用、v7 ドキュメント由来 API の使用
- main への push、PR マージ、force push、実 API 呼び出し
- データ算出ロジックの変更

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T12-report.md`
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T12-validation.txt`
- sandbox / learning / autoskill: 同ディレクトリ T12-\*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T12 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 60
