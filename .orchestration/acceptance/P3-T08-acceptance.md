# ACCEPTANCE: P3-T08 — Plane reconcile/promotion workflows

- task_id: P3-T08
- status: accepted（Owner merge 待ち）
- date: 2026-08-14
- writer: claude-deep-dot / reviewer: codex-deep-dot
- final head: `36e6640bd3abf6defeba2536fdb18aebde5789c3`（PR #215）
- review: codex P3-T08-REVIEW round 1〜4、findings 001..008 全解消、
  round-4 verdict=approve。round-1 で codex は 6 findings すべてに exact-head
  live probe を付し（恒等衝突での RUNNING 固着 / 空 externalId の直接 child write /
  generic receipt での promotion 回収 / read-write 間 revision 移動での executed /
  運用障害の E-CP-CONTRACT 誤分類 / 親 fixture の activity 証跡ゼロ）、
  round-3 で矛盾 stale（baseline 同値）の silent 抑止経路も検出
- gates:
  - TMP-003: child history 検分で write schedule 常に 1 回・maximumAttempts=1・
    unknown-write reconcile 回収・pending 非再送
  - authority boundary / stale: CAS union 契約（矛盾 stale 拒否込み）・
    draft receipt 専用 parser・恒等文法拘束・child trust boundary 完全検証
  - 221 tests / 16 histories replay / merged fixtures byte 不変 /
    fresh-DB `mise run ci` exit 0 / clean-runner CI green
- next_action: Owner merge — **#214（P3-T07 証跡 sync）→ #215** の順。
  merge 後: P3-T08 証跡 sync → P3-T09（writer=codex、runtime shadow-wiring）。
