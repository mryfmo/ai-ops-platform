# T04: mryfmo/tmp をアーカイブする

## Objective

ai-ops-platform の独立リポジトリ化(T03)が完了し、`mryfmo/tmp` は役目を終えた。ユーザー指示によりアーカイブ(read-only 化)する。削除はしない。

## 手順

1. `gh repo archive mryfmo/tmp --yes`

## Forbidden actions

- リポジトリの削除(`gh repo delete` 禁止)
- mryfmo/tmp 以外のリポジトリへの操作
- ローカルファイルの編集(成果物を除く)

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T04-report.md`
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T04-validation.txt` — `gh repo view mryfmo/tmp --json isArchived` の出力(true であること)
- sandbox: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/sandboxes/T04-sandbox.md` — 不使用なら 1 行
- learning: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/learning/T04-learning.md` — なければ「none」
- autoskill: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/autoskill/runs/T04-autoskill.md` — 不使用なら not-used 記録

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T04 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 5
