# OPS-PR233: PR #233 の approve/merge 執行（Owner 命令、OPS-PR231 と同型）

- task_id: OPS-PR233
- worker: codex-deep-dot
- 種別: 運用対処。worktree 非接触（gh CLI のみ）。P4-T11 実装と並行可

## 現況（orchestrator 診断済み）

- PR #233（P4-T10、author=app/aiops-pr-bot、head `cc3c4b56b9c0…`）:
  mergeable=MERGEABLE / conflict なし / checks 全 green（build-test・gitleaks・
  CodeRabbit）/ reviews 0 件 / reviewDecision=REVIEW_REQUIRED → BLOCKED
- Owner 報告: 「同じ問題が再発、承認してもきっとマージできない」
  （#231 で web UI approve が機能しなかった事象の再発懸念）

## Objective

1. gh api で現況を再確認し証跡記録（head 一致・threads 0・checks green）
2. 想定外の blocker があれば報告のみ（操作しない）
3. 唯一の blocker が「現 head への approve」であれば、OPS-PR231 と同一の
   Owner 命令執行:
   - `gh pr review 233 --approve`
   - `gh pr merge 233 --squash --match-head-commit cc3c4b56b9c01476101a96dd19c78c9d2e30be0e`
4. merge 後の remote main SHA を報告

## Forbidden

- PR 内容変更・force-push・head 不一致 merge・worktree の git 操作

## Expected artifacts

- report: `.orchestration/reports/OPS-PR233-REPORT.md`
- validation: `.orchestration/validation/OPS-PR233-VALIDATION.md`

## Done signal

AGMSG-RESULT v1 task_id=OPS-PR233
