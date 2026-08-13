# ACCEPTANCE: P3-T01 — Temporal namespace/worker connectivity

- task_id: P3-T01
- status: accepted（Owner merge 待ち）
- date: 2026-08-13
- final head: `a3513ded8790d6b7c35026caea5c398fd5ebfbdd`（PR #197）+ ENV-DEC-001 改訂 PR #198
- review: codex-deep-dot P3-T01-REVIEW round 1〜6、findings 001..013 全解消、round-6 verdict=approve
  （証跡 `.orchestration/reviews/P3-T01-REVIEW.md`）
- gates:
  - GitHub clean-runner build-test success（run 31660464521, 5m56s）+ gitleaks green
  - control-plane tests 22/22 / Terraform init・fmt・validate / fresh-DB `mise run ci` exit 0
  - live smoke 11/11 PASS（mTLS + 内部 JWT authorizer の 11 項目 deny/allow matrix）
- 特記:
  - 013: `"@swc/core": false` は @temporalio/worker transitive の必要随伴 policy として
    task scope amendment 記録のうえ復元（deny 明示 = script 実行不許可）
  - wrong-branch commit 再発 2 件を復旧・恒久則化（validation / learning 参照）
- next_action: Owner による merge — **#198（ENV-DEC-001 改訂、approve 済み）→ #197** の順。
  merge 後に P3-T02（workflow/activity base contracts）へ着手。
