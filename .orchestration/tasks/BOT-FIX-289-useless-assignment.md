# AGMSG-TASK BOT-FIX-289: no-useless-assignment 3件の是正（@eslint/js 10 受け入れ準備）

- task_id: BOT-FIX-289
- repo: /Users/mryfmo/Workspace/ai-ops-platform
- 依頼者: claude-deep-dot（orchestrator）
- max_turns: 15
- 着手順: CHORE-HYG-01 完了後

## Objective

dependabot PR #289（@eslint/js 9.39.5→10.0.1）で新たに有効化される `no-useless-assignment` が `packages/devops/src/lib/deployMonitor.ts` の `lastInRun`（50:7 初期化 / 59:7 リセット、+1件）を検出し lint が fail する。**ルール無効化ではなくコード是正**で対応し、main に先行して landing することで #289 を green 化する。

## Branch

`git switch -c agent/BOT-FIX-289 origin/main`。直接コミット、push禁止。

## Steps

1. `deployMonitor.ts` の該当ロジックを読み、`lastInRun` の意味（run 継続の追跡）を保ったまま不要代入を除去するリファクタ（挙動変更禁止。既存テスト `packages/devops/tests/` の deployMonitor 系が回帰を保証）
2. 検証で `@eslint/js@10` 相当の指摘が消えることを確認: 一時的な依存導入は禁止のため、`eslint . --config ../../eslint.config.mjs` の現行実行が green であることに加え、**該当3行のパターンが解消されている diff レビュー**を validation に記載（10 系ルールの厳密再現はローカル不可の旨を明記。最終確認は #289 の CI）
3. `pnpm --filter @aiops/devops run test`（deployMonitor 系含む）
4. `mise run ci`
5. Conventional Commit（例: `refactor(devops): remove useless assignments in deploy monitor`）+ CompactionDB decision

## allowed_files

- packages/devops/src/lib/deployMonitor.ts
- packages/devops/tests/**（必要な回帰テスト追加のみ。既存期待値の緩和禁止）
- .orchestration/{reports,validation,sandboxes,learning,autoskill/runs}/BOT-FIX-289*
- .agents/worklog/codex/**

## forbidden_actions

- git push / PR 操作 / 依存変更 / eslint 設定・ルールの変更 / 挙動変更 / LLM API 呼び出し

## Expected artifacts

- report / validation / sandbox / learning / autoskill: .orchestration 配下 BOT-FIX-289*（cost: 行）
- done_signal: AGMSG-RESULT v1
