# AGMSG-TASK BOT-FIX-276: PR #276 TypeScript 6.0.3 移行の CI green 化

- task_id: BOT-FIX-276
- repo: /Users/mryfmo/Workspace/ai-ops-platform
- 依頼者: claude-deep-dot（orchestrator）
- max_turns: 40

## Objective

dependabot PR #276（TypeScript 5.9.3 → 6.0.3）の build-test 失敗を是正し、`mise run ci` green でコミットする。

## Branch

`git fetch origin dependabot/npm_and_yarn/typescript-6.0.3 && git switch dependabot/npm_and_yarn/typescript-6.0.3`。直接コミット、push禁止。**`@dependabot rebase` を発火させる操作（PR コメント等）は厳禁**（force-push で commit が消える）。作業後は main へ復帰。

## 既知の失敗（orchestrator 確認済み）

`packages/policy` の build が TS6 で `RequestInit` / `Response` / `URL` / `fetch` / `AbortController` / `setTimeout` / `clearTimeout` の TS2304 で失敗（CI run job 99188509881）。TS6 の lib/types 解決変更により、当該 package の tsconfig がグローバル型を得られていない。policy 以降の package にも同種の失敗が潜在し得る。

## Steps

1. `pnpm install`（lockfile は dependabot が更新済み。**lockfile・依存 version の変更禁止**）
2. `mise run ci` を実行し全失敗を収集
3. tsconfig の lib/types 調整（`tsconfig.base.json` または該当 package の tsconfig.json）で TS6 に適合させる。方針: 実行環境の実態に合わせる（Node 22 ランタイムのグローバルなら `@types/node` 参照 or lib "ESNext" + types 追記等、**既存の他 package の構成パターンに揃える**）。ソースコード変更は型注釈の互換調整が不可避な場合の最小限のみ（挙動変更禁止）
4. `mise run ci` green まで反復
5. Conventional Commit（例: `fix(build): adapt tsconfigs to TypeScript 6 lib resolution`）
6. CompactionDB decision 追加（コマンド全文を REPORT へ）

## Validation（verbatim）

- `mise run ci`
- `git log -1 --format='%H %s'` / `git status --porcelain`
- 変更した各 tsconfig の diff 全文

## allowed_files

- tsconfig.base.json / packages/*/tsconfig.json（必要なもののみ）
- packages/*/src/**（型互換の最小調整が不可避な場合のみ。挙動変更・API 変更禁止。変更したら REPORT で1件ずつ理由を説明）
- .orchestration/{reports,validation,sandboxes,learning,autoskill/runs}/BOT-FIX-276*
- .agents/worklog/codex/**

## forbidden_actions

- git push / PR 操作 / @dependabot コマンド / 他ブランチ変更
- package.json の依存 version・pnpm-lock.yaml・.mise.toml・mise.lock の変更（dependabot 更新分の維持）
- テストの skip 化・期待値の緩和・coverage thresholds 変更
- LLM API 呼び出し

## Expected artifacts

- report / validation / sandbox / learning / autoskill: .orchestration 配下 BOT-FIX-276*（cost: 行、[memory:decision]/[memory:failure]）
- done_signal: AGMSG-RESULT v1
