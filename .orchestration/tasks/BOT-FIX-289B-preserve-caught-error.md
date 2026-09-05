# AGMSG-TASK BOT-FIX-289B: preserve-caught-error 全掃引（@eslint/js 10 受け入れ最終）

- task_id: BOT-FIX-289B
- repo: /Users/mryfmo/Workspace/ai-ops-platform
- 依頼者: claude-deep-dot（orchestrator）
- max_turns: 15

## Objective

PR #289 の再CI で ESLint 10 新 recommended ルール `preserve-caught-error` が `packages/devops/src/agents/AGT_RPT.ts:140`（catch した error を cause に添えず `E-DLV01` を throw）を検出。lint は devops で停止したため**後続パッケージに同種違反が潜在**し得る。確定1件の修正+全パッケージ掃引を行う。

## Branch

`git switch -c agent/BOT-FIX-289B origin/main`。直接コミット、push禁止。

## Steps

1. AGT_RPT.ts:140 の throw を `new Error(\`E-DLV01: ...\`, { cause: error })` へ（メッセージ不変）
2. **全パッケージ掃引**: `packages/*/src` の catch ブロック内で元エラーを cause に載せず新 Error/TypeError/RangeError を throw する箇所を機械的に洗い出し（例: `grep -rn -A6 'catch' packages/*/src | grep 'throw new'` を起点に AST 的確認）、同形で `{ cause }` を付与。**メッセージ・型・分岐の変更禁止**。cause 追加が secretSanitizer 境界（原則4）に抵触しないか各箇所で確認し、外部送出面（PRコメント/LLM入力/ログ出力）に cause が漏れる経路があれば付与を見送り REPORT に理由を記載
3. 対象パッケージの focused tests + `mise run ci`
4. Conventional Commit + CompactionDB decision

## 注意

- ESLint 10 系ルールのローカル厳密再現は依存変更禁止のため不可。掃引の網羅性は grep+目視根拠を validation に列挙し、最終確認は #289 CI に委任
- 修正箇所一覧（file:line）を REPORT に全件記載

## allowed_files

- packages/*/src/**（cause 付与のみ）/ packages/*/tests/**（既存期待値が message 比較で壊れる場合の最小追随のみ。緩和禁止）
- .orchestration/{reports,validation,sandboxes,learning,autoskill/runs}/BOT-FIX-289B*
- .agents/worklog/codex/**

## forbidden_actions

- git push / PR 操作 / 依存変更 / eslint 設定変更 / メッセージ・挙動変更 / LLM API 呼び出し

## Expected artifacts

- report / validation / sandbox / learning / autoskill: .orchestration 配下 BOT-FIX-289B*（cost: 行）
- done_signal: AGMSG-RESULT v1
