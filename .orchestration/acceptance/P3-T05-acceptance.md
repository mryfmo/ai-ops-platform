# ACCEPTANCE: P3-T05 — Graph subscription workflow

- task_id: P3-T05
- status: accepted（Owner merge 待ち）
- date: 2026-08-13
- writer: codex-deep-dot（WBS 指定の役割反転） / reviewer: claude-deep-dot
- final head: `caed2b502cc7cb3f6fe227a7c9d3dd91d3ea222c`（PR #209 — #207 は author=Owner 本人で self-approve 不可のため close し App token author で再作成。bot P2×2 修正込み。#206/#208 merge 後の 2 回の rebase は base 更新のみで PR diff 不変、120/120 再確認済み）
- review: `.orchestration/reviews/P3-T05-REVIEW.md` — orchestrator adversarial
  review、findings 0（non-blocking 所見 2）。worker は事前に codex /review 6 巡で
  15+ findings を自己解消（timing 決定性・shadow 構造的抑止・timeout/heartbeat
  政策・schedule 境界・lib/IO 分離）
- gates:
  - TMP-003: lost-response で renewGraphSubscription schedule 1 回 + reconcile 回収 /
    旧 scheduler 先行時は write 0（shadow-no-duplicate fixture）/ shadow は構造的
    write 不能
  - 独立再現: 117/117 tests・coverage 85%+・fresh-DB `mise run ci` exit 0
  - clean-runner build-test + gitleaks green（head 07681d8）
- bot findings round: codex-connector P2×2 を reviewer 裁定→revise→worker 修正→
  reviewer 再検証（120/120・fresh-DB CI exit 0・fixtures 不変）→ GitHub bot comment
  へ返信済み。clean-runner CI green（head d264a02）
- next_action: Owner merge — **#209**（#206/#208 は merge 済み）。
  merge 後: P3-T05 証跡 sync（review/acceptance）→ P3-T06（JIT expiry and health
  workflows、writer=codex）へ。
