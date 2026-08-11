# A018: P010-F02-T08 production composition から empty provider を除く

- task_id: A018
- repo: /Users/mryfmo/Workspace/ai-ops-platform(worktree /private/tmp/ai-ops-platform-A001)
- 発行: orchestrator-fable5 (2026-07-19)
- 担当: codex-gpt56sol-high
- max_turns: 80
- 根拠: plans/010 P010-F02-T08(本文が正本)+ A016 resolver + A017 provider factory。

## 前提手順

1. A017 merge 後の最新 origin/main から新ブランチ `agent/p010-f02-t08-composition` を作成。
2. preflight: validator `--through P010-F01-T11` exit 0 を記録。
3. T08 本文と対象 route 群の現状(dashboard/chat/persona/executive/manager/investor/projects/
   timeseries/agent-activity)を全文読了。

## 実装要件(plan 本文の要約)

- Allowed files: 上記 route files を **packet に全件列挙**(report に列挙必須)+ composition tests。
- 共有 pool と T06/T07 の provider factory を全 route へ注入。InMemory provider は test/dev-only に限定。
- Complete: production source で empty `InMemory*Provider([])` の match **0**、全 route が同一の
  auth/provider policy を使用。
- Verify: repository `rg` 検証、**9+ route の allow/deny integration matrix**、connection pool reuse test。
- 未設定時にゼロ件を「正常」として描画しない(docs/audit の要求どおり、設定欠如はバナー/エラー)。

## 品質要件

- 根拠 ID ヘッダ、format / `MISE_LOCKED=1 mise run ci` / traceability green。
- crit CLI 自己レビュー(resolved まで)。
- push → PR(base=main、ai-generated)→ checks green → RESULT。merge は受入後。

## forbidden_actions

- packet 外の編集(packet は report に列挙)、依存追加、provider/resolver 本体の仕様変更
  (T06/T07 成果の結線のみ。本体修正が必要なら blocked 報告)
- merge-before-acceptance、worklog/docs-audit 編集、LLM API、ブラウザ Crit、ユーザーへのレビュー依頼

## 完了報告

```
AGMSG-RESULT v1 task_id=A018 status=ready_for_review|blocked report=.orchestration/reports/A018-report.md validation=.orchestration/validation/A018-validation.md sandbox=.orchestration/sandboxes/A018-sandbox.md learning=.orchestration/learning/A018-learning.md autoskill=.orchestration/autoskill/runs/A018-autoskill.md
```
