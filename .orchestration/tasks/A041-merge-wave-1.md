# A041: merge wave 1 — PR #131 / #132 / #136 / #137

- task_id: A041-merge-wave-1
- repo: /Users/mryfmo/Workspace/ai-ops-platform（main worktree）
- 発行: claude-deep-dot（orchestrator）2026-08-07
- 担当: codex-deep-dot（herdr pane w1D:p3, `codex --profile deep` = gpt-5.6-sol high）
- 受入: claude-deep-dot（orchestrator が merge 後の main を検証）
- max_turns: 25
- 前提: 4 PR とも orchestrator の受入済み（未解決レビュースレッド 0・checks green を確認済み、2026-08-07）

## 手順（この順で直列。1つ失敗したらそこで停止して報告）

対象順序: **#131 → #132 → #136 → #137**

各 PR について:

1. `env GH_TOKEN="$AIOPS_PR_TOKEN" gh pr view <N> --json mergeable,mergeStateStatus,reviewDecision` で状態確認
2. 未解決スレッドが 0 のままであることを確認（増えていたら**停止して報告**）
3. behind で checks の再実行が必要なら `gh pr update-branch <N>` → checks green を待つ
   （`gh pr checks <N> --watch`）
4. `env GH_TOKEN="$AIOPS_PR_TOKEN" gh pr merge <N> --squash --delete-branch`
5. `git fetch origin main` し、squash commit が origin/main 先頭に載ったことを確認
6. 次の PR へ。**前の merge により conflict / checks red になったら、機械的な
   update-branch 再実行までは行ってよいが、コード修正が必要なら停止して報告**

全 PR 完了後: `git checkout main && git pull --ff-only origin main` で作業ツリーを最新 main に戻す。

## forbidden_actions

- PR 本文・コード・スレッドの変更（merge 操作と update-branch のみ）
- squash 以外の merge 方法
- 対象 4 PR 以外の merge
- force push

## 完了報告

```
AGMSG-RESULT v1 task_id=A041-merge-wave-1 status=ready_for_review|blocked report=.orchestration/reports/A041-report.md validation=.orchestration/validation/A041-validation.md sandbox=.orchestration/sandboxes/A041-sandbox.md learning=.orchestration/learning/A041-learning.md autoskill=.orchestration/autoskill/runs/A041-autoskill.md
```

report には各 PR の merge commit SHA と、update-branch の要否・checks 再実行結果を残すこと。
