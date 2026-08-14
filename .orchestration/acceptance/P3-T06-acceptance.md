# ACCEPTANCE: P3-T06 — JIT expiry and health workflows

- task_id: P3-T06
- status: accepted（Owner merge 待ち）
- date: 2026-08-14
- writer: codex-deep-dot / reviewer: claude-deep-dot
- final head: `7e3a7774498a3aa349c1949a62a671227a1eaa8b`（PR #211、App token author）
- review: `.orchestration/reviews/P3-T06-REVIEW.md` — findings 0。worker self-review
  3 巡が fail-safe 抑止の実バグを red/green で検出・修正。blocked-auth 対応も
  恒久則どおり
- gates: TMP-003（revoke 1 回 + reconcile、unresolved 非成功）/ expiry SLA
  （1m + catchupWindow + SKIP）/ health 決定的 + fail-safe 境界分離 /
  独立再現 158/158・coverage 85.7%+・fresh-DB CI exit 0 / clean-runner CI green
- next_action: Owner merge — **#210（P3-T05 証跡 sync）→ #211** の順。
  merge 後: P3-T06 証跡 sync → P3-T07（report delivery workflow、writer=codex）。
