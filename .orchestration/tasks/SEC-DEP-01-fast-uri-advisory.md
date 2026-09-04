# AGMSG-TASK SEC-DEP-01: fast-uri HIGH advisory 4件の解消（全CI前提の先行修正）

- task_id: SEC-DEP-01
- repo: /Users/mryfmo/Workspace/ai-ops-platform
- 依頼者: claude-deep-dot（orchestrator）
- max_turns: 15

## Objective

fast-uri 3.1.5 の HIGH advisories（GHSA-5jgf-p345-68v8 / GHSA-f65p-4m7j-42xc / GHSA-fph4-wmhf-6fwf / GHSA-jqff-g426-hqxp）で `mise run ci` の audit 段階が main を含む全ブランチで停止する。orchestrator 確認済み: 3.x 系の修正版は **3.1.6**（GitHub Advisory DB）。既存の workspace override `"fast-uri@3": "^3.1.5"` は同 major 内 pin の確立規約（pnpm-workspace.yaml コメント参照）で、floor 引き上げ+lockfile 更新のみで解消できる。

## Branch

**CHORE-HYG-01 を一時中断**し、`git switch -c agent/SEC-DEP-01 origin/main` で本タスクを先に完了させる（CHORE-HYG-01 branch はそのまま温存。完了後に戻り、origin/main を merge して再検証する）。直接コミット、push禁止。

## Steps

1. `pnpm-workspace.yaml` の override を `"fast-uri@3": "^3.1.6"` へ引き上げ（既存規約どおり same-major floor pin。コメント行の整合も確認）
2. lockfile を fast-uri のみ更新（例: `pnpm update fast-uri` / `pnpm install` 後、`git diff pnpm-lock.yaml` が fast-uri 関連解決のみであることを確認。他パッケージの解決が動く場合は最小化する）
3. `pnpm audit --prod`（または ci の audit 相当）で該当 4 GHSA が消えることを verbatim 確認
4. `mise run ci`
5. Conventional Commit（例: `chore(deps): raise fast-uri floor to 3.1.6 (GHSA-5jgf-p345-68v8 et al.)`）
6. CompactionDB decision 追加

## Validation（verbatim）

- 変更前の audit 失敗（RED）と変更後の audit 通過
- `git diff pnpm-lock.yaml` の全文（fast-uri 限定であることの証明）
- `mise run ci` / `git log -1 --format='%H %s'` / `git status --porcelain`

## allowed_files

- pnpm-workspace.yaml（fast-uri override 行のみ）
- pnpm-lock.yaml（fast-uri 解決の更新のみ）
- .orchestration/{reports,validation,sandboxes,learning,autoskill/runs}/SEC-DEP-01*
- .agents/worklog/codex/**

## forbidden_actions

- git push / PR 操作 / 他依存の追加・更新 / package.json 変更 / LLM API 呼び出し

## Expected artifacts

- report / validation / sandbox / learning / autoskill: .orchestration 配下 SEC-DEP-01*（cost: 行）
- done_signal: AGMSG-RESULT v1（完了後、CHORE-HYG-01 へ復帰し origin/main merge 後の再検証まで行ってから CHORE-HYG-01 の RESULT を送る）
