# A001: plans 精査・残作業インベントリ整理

- task_id: A001
- repo: /Users/mryfmo/Workspace/ai-ops-platform
- 発行: orchestrator-fable5 (2026-07-18)
- 担当: codex-gpt56sol-high
- max_turns: 30

## 目的

plans/ 配下の全計画文書・plans/README.md 状態表・docs/audit/09-remediation-plan.md チェックリスト・`.agents/worklog/codex/todo/` の残項目を、origin/main の実装実態(git log・実ファイル・grep 証跡)と突き合わせ、乖離を是正した「残作業インベントリ」を作成する。

## 背景(オーケストレーター調査済みの既知事実)

- 現ブランチ `agent/T-P0-04` は merge 済みで origin/main(ce912e6)より古い。
- Plan 012(`plans/012-*`)は origin/main 上にのみ存在し、旧ブランチの working tree に無い。
- plans/README.md の状態表は 001–009 のみ。untracked の `plans/013-page-agent-pptx-parity.md` と `plans/0018-page-agent-architecture.md` が未掲載。
- worklog `.agents/worklog/codex/todo/20260716_124308_todo.md` は Plan 012 の P012-PLAN-R15-01〜03 是正と Phase 0 以降の実装が残と記録。
- docs/audit/09-remediation-plan.md のチェックリストは一部実態と乖離(例: T-P0-04 は PR #43 で完了・merge 済みだが未チェック項目が残る)。

## 前提手順

1. `git fetch origin`
2. origin/main から作業ブランチ `agent/A001-plans-audit` を作成して checkout する
   (untracked ファイルはそのまま持ち越す。main へ直接 push しない)。
3. checkout 後、`plans/012-*` を含む plans/ 全ファイルを精査対象とする。

## 作業内容

1. plans/ の各 plan(001〜009, 010, 011, 012, 013, 0018, README)について、記載の完了条件・チェックリスト・Status を origin/main の実態(実ファイル存在、grep、git log/PR 参照)と突き合わせる。
   注: origin/main の plans/README.md は旧ブランチ版より新しく、既に 010(IN PROGRESS)/011(BLOCKED)/012(TODO)を含む。checkout 後の版を正とし、そこからの乖離を是正する。
2. 各 plan の「実際の残作業」を、フェーズゲート・依存順に列挙する。各項目に判定根拠(コマンドと結果、コミット ID、ファイルパス)を付す。
3. docs/audit/09-remediation-plan.md のチェックリストのうち、実装済みなのに未チェックの項目・実態と矛盾する項目を列挙する(このファイル自体は編集しない。レポートで指摘のみ)。
4. plans/README.md の状態表を実態同期する: 012/013/0018 の行を追加し、各 Status(DONE/BLOCKED/TODO/IN PROGRESS)を証跡に基づき是正する。表と Status 行以外の本文は変更しない。
5. 各 plan ファイル内に Status 欄がある場合、その行のみ実態に合わせて更新してよい。それ以外の plan 本文は書き換えない。

## allowed_files

- plans/README.md(状態表・Status 行のみ)
- plans/*.md(Status 欄・状態表の行のみ)
- .orchestration/reports/A001-remaining-work.md
- .orchestration/reports/A001-blocked.md(blocked 時のみ)
- .orchestration/validation/A001-validation.md
- .orchestration/sandboxes/A001-sandbox.md
- .orchestration/learning/A001-learning.md
- .orchestration/autoskill/runs/A001-autoskill.md

## forbidden_actions

- 製品コード・テスト・schema・依存関係(package.json / lockfile / .mise.toml)の変更
- git push、PR 作成、main への直接操作、worklog(.agents/worklog/)の削除・改変
- docs/audit/ 配下の編集(指摘はレポートに書く)
- LLM API 呼び出し、外部ネットワーク書込み
- ブラウザ Crit レビューの起動、ユーザーへのレビュー依頼(Crit はエージェント自身の CLI レビューのみ可)
- plan 本文の実質的書換え(状態表・Status 行以外)
- スキル registry の promotion 判断

## 成果物(正確にこのパスへ)

| 種別 | パス |
| --- | --- |
| report | .orchestration/reports/A001-remaining-work.md |
| validation | .orchestration/validation/A001-validation.md |
| sandbox | .orchestration/sandboxes/A001-sandbox.md(未使用なら not-used 記録) |
| learning | .orchestration/learning/A001-learning.md |
| autoskill | .orchestration/autoskill/runs/A001-autoskill.md(未使用なら not-used 記録) |

report の構成要件:

- plan 別セクション(001〜009, 010, 011, 012, 013, 0018)。各セクションに: 現 Status → 是正後 Status、残作業項目(依存順)、判定根拠。
- 最後に横断サマリ: フェーズゲート順の「次にやるべき残作業」一覧と、docs/audit/09 チェックリストの乖離指摘一覧。
- 秘密値・実トークン・実メールアドレスを書かない。

## 検証

- `.orchestration/validation/A001-validation.md` に判定に使った主要コマンドと出力(要約可)を記録する。
- plans/README.md 変更後、`git diff --stat` と `git diff --check` の結果を validation に含める。
- 変更が allowed_files の範囲内であることを `git status --short` で確認し validation に含める。

## 完了報告

作業完了(または blocked)時、以下を送信する:

```
AGMSG-RESULT v1 task_id=A001 status=ready_for_review|blocked report=.orchestration/reports/A001-remaining-work.md validation=.orchestration/validation/A001-validation.md sandbox=.orchestration/sandboxes/A001-sandbox.md learning=.orchestration/learning/A001-learning.md autoskill=.orchestration/autoskill/runs/A001-autoskill.md
```

blocked の場合も report と validation に blocker の説明と証跡を書いてから送信する。
