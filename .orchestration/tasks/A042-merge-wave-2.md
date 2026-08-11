# A042: merge wave 2 — PR #138 / #139 / #140

- task_id: A042-merge-wave-2
- repo: /Users/mryfmo/Workspace/ai-ops-platform（main worktree）
- 発行: claude-deep-dot（orchestrator）2026-08-07
- 担当: codex-deep-dot（herdr pane w1D:p3, `codex --profile deep` = gpt-5.6-sol high）
- 受入: claude-deep-dot（orchestrator が merge 後の main を検証）
- max_turns: 25
- 前提: 3 PR とも受入済み（#138: A040 是正+全スレッド解決、#139: A039 是正+全スレッド解決、#140: Codex bot no-major-issues・スレッド0。いずれも checks green を確認済み、2026-08-07）

## 手順（A041 と同一プロトコル。1つ失敗したらそこで停止して報告）

対象順序: **#138 → #139 → #140**

各 PR: 状態確認 → 未解決スレッド 0 を確認（増えていたら停止報告）→ 必要なら `gh pr update-branch` + checks green 待ち → `env GH_TOKEN="$AIOPS_PR_TOKEN" gh pr merge <N> --squash --delete-branch` → origin/main 反映確認。

注意: #139（`agent/a034-degraded-observability`）と #138 は近接領域（index.ts / http docs）を触るため、
後続の update-branch で conflict が出たら**機械的に解決できる場合のみ**（片側だけの変更の単純結合）
進めてよい。コードの意味判断が要る conflict は停止して報告。

全 PR 完了後: `git checkout main && git pull --ff-only origin main`。

## forbidden_actions

- PR 本文・コード・スレッドの変更（merge / update-branch / 機械的 conflict 解決のみ）
- squash 以外の merge 方法
- 対象 3 PR 以外の merge
- force push

## 完了報告

```
AGMSG-RESULT v1 task_id=A042-merge-wave-2 status=ready_for_review|blocked report=.orchestration/reports/A042-report.md validation=.orchestration/validation/A042-validation.md sandbox=.orchestration/sandboxes/A042-sandbox.md learning=.orchestration/learning/A042-learning.md autoskill=.orchestration/autoskill/runs/A042-autoskill.md
```

report には各 PR の merge commit SHA・update-branch/conflict の有無と内容を残すこと。
