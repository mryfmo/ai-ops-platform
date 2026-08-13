# ACCEPTANCE: P3-T02 — workflow/activity base contracts

- task_id: P3-T02
- status: accepted（Owner merge 待ち）
- date: 2026-08-13
- final head: `565689b5a7edf2b51656e4958dd876155f411428`（PR #200）
- review: codex-deep-dot P3-T02-REVIEW round 1〜2、findings 001..004 全解消、
  round-2 verdict=approve（証跡 `.orchestration/reviews/P3-T02-REVIEW.md`）
- gates:
  - TMP-001: recorded history 3 経路（executed / lost-response reconciled / cancelled）の
    replay green + 負 fixture は DeterminismViolationError 型で reject
  - TMP-003: lost-response で execute 1 回・外部 object 1 個・reconcile 回収 /
    不在時 fail-closed を unit + history 両面で実証
  - cancellation acceptance: cancel 後に createExternalObject 未 schedule・
    non-cancellable cleanup read 1 回のみ・CANCELED 終了（history データ assert）
  - clean-runner build-test + gitleaks green / control-plane 46 tests /
    coverage 94.8% / fresh-DB `mise run ci` exit 0
- next_action: Owner merge — **#199（P3-T01 証跡 sync）→ #200** の順。
  merge 後 P3-T03（approval child workflow、depends P3-T02 + P1-T05）へ。
