# A002: Plan 012 正本再同期(R15-01〜03 是正 + 115-task universe 復元)

- task_id: A002
- repo: /Users/mryfmo/Workspace/ai-ops-platform(作業は worktree /private/tmp/ai-ops-platform-A001 の stacked branch で行う)
- 発行: orchestrator-fable5 (2026-07-18)
- 担当: codex-gpt56sol-high
- max_turns: 40

## 目的

plans/012-conversational-github-operations-and-minutes.md を、過去セッションでレビュー済みの 115-task 改訂内容(R15-01〜03 是正込み)へ再同期し、plan 正本と worklog 記録の乖離(99 vs 115 task)を解消する。

## 既知事実(オーケストレーター検証済み)

- origin/main の plans/012 は 99 `#### P012-F` headings。
- `origin/agent/012-conversational-github-operations` は旧 99-task 版(content sha256 `ecbb92a1...`、目標 `926e2c97...` と不一致)。**改訂ソースに使わないこと。**
- 115-task 改訂版(固定 sha256 `926e2c9710fe874b5546a6b4459b4fcf656db1b777fc39b26258146f1e238ee4`)はどの git ref にも存在しない。復元源は `.agents/worklog/codex/plan/20260716_124308_plan.md`・`20260715_205536_plan.md`・todo `20260716_124308_todo.md` に記録された自分自身のレビュー済み設計記録である。
- 分割記録: T02→T02A〜T02E、F02-T07→T07A〜T07H、F03-T12→T12A〜T12E、F01-T08A 追加。115 task = 41 formal + 74 Steps。R15-01〜03:
  1. R15-01: Key Vault current-state evidence を Activity Log authority から data-plane exact version GET へ是正
  2. R15-02: Project board response を archived/redacted/deleted 除外へ固定
  3. R15-03: status-not-found response ref と HTTP 404 を machine contract root へ追加

## 前提手順

1. worktree /private/tmp/ai-ops-platform-A001 で、`agent/A001-plans-audit`(5f20de4)から stacked branch `agent/A002-plan012-resync` を作成。
2. 復元は worklog 記録に基づき plans/012 を全面改訂する。exact SHA `926e2c97...` の再現は必須ではないが、**内容が一致しない限りこの SHA を validation で主張しないこと**。一致しない場合は新改訂版として全検査を再実行し、その旨を明記する。

## 作業内容

1. plans/012 本文を 115-task universe へ改訂(見出し・依存表とも 115、R15-01〜03 反映、Execution checkpoint 更新)。
2. 機械検証を再実行し validation に記録:
   - `#### P012-F` headings = 115、依存行 = 115、7 field 欠落 0
   - 未知依存 0、重複 0、cycle 0、共有 Allowed path の無順序所有 0
   - (検証スクリプトが repo に無い場合は使い捨てスクリプトを .orchestration/validation/ 配下に置き、plans/ 以外へ恒久ファイルを追加しない)
3. `pnpm run format:write` 相当で Prettier 整形し、`mise run format` を green に。
4. `MISE_LOCKED=1 mise run ci` を worktree で実行し green を確認(install が必要なら実施)。
5. crit CLI による自己 cold review(review スコープの記録を resolve まで)。ブラウザ/ユーザー依頼は禁止。

## allowed_files

- plans/012-conversational-github-operations-and-minutes.md
- plans/README.md(012 行の Status/notes に変更が必要な場合のみ)
- .orchestration/reports/A002-report.md
- .orchestration/validation/A002-validation.md(+ 使い捨て検証スクリプト A002-*.mjs 等)
- .orchestration/sandboxes/A002-sandbox.md
- .orchestration/learning/A002-learning.md
- .orchestration/autoskill/runs/A002-autoskill.md

## forbidden_actions

- 製品コード・テスト・schema・依存関係の変更(mise.lock 含む。ci が lock 変更を要求したら blocked 報告)
- git push、PR 作成、main への直接操作、commit 作成(受入後に別途指示)
- worklog・docs/audit の編集、LLM API 呼び出し
- ブラウザ Crit レビュー起動、ユーザーへのレビュー依頼
- 旧 99-task 版ブランチ(origin/agent/012-*)の内容流用

## 成果物(正確にこのパスへ)

| 種別 | パス |
| --- | --- |
| report | .orchestration/reports/A002-report.md |
| validation | .orchestration/validation/A002-validation.md |
| sandbox | .orchestration/sandboxes/A002-sandbox.md |
| learning | .orchestration/learning/A002-learning.md |
| autoskill | .orchestration/autoskill/runs/A002-autoskill.md |

report 構成要件: R15-01〜03 の反映箇所(見出し/行)対応表、99→115 の差分要約(追加/分割/再採番一覧)、機械検証結果、旧版 SHA との一致/不一致宣言。

## 完了報告

```
AGMSG-RESULT v1 task_id=A002 status=ready_for_review|blocked report=.orchestration/reports/A002-report.md validation=.orchestration/validation/A002-validation.md sandbox=.orchestration/sandboxes/A002-sandbox.md learning=.orchestration/learning/A002-learning.md autoskill=.orchestration/autoskill/runs/A002-autoskill.md
```
