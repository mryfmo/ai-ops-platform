# AGMSG-TASK GOV-PR-02: mint script テストの CI test graph 登録（PR #284 P2 fix-forward）

- task_id: GOV-PR-02
- repo: /Users/mryfmo/Workspace/ai-ops-platform
- 依頼者: claude-deep-dot（orchestrator）
- max_turns: 15

## Objective

PR #284 の bot P2 指摘（comment id 3888500638, 裁定済み・妥当）: `scripts/mint-aiops-pr-token.test.mjs` が `mise run ci` のどの経路からも実行されず、mint script の回帰を CI が検知できない。root `package.json` の `governance:check` の `node --test` 列挙へ本テストファイルを追加し、CI green を確認する。

## Branch

`git switch -c agent/GOV-PR-02 origin/main`。直接コミット、push禁止。

## Steps

1. `package.json` の `governance:check` 内 `node --test` のファイル列挙に `scripts/mint-aiops-pr-token.test.mjs` を追加（1変更のみ。他 script 不変更）
2. `pnpm run governance:check` で本テストが実行されることを verbatim で確認
3. `mise run ci`
4. Conventional Commit（例: `test(governance): run mint token suite in governance check`）
5. CompactionDB decision 追加（コマンド全文を REPORT へ）

## Validation（verbatim）

- `pnpm run governance:check`（mint テスト 9 件の実行が出力に現れること）
- `mise run ci`
- `git log -1 --format='%H %s'` / `git status --porcelain`

## allowed_files

- package.json（governance:check の1行のみ）
- .orchestration/{reports,validation,sandboxes,learning,autoskill/runs}/GOV-PR-02*
- .agents/worklog/codex/**

## forbidden_actions

- git push / PR 操作 / 他ファイル・他 script の変更 / 依存変更 / LLM API 呼び出し

## Expected artifacts

- report / validation / sandbox / learning / autoskill: .orchestration 配下 GOV-PR-02*（cost: 行）
- done_signal: AGMSG-RESULT v1
