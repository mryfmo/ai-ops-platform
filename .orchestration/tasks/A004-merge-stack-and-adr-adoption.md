# A004: PR スタック順次マージ + ADR-0018 採用化

- task_id: A004
- repo: /Users/mryfmo/Workspace/ai-ops-platform(worktree /private/tmp/ai-ops-platform-A001)
- 発行: orchestrator-fable5 (2026-07-18)
- 担当: codex-gpt56sol-high
- max_turns: 25
- 根拠: 操作者承認記録 .orchestration/acceptance/ADR-0018-owner-approval.md(2026-07-18)。
  P013-F00-T04 の owner 承認取得済み。マージは操作者の明示承認に基づき操作者資格情報(gh CLI)で実行する。

## 作業内容(厳密にこの順)

1. **PR #96**: hosted checks green を確認 → merge(repo 既存慣行の merge commit 方式)。
2. **PR #97**: base を main へ retarget(gh pr edit 97 --base main)→ undraft(gh pr ready)→
   hosted checks green を待って確認 → merge。
3. **ADR 採用化**: branch agent/p013-f00-decision で docs/adr/0018-page-agent-architecture.md の
   ステータス行のみ「提案」→「採用 — 2026-07-18」へ更新し、Conventional Commit
   (docs(adr): adopt ADR-0018)を追加。P013-F00-T04 の Allowed files 準拠(ステータス行のみ)。
4. **PR #98**: base を main へ retarget → undraft → push した採用化コミットを含め hosted checks green を
   確認 → merge。
5. **post-merge 検証**: `git fetch origin` 後、merge した 3 PR の head commit が origin/main の
   ancestor であること、`MISE_LOCKED=1 mise run ci` が最新 main 相当(worktree を origin/main へ
   fast-forward した状態)で green であることを確認。
6. 承認記録の追記用に、merge commit SHA 3 件と各 PR の checks 結果を report へ記録。

## STOP 条件

- いずれかの PR の hosted checks が red → merge せず blocked 報告。
- retarget 後に conflict が発生 → 自力で resolve せず blocked 報告(スタック順が正しければ発生しないはず)。
- gh 認証不能 → blocked 報告。

## allowed_files

- docs/adr/0018-page-agent-architecture.md(ステータス行のみ)
- .orchestration/reports/A004-report.md
- .orchestration/validation/A004-validation.md
- .orchestration/sandboxes/A004-sandbox.md
- .orchestration/learning/A004-learning.md
- .orchestration/autoskill/runs/A004-autoskill.md

## forbidden_actions

- 上記以外のファイル編集、force-push、checks red でのマージ、conflict の自力解決
- main への直接 push(merge は gh の PR merge 経由のみ)
- worklog・docs/audit の編集、LLM API 呼び出し、ブラウザ Crit、ユーザーへのレビュー依頼

## 完了報告

```
AGMSG-RESULT v1 task_id=A004 status=ready_for_review|blocked report=.orchestration/reports/A004-report.md validation=.orchestration/validation/A004-validation.md sandbox=.orchestration/sandboxes/A004-sandbox.md learning=.orchestration/learning/A004-learning.md autoskill=.orchestration/autoskill/runs/A004-autoskill.md
```
