# T02: T01 の変更を commit し PR を作成する

## Objective

T01 で行った `ai-ops-platform/AGENTS.md`(正本化)と `ai-ops-platform/CLAUDE.md`(`@AGENTS.md` の 1 行化)の変更を、リポジトリ規約(AGENTS.md「Git / PR 規約」)に従って commit し、GitHub に PR を作成する。

## Repo

- git リポジトリ実体: `/Users/mryfmo/Workspace/.mryfmo-tmp`(`github.com/mryfmo/tmp` の sparse clone、blob:none フィルタ)。git 操作はここで行う
- 対象変更: `ai-ops-platform/AGENTS.md`, `ai-ops-platform/CLAUDE.md` の 2 ファイルのみ

## 手順

1. `git -C /Users/mryfmo/Workspace/.mryfmo-tmp` でブランチ `agent/T01` を main から作成して checkout
2. 上記 2 ファイル**のみ** `git add`(`.orchestration/` は絶対に add しない)
3. Conventional Commits 形式で commit。例: `docs(ai-ops-platform): make AGENTS.md canonical and reduce CLAUDE.md to @AGENTS.md import`
4. `git push -u origin agent/T01`
5. `gh pr create --repo mryfmo/tmp --base main --head agent/T01` で PR 作成
   - タイトルは commit と同趣旨
   - 本文: 変更内容(AGENTS.md 正本化・CLAUDE.md インポート化)、本文が旧 CLAUDE.md と diff 一致であること、doc-only 変更である旨を簡潔に
   - ラベル `ai-generated` を付与。ラベルが存在しなければ `gh label create ai-generated --repo mryfmo/tmp` で作成してから付与。作成権限エラー等で付与できない場合は PR 本文にその旨を記録して続行
6. **マージはしない**(マージは人間のみ。ADR-0006)

## Allowed files / actions

- git 操作(branch/add/commit/push)は上記 2 ファイルと `agent/T01` ブランチに限定
- `gh` による PR・ラベル操作
- `.orchestration/` 配下の本タスク成果物の書き込み
- リポジトリファイルの新規編集は禁止(T01 の変更をそのまま commit する。内容を変えない)

## Forbidden actions

- main への直接 push、PR のマージ、自動マージ設定
- 2 ファイル以外の add(`git add -A` / `git add .` 禁止。ファイル名を明示して add)
- T01 の変更内容の改変
- force push、既存ブランチ・タグの削除
- 依存関係変更、LLM API 呼び出し

## Expected artifacts

- report: `.orchestration/reports/T02-report.md` — ブランチ名・commit SHA・PR URL
- validation: `.orchestration/validation/T02-validation.txt` — 以下の出力を貼る:
  - `git log --oneline -1 agent/T01`
  - `git show --stat HEAD`(変更が 2 ファイルのみであること)
  - `gh pr view <PR番号> --repo mryfmo/tmp --json url,title,labels,baseRefName,headRefName`
- sandbox: `.orchestration/sandboxes/T02-sandbox.md` — 不使用なら 1 行
- learning: `.orchestration/learning/T02-learning.md` — なければ「none」
- autoskill: `.orchestration/autoskill/runs/T02-autoskill.md` — 不使用なら not-used 記録

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T02 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 10
