# ACCEPTANCE: P3-T10 — Cut over scheduler functions incrementally

- task_id: P3-T10
- status: accepted（Owner merge 待ち）
- date: 2026-08-14
- writer: claude-deep-dot / reviewer: codex-deep-dot
- final head: `aab75411b763ce5c44a164aca0c34d583436ad77`（PR #224）
- review: codex P3-T10-REVIEW round 1〜4、findings 001..007 全解消、
  最終 verdict=unconditional approve。要点:
  - 001/006: server 側 legacy-writer 制約（zero-writer 拒否 E-CFG08 / KILL の
    legacy 復元）に主張を正直化し、rollback は「Temporal pause 先行 → KILL」を
    規範化。kill 発動中は起動警告（TEMPORAL_KILL_SWITCH_ACTIVE）
  - 002/007: shadow AST guard が合成形 observedTask(cutover(literal, task)) を
    直接引数レベルで固定（旧合成順・decoy・二重 wrapper・鍵不一致を fail-closed）
  - 003: 抑止 no-op tick も metrics 計測対象（soak 判別可能）
  - TMP-005: cutover 母集合 = P3-T09 inventory の完全一致を CI 強制
- gates: 焦点 17 tests / server 854 passed + 13 skipped / fresh-DB 素の
  `mise run ci` exit 0（writer）/ clean-runner build-test + gitleaks green
- 残 evidence（AWS env 到達後）: staging soak / failure injection（runbook に欄）
- next_action: Owner merge — **#223（P3-T09 + OPS-PR222 証跡 sync）→ #224**。
  merge 後: P3-T10 証跡 sync → P3 残タスク確認（T11 以降 or P3 完了判定）。
