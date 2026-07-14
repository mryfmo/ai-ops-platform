# ADR-0013: ページエージェントは AI SDK v5 の Reasoning UI と client-side Generative UI で実装する

## ステータス

採用

## コンテキスト

- T11 で Web ダッシュボードは Recharts 3 とデザイントークンに刷新された。
- 次の要件は、各ページに常駐するページエージェントが、推論・ステップ・tool 実行状態を表示しながら、tool 結果を実ダッシュボード表示へ反映すること。
- AI SDK の未バージョン docs は v7 内容を示す。現在の依存は `ai@5.0.210` / `@ai-sdk/react@2.0.x` / `@ai-sdk/anthropic@2.0.x` であり、実装は `ai-sdk.dev/v5/...` の API だけを使う必要がある。
- 既存の ChatPanel / chatHandler / tools / ViewSpec は「LLM は表示パラメータのみ、数値はコード算出」という境界を既に持っている。

## 決定

1. **client-side Generative UI** を採用する。`useChat` が受け取る typed UI message parts を React で分岐し、`tool-*` part の `output` に含まれる ViewSpec を既存 DashboardClient の表示更新へ渡す。
2. **`ai/rsc` と `streamUI` は使わない**。AI SDK v5 の RSC surface は experimental であり、本番導線には AI SDK UI の client-side Generative UI を使う。
3. **Reasoning UI** は `streamText(...).toUIMessageStreamResponse({ sendReasoning: true })` で転送し、クライアントでは `part.type === "reasoning"` を折りたたみ表示する。
4. **Anthropic extended thinking** は `providerOptions.anthropic.thinking: { type: "enabled", budgetTokens }` で有効化する。budget は環境変数で設定可能にし、未指定時は既定値を使う。Anthropic公式ドキュメントでは extended thinking と `temperature` / `top_k` の変更は非互換のため、ページエージェントは thinking 有効時に `temperature` を送らない。`claude-sonnet-4-6` の manual thinking はサポート対象だが deprecated とされているため、adaptive thinking への移行はモデル移行タスクで扱う。
5. **エージェントループ** は `streamText` + `stopWhen: stepCountIs(N)` + `prepareStep` を使う。`Experimental_Agent` は v7 で surface が変わるため使わない。
6. **HITL が必要な破壊的操作は今回入れない**。将来必要になった場合も v5 の手動パターン（execute なし tool + `addToolOutput`）に限定し、`toolApproval` は使わない。
7. **resumable streams は導入しない**。Redis 依存と abort 非互換があるため、必要性が実証されるまで見送る。
8. **数値はコード算出、LLM は表示パラメータのみ**を維持する。tool execute は ViewSpec を返すだけで、集計値や機密データを LLM に返さない。
9. **ページコンテキストはサニタイズして注入する**。クライアント申告 persona は信用せず、サーバ側で resolve した persona を正とする。

### PrjOps:REQ-041

PrjOpsダッシュボードのページエージェントは、推論とtool実行状態を表示し、認可済みのViewSpecだけを実ダッシュボード表示へ反映する。数値はコードで算出し、LLMに生成させない。

### PrjOps:SPEC-INT-068

PrjOpsページエージェントはAI SDK v5のtyped UI message parts、`sendReasoning: true`、`streamText`、`stopWhen: stepCountIs(N)`、`prepareStep`を使用し、tool出力をViewSpecに限定する。

### PrjOps:AC-041-1

PrjOpsページエージェントはreasoning・step・tool状態を表示し、成功したtool出力のViewSpecをページへ反映できることをテストで示す。

### DevOps:REQ-041

DevOpsダッシュボードのページエージェントは、推論とtool実行状態を表示し、認可済みのViewSpecだけを実ダッシュボード表示へ反映する。数値はコードで算出し、LLMに生成させない。

### DevOps:SPEC-INT-068

DevOpsページエージェントはAI SDK v5のtyped UI message parts、`sendReasoning: true`、`streamText`、`stopWhen: stepCountIs(N)`、`prepareStep`を使用し、tool出力をViewSpecに限定する。

### DevOps:AC-041-1

DevOpsページエージェントはreasoning・step・tool状態を表示し、成功したtool出力のViewSpecをページへ反映できることをテストで示す。

## 根拠

- AI SDK v5 の UI message parts は `reasoning`、`step-start`、`tool-*` の state を持つため、既存チャット UI を少ない差分でページエージェントへ拡張できる。
- 既存 ViewSpec 境界を再利用すると、ペルソナ別認可・データ取得・Recharts 表示を重複実装せずに済む。
- `stopWhen: stepCountIs(N)` は tool 連鎖の上限を明示でき、ページエージェントのコストと応答時間を抑えられる。

## 影響

- 新仕様 ID: PrjOps/DevOps 共通 Web 仕様として `REQ-041` / `SPEC-INT-068` / `AC-041-1` を追加する。
- ページエージェントは既存 `/api/chat` を使い続ける。追加依存は不要。
- 生成 UI は ViewSpec ベースのページ固定を第一段階とし、チャット内でフルデータを二重 fetch する実装は見送る。必要になれば ViewSpec 別 preview fetch を追加する。
