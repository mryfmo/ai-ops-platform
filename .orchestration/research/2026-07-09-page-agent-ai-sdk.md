# 補完調査: AI SDK v5 での Reasoning UI + Generative UI(ページエージェント) (2026-07-09)

一次ソース検証済み(npm dist-tags / ai-sdk.dev の **v5 版ドキュメント**)。Phase I6 / ADR-0013 の設計材料。

## 最重要注意: ドキュメントのバージョン乖離

- `ai@latest` は 7.0.x。本リポジトリは `ai@^5`(v5 系は 5.0.x パッチのみ、5.1 は beta 止まり → **^5.0 内に破壊的変更なし**)
- **未バージョンの ai-sdk.dev/docs/... は v7 の内容**(`ToolLoopAgent`、`toolApproval` 等は v5 に存在しない)。実装は必ず `ai-sdk.dev/v5/docs/...` を参照すること

## Reasoning UI(v5 の公式 API)

- サーバ: `result.toUIMessageStreamResponse({ sendReasoning: true })` で reasoning トークンをクライアントへ転送
- Anthropic extended thinking: `providerOptions: { anthropic: { thinking: { type: 'enabled', budgetTokens: 12000 } } }`(@ai-sdk/anthropic v5 ドキュメント記載は enabled+budgetTokens のみ)
- クライアント: `part.type === 'reasoning'`(`text` プロパティ、本文 parts より先に届く)。ステップ/ツール進捗は `'step-start'` part と `'tool-<name>'` part(state: `input-streaming | input-available | output-available | output-error`、エラー時 `errorText`)

## Generative UI(v5 の公式推奨)

- **公式推奨 = client-side(useChat の typed tool parts → React コンポーネント)**。"Generative UI is the process of connecting the results of a tool call to a React component."
- `part.state` で switch: input-available → スケルトン、output-available → `part.output`(= コード算出の ViewSpec)をコンポーネントに渡す、output-error → エラー表示
- **`ai/rsc` / `streamUI` は使用禁止**: 公式に "currently experimental. We recommend using AI SDK UI for production."
- 既存規約(数値はコード算出、LLM は表示パラメータのみ)と完全整合: tool の execute がコード算出 ViewSpec を返し、LLM はツール選択と入力パラメータのみ

## エージェントループ(v5)

- `Experimental_Agent` は存在するが experimental(v7 で改名)→ **素の `streamText` + `stopWhen`(`stepCountIs(n)` / `hasToolCall(...)` / カスタム)+ `prepareStep`(ステップ毎に model/messages/activeTools/toolChoice を上書き)が安全な v5 サーフェス**
- HITL(承認ゲート): v5 は手動パターンのみ — execute を持たない tool 定義 + 確認 UI + `addToolOutput()` + `sendMessage()`。`toolApproval` オプションは v6+ のため使用不可
- クライアント実行ツール: `onToolCall` + `addToolOutput`、自動継続は `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls`

## 永続化/再開(v5)

- `UIMessage[]` を保存(ModelMessage ではない)。`toUIMessageStreamResponse({ originalMessages, generateMessageId, onFinish: 保存 })` + `result.consumeStream()`(切断時も生成完走)+ `validateUIMessages` で復元検証。`useChat({ id, messages })`
- resumable streams(`useChat({ resume: true })`)は Redis + resumable-stream + activeStreamId 管理が必要で abort と非互換 → **必要性が実証されるまで導入しない**

## 推奨アーキテクチャ(証拠ランク付き)

1. useChat + client-side generative UI 継続(強): サーバ `streamText({ tools, stopWhen: stepCountIs(N), providerOptions.anthropic.thinking })` → `toUIMessageStreamResponse({ sendReasoning: true })`。クライアントは parts 順に reasoning(折りたたみ思考ブロック)→ step-start(区切り)→ tool parts(スケルトン →ViewSpec コンポーネント)
2. `ai/rsc` 不使用(強)
3. `Experimental_Agent` より素の streamText + stopWhen/prepareStep(中)
4. 承認ゲートは手動 HITL パターン(中)
5. resumable streams は要件が出るまで見送り(任意)

## ソース

- https://ai-sdk.dev/v5/docs/ai-sdk-ui/chatbot / chatbot-tool-usage / generative-user-interfaces / chatbot-message-persistence / chatbot-resume-streams
- https://ai-sdk.dev/v5/docs/ai-sdk-rsc/overview(experimental 宣言)
- https://ai-sdk.dev/v5/docs/agents/overview / loop-control
- https://ai-sdk.dev/v5/cookbook/next/human-in-the-loop
- https://ai-sdk.dev/v5/providers/ai-sdk-providers/anthropic
- npm dist-tags(ai-v5 = 5.0.210 等)
