# ACCEPTANCE: P3-T04 — CodingTaskWorkflow

- task_id: P3-T04
- status: accepted（Owner merge 待ち）
- date: 2026-08-13
- final head: `c8298ca8d062affe6d6a69bca0a7b00db5bcb703`（PR #205）
- review: codex-deep-dot P3-T04-REVIEW round 1〜3、findings 001..005 全解消、
  round-3 verdict=approve。001（review 完了権威の DB 束縛）と 005（in-flight
  dispatch 中の callback 喪失）は codex の独立 live probe で是正を実挙動再検証
- gates:
  - TMP-003: dispatch schedule は応答喪失込みで常に 1 回（history assert）、
    承認なしでは 0 回。in-flight race でも正規 callback を喪失しない
  - TMP-004: crash-resume proxy（per-task history 再構築）で全遷移保持・complete。
    実プロセス kill/restart E2E は deploy smoke（staging）管轄と明記
  - callback replay safe: dispatch 束縛 + exact replay duplicate / 別 identity
    conflicting / malformed 非 wedge（カウンタ完全一致 assert）
  - review 完了権威: DB 正本 read の確認のみ（named signal 単独では完了しない）。
    review 待ちは期限なし durable wait、no_change は直接 complete
  - clean-runner build-test + gitleaks green / 84 tests / coverage 96.3% /
    fresh-DB `mise run ci` exit 0
- next_action: Owner merge — **#205**。merge 後: P3-T04 証跡 sync → P3-T05
  （Graph subscription workflow）へ。DEV-T01 RESULT/acceptance は #204 で完了済み。
