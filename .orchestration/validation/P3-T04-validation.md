# P3-T04 validation

- unit: codingTaskState matrix 8 green（callback 受理 3 outcome / duplicate・
  conflicting / malformed 9 種 / id・phase 境界 / review 境界 / 入力 RangeError）
- recorded history 5 fixtures（record:replay-history、dev-only）:
  - complete: signal 拒否 4 種（wrong-phase/malformed/duplicate/conflicting 各 1）
    カウンタ完全一致 + child 起動 + dispatchCodingTask schedule 1 回 + complete
  - dispatch-reconciled: 応答喪失でも schedule 1 回・findCodingTaskDispatch 1 回・
    dispatchOutcome=reconciled で complete（TMP-003）
  - approval-rejected: dispatch schedule 0 件・failed/approval-rejected
  - callback-timeout: TIMER_FIRED・failed/callback-timeout（no auto-complete）
  - crash-resume: cache-0 per-task 再構築で WFT>3・complete（TMP-004 proxy）
- replay: 5/5 green。package gates: 77 tests / coverage 96.26% / typecheck / lint
- full CI: fresh 使い捨て DB 再作成で `mise run ci` exit 0（p3t04-ci.log）
- 途中の失敗と是正（record 基盤）:
  - crash-resume/callback-timeout が flaky に wedge → 根因は同一 taskId 再利用で
    getHandle が旧 run（worker 不在 queue）へ query を route し RPC 無期限 block。
    fixture 毎一意 taskId で根治。probe script で同一フロー 10 秒完走を確認
  - cache-0 の sticky schedule-to-start 10s 停滞 → 1s に短縮
  - result() 待ち auto-skip の不安定 → 期限系 fixture は env.sleep で明示 advance

## Round 1→2 (2026-08-13)

- Round-1 verdict: revise — 001(high) review signal 単独完了 / 002(high) callback の
  dispatch 非束縛 / 003(medium) review-timeout の権威破壊 + no_change 経路 /
  004(medium) 封筒未検証。
- 是正 head `63dee57`:
  - 001: review signal = wake 専用。完了は readReviewDecision（DB 正本 read）の
    complete 確認のみ。unconfirmed-review カウンタ + fixture で「pending 中の
    named signal では完了しない」を history 記録（readReviewDecision 2 回 assert）
  - 002: dispatchId 束縛（dispatch 前/偽 id = dispatch-mismatch）。受理後は
    (runId, outcome, prNumber) 完全一致のみ duplicate、別 identity は conflicting。
    fixture に別 run・別 PR・exact replay の 3 種を記録
  - 003: review 待ちを期限なし durable wait 化（review-timeout 廃止）。
    no_change は直接 complete（新 fixture、readReviewDecision 不 schedule assert）
  - 004: assertCodingTaskRequest を unknown 封筒検証に拡張（負 17 ケース）
- merged fixtures（P3-T02/T03 の 6 file）は origin/main へ byte 復元し
  remote merge-base diff から不在確認（churn 再発防止の恒久運用）
- 検証: 81 tests green / coverage 96.26% / fixtures 6 経路 replay green /
  fresh-DB `mise run ci` exit 0

## Round 2→3 (2026-08-13)

- Round-2 verdict: revise — 001..004 resolved、新 005(high): dispatch activity
  in-flight 中（phase=queued, dispatchId 未確定）の正規 callback が
  dispatch-mismatch で棄却され、callback-timeout に終わる（codex live probe 実証）。
- 是正 head `c8298ca`: 相関 ID を activity schedule 前に確定
  （= dispatch idempotency key、run へ伝播し callback が echo する契約）。
  queued 中も相関一致 callback を受理。新 fixture inflight-callback
  （dispatch 4s 遅延中の callback 受理、signal < activity 完了を history 順 assert、
  dispatch-mismatch=0）+ state matrix queued 受理ケース。
- 検証: 84 tests green / 7 fixtures replay green / fresh-DB `mise run ci` exit 0 /
  merged fixtures 不変（remote merge-base diff 0 件）。
- 補足: merged fixture 復元を cwd 相対 pathspec で一度 no-op にしかけ status で検出
  （L-P3T02-03 の再確認: git 復元は repo root で実行し status で必ず検分）。
