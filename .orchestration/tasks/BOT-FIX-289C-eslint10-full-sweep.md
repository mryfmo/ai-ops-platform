# AGMSG-TASK BOT-FIX-289C: @eslint/js 10 全違反の一括検出・一括是正（逐次発覚ループの終結）

- task_id: BOT-FIX-289C
- repo: /Users/mryfmo/Workspace/ai-ops-platform
- 依頼者: claude-deep-dot（orchestrator）
- max_turns: 25

## Objective

PR #289 のCIは lint が最初の失敗パッケージで停止するため、修正のたびに次の違反が発覚する（devops→server と2巡）。**#289 ブランチ自身の lockfile（@eslint/js 10.0.1 含む）を使って全パッケージ lint を一括実行**し、残る全違反を一度に検出・是正して終結させる。確定済み: `packages/server` の `no-useless-assignment`（`healthy`, :32:11 の変数、ファイルは lint で特定）。

## Steps

1. **全量検出**: `git fetch origin dependabot/npm_and_yarn/eslint/js-10.0.1 && git switch -c probe/eslint10 FETCH_HEAD` → `pnpm install --frozen-lockfile`（PR ブランチ自身の lockfile を使うだけで依存変更ではない）→ `pnpm run lint` を**全パッケージ完走するまで**（`pnpm -r --no-bail --if-present run lint` 等で停止させず）実行し、全違反を file:line:rule で列挙
2. **是正**: `git switch -c agent/BOT-FIX-289C origin/main`（main の lockfile に戻る）で全違反を修正。方針は既存2タスクと同じ: 挙動・メッセージ・分岐不変の等価変換、ルール無効化禁止、sanitizer 境界確認、必要最小の回帰テスト
3. **終結証明**: probe/eslint10 へ 289C の修正を merge した一時状態で再度全パッケージ lint → **0 errors** を verbatim 記録（その後 probe ブランチと node_modules を破棄し、main lockfile で `pnpm install --frozen-lockfile` に戻す）
4. `mise run ci`（agent/BOT-FIX-289C 上、fresh DB）
5. Conventional Commit + CompactionDB decision。probe/eslint10 は削除して終了

## allowed_files

- packages/*/src/**（等価是正のみ）/ packages/*/tests/**（最小追随・緩和禁止）
- .orchestration/{reports,validation,sandboxes,learning,autoskill/runs}/BOT-FIX-289C*
- .agents/worklog/codex/**
- probe/eslint10 ブランチ（検出専用・コミット禁止・最後に削除）

## forbidden_actions

- git push / PR 操作 / main lockfile・依存の変更 / eslint 設定変更 / 挙動変更 / probe ブランチのコミット・残置 / LLM API 呼び出し

## Expected artifacts

- report（全違反一覧 file:line:rule と各修正の対応表）/ validation（probe 一括 lint の before/after verbatim 含む）/ sandbox / learning / autoskill
- done_signal: AGMSG-RESULT v1
