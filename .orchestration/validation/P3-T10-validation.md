# P3-T10 validation

- 焦点: cutover 12 + shadow 5（2 files / 17 tests）green
- server 全 suite: 79 files（78 passed + 1 skipped）、867 collected
  （854 passed + 13 skipped）green
- fresh 使い捨て DB で素の `mise run ci` exit 0 × 4 回（round 毎）
- clean-runner build-test + gitleaks green（cc5bc2d / 7045db9 / aab7541 各 head）
- TMP-005: cutover 母集合 = P3-T09 EXPECTED_SCHEDULER_REGISTRATIONS の完全一致を
  CI 強制。kill switch は実 resolveMigrationFlags 経由 + zero-writer matrix で検証
- 残 evidence（AWS env 到達後）: staging soak / failure injection（runbook に欄）
- 途中の失敗と是正: traceability config inventory（configuration.md/.env.example
  文書化）、prettier 再整形による mutation anchor 追随、kill と E-CFG07 の
  相互作用（list 不活性化）を round 内で検出・修正
