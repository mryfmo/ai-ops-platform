# P5-T06-REVIEW — approve at `df1353e`

- task_id: P5-T06 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-16
- head_sha: df1353e50abd39a8a91a209b1ce55c3074d21ddd
- verdict: **approve**

## 経緯

worker の独立レビューが P1（未使用 factory では本番 `new GraphClient` 経路を
制約できない）を自己検出 → amendment 承認 → root-fix:
**brand を本番 token 経路に載せる**（shared の `GraphTokenProvider` が
branded `GraphAppOnlyToken` を返し、MSAL provider が検証済み結果を brand）

## 独立再検証

- typecheck green + `@aiops/integrations` 69/69 再実行
- **`@ts-expect-error` の意味論**: typecheck green 自体が「6 つの誤用は必ず
  compile error になる」ことの機械証明（error が出なければ
  ts-expect-error 自身が fail するため）
- **reviewer 独立 misuse プローブ**: 生 string の provider を
  `new GraphClient` へ / 生 string を `GraphAppOnlyToken` へ代入する
  scratch ファイルを tsc にかけ、compile error を実測（プローブ後削除）

## 検分（WIQ-003）

- **compile-time misuse prevented（双方向）**: unique-symbol branded type で
  (a) delegated token/bearer/provider → Graph 側、(b) app-only token/provider →
  Work IQ 側、(c) delegated client → Graph formal write 面、の 6 経路が
  すべて compile error（負型テストで固定）
- Graph 側に delegated interface を作らない設計を維持（分離の要）。
  `GraphSystemClient` は subscriptions/lifecycle/delta/formal-write の
  capability view + `authenticationMode: "app-only"` marker
- **runtime 挙動不変**: graphClient の変更は brand 定義 + marker property +
  MSAL 検証の等価書換のみ。server 890 tests は前タスクから green 継続
  （fresh-DB ci で最終確認）。Work IQ 側契約（#237/#238）非破壊

## 妥当性判断

型分離が「未使用の並行 API」でなく**本番経路そのもの**に載った点が本質
（P1 root-fix）。ADR-0024 の Work IQ/Graph 分離が compile-time 契約になった。
