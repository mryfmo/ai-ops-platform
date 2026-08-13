# P3-T05-REVIEW — PR #207（Graph subscription workflow、writer=codex）

```yaml
task_id: P3-T05-REVIEW
reviewer: claude-deep-dot (claude-code-fable5-xhigh)
reviewed_at: 2026-08-13T21:10:00+09:00
pull_request: https://github.com/mryfmo/ai-ops-platform/pull/207
head_sha: 07681d87d7956e6978119e4ba14d24b9254d524b
verdict: approve
```

## 検分（adversarial、独立実行）

- **境界**: merge-base diff は control-plane + .orchestration のみ。
  `packages/server` 差分 0（既存 scheduler 不変更を diff で確認）。
  merged P3-T02..T04 fixtures 差分 0（byte 不変）。draft ではなく ai-generated label。
- **TMP-003 / shadow no-duplicate**:
  - renewal は authoritative preflight read → 既存（旧 scheduler 先行）なら
    reconciled で write なし（shadow-no-duplicate fixture: renewGraphSubscription
    未 schedule を history 検分）
  - shadow mode は preflight 後の race に依存せず**構造的に write 到達不能**
    （executionMode 分岐が runExternalSideEffect より前）
  - lost-response: single-attempt（maximumAttempts=1）+ reconcile 回収、
    unresolved は fallbackGraphSubscriptionToPolling（旧経路の可用性遷移を保存、
    成功への自動昇格なし）
- **恒久則適合**: 入力/activity 結果とも unknown 受け + envelope/receipt 束縛検証
  （subscriptionId/operation/checkpoint 一致必須）、契約違反は non-retryable
  E-CP-CONTRACT（wedge しない — 直接 RangeError throw だった欠陥を worker 自身の
  red/green で検出・修正済み）。相関 ID（renewal idempotency key）は activity
  schedule 前に workflow logical time から決定的に導出。fixture 毎に一意 ID。
- **決定性 guard の緩和（Date.now 許可）**: Temporal workflow sandbox の
  Date.now は history 時刻へ固定され決定的、という理解は正しい。実determinism は
  4 fixtures の replay green が担保しており、静的 guard の緩和は受容可能。
  new Date()/Math.random/fetch の禁止は維持されている。
- **schedule 設計**: 有限 workflow + Temporal Schedule（overlap SKIP /
  catchupWindow = renewal margin / interval offset を初回 start に anchor）。
  ScheduleClient I/O は lib から分離（設計原則 1 適合）。runtime 結線は
  P3-T09 の shadow-wiring スコープに残置 — 妥当。
- **独立 gate 実行**: 117/117 tests・typecheck・lint green、coverage 85%+、
  fresh 使い捨て DB 再作成で `mise run ci` exit 0（orchestrator 環境で再現）。

## 所見（non-blocking）

1. validation 記載の `E-CP-EXTERNAL-UNRESOLVED` は反復中の中間設計で、最終 code
   には存在しない（fallback 経路に置換）。narrative として読めるが、最終状態の
   記述と混在しないよう次回は「superseded」と明示すること。
2. TestWorkflowEnvironment が通常 test suite に入ったため、CI が time-skipping
   test server binary の取得に依存する（従来は replay のみ = server 不要）。
   SDK が version pin する binary であり、clean-runner green を確認して受容。
   将来 offline CI 要件が立つ場合は fixture-only への分離を検討。

## 判定

findings 0（blocking なし）。clean-runner build-test + gitleaks green を確認済み（run at head 07681d8）。accept。

## Bot findings round（2026-08-13、head `07681d8` → `d264a02`）

- chatgpt-codex-connector bot の P2 × 2 を reviewer が全文精査のうえ valid と裁定し
  revise 差し戻し → worker 修正:
  - P2-1: receipt 検証を runExternalSideEffect の外へ移動（execute/reconcile は
    raw を返し、outcome.result を検証）。malformed receipt は E-CP-CONTRACT
    non-retryable で終了し polling fallback へ転落しない（負テスト: fallback
    未 schedule を assert）
  - P2-2: 登録の冪等化 — ScheduleAlreadyRunning を成功扱い、他エラーは伝播
    （両経路の単体テスト追加）
- reviewer 再検証: delta 5 files/80 行のみ・fixtures byte 不変・120/120 tests・
  typecheck green・fresh-DB `mise run ci` exit 0（独立実行）。
- GitHub 上の両 bot comment へ fix 内容を返信済み（reply id 3775335691 / 3775335830）。
- 最終 verdict: **approve**（head `d264a02`、clean-runner CI green 確認後に accept）。
