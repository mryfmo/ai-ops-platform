# P4-T04 Acceptance — Integrate gateway with OPA and action ledger

- task_id: P4-T04 / PR: #232（merged, main `42e6a15`）/ head: f69b771
- writer: codex-deep-dot（Owner 指示による実務委任）/ reviewer: claude（orchestrator）
- date: 2026-08-15
- status: **accepted / closed**

## 記録

- 実装: pure `mcpPolicy`（L4-L6 拒否・registry/caller/operation 束縛）+
  `GovernedMcpToolCaller`（decision 先行・全経路 versioned receipt・
  approvals 二重照合・claim TOCTOU 防止・fail-closed 網羅）+
  decisionClient pathname guard + evidence sanitize
- レビュー: `.orchestration/reviews/P4-T04-REVIEW.md`（approve。反証プローブ
  6 種 fail-closed 実証、独立 test 再実行 27/12/860）
- non-blocking notes（後続で対応可）:
  1. duplicate plan 経路の orphan pending approval
  2. approval expiry 時の ledger `failed` × receipt `blocked` の名称非対称
- scope amendment 1 件（decisionClient guard の 2 ファイル、承認記録済み）
- 途中経緯: orchestrator の branch flip ミス 1 件（復旧済み、worker 変更無傷）と
  前セッション停止による idle 化 1 件（PING で再開）— いずれも learning 済み
