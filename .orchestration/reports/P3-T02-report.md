# P3-T02 report — workflow/activity base contracts

- writer: claude-code-fable5-xhigh / branch `agent/P3-T02-workflow-base-contracts` / PR #200（head `da94aa5`）
- 実装: WBS P3-T02 の 4 deliverables。
  - `lib/retryPolicies.ts`: operation class 固定 retry policy（external-side-effect は
    maximumAttempts=1、non-retryable = RangeError/TypeError/E-CP-CONTRACT、凍結定数）
  - `lib/idempotency.ts`: `workflowId#activity#sequence` 決定的 key（build/parse 逆関数）
  - `workflows/sideEffect.ts`: runExternalSideEffect — single-attempt + reconcile、
    不在時 ExternalSideEffectUnresolvedError（盲目的再実行禁止）
  - `workflows/versioning.ts` / `workflows/cancellation.ts`: patched wrapper（命名規約）と
    dispatch guard + non-cancellable cleanup
  - `workflows/replayProbe.ts` + `scripts/record-replay-history.mjs` + fixtures:
    TMP-001 の recorded history（executed / lost-response reconciled）と replay test
- 設計判断:
  - replay は `Worker.runReplayHistory`（ローカル・server 不要）。record は dev-only script
    に隔離し CI のネットワーク禁止を維持
  - history 永続化は protobufjs `toJSON`/`fromObject`（`historyToJSON` は payload metadata
    で toProto3JSON が失敗するため不採用）
  - replayProbe.ts は workflow sandbox 内でのみ実行され V8 coverage に計上されないため
    coverage 対象から除外（行使は replay test が保証、vitest.config に理由コメント）
- gates: TMP-001 / TMP-003 evidence あり。fresh DB `mise run ci` exit 0。
