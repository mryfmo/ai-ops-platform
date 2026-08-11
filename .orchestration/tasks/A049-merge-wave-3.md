# A049: merge wave 3 — PR #141 / #142 + dependabot #133 / #134 / #135 / #94

- task_id: A049-merge-wave-3
- repo: /Users/mryfmo/Workspace/ai-ops-platform（main worktree）
- 発行: claude-deep-dot（orchestrator）2026-08-07
- 担当: codex-deep-dot（herdr pane、`codex --profile deep` = gpt-5.6-sol high）
- 受入: claude-deep-dot（orchestrator が merge 後の main を検証）
- max_turns: 30
- 前提: #141（A037、指摘2件是正・スレッド0）・#142（A038、指摘3件是正・スレッド0）は受入済み。
  dependabot 4件は checks 3 pass を orchestrator が事前確認済み（2026-08-07）。

## 手順（A041/A042 と同一プロトコル。1つ失敗したらそこで停止して報告）

対象順序: **#141 → #142 → #133 → #134 → #135 → #94**

各 PR: 状態確認 → 未解決スレッド 0 を確認（増えていたら停止報告）→ 必要なら
`gh pr update-branch` + checks green 待ち → `gh pr merge <N> --squash --delete-branch` →
origin/main 反映確認。dependabot ブランチは update-branch が効かない場合
`@dependabot rebase` コメントで再構築し checks を待つ。

conflict は機械的（独立変更の結合・生成タイムスタンプ・lockfile の dependabot 側再生成）のみ
自力解決可。コードの意味判断が要る場合は停止して報告。

全 PR 完了後: `git checkout main && git pull --ff-only origin main`。merge 後 main の
CI run が green で完走することを最後の1本まで確認して報告に含める。

## forbidden_actions

- PR 本文・コード・スレッドの変更（merge / update-branch / @dependabot rebase コメントのみ）
- squash 以外の merge 方法、対象 6 PR 以外の merge、force push

## 完了報告

```
AGMSG-RESULT v1 task_id=A049-merge-wave-3 status=ready_for_review|blocked report=.orchestration/reports/A049-report.md validation=.orchestration/validation/A049-validation.md sandbox=.orchestration/sandboxes/A049-sandbox.md learning=.orchestration/learning/A049-learning.md autoskill=.orchestration/autoskill/runs/A049-autoskill.md
```

report には各 PR の merge SHA・rebase/update の有無・merge 後 main CI の run 結果を残すこと。
