# A016: P010-F02-T05 Entra claims を session/caller へ伝播する

- task_id: A016
- repo: /Users/mryfmo/Workspace/ai-ops-platform(worktree /private/tmp/ai-ops-platform-A001)
- 発行: orchestrator-fable5 (2026-07-19)
- 担当: codex-gpt56sol-high
- max_turns: 60
- 根拠: plans/010 P010-F02-T05(本文が正本)+ docs/contracts/entra-subject-mapping.md。

## 前提手順

1. A015 merge 後の最新 origin/main から新ブランチ `agent/p010-f02-t05-entra-claims` を作成。
2. preflight: validator `--through P010-F01-T11` exit 0 を記録。
3. P010-F02-T05 本文・契約・現行 packages/web/src/auth.ts と server auth boundary を全文読了。

## 実装要件(plan 本文の要約)

- Allowed files: `packages/web/src/auth.ts`、Auth.js type declaration、server auth boundary files、
  auth tests のみ。
- resource-server validated な tid/oid/roles を canonicalize し、session へ **stable subject のみ**を渡す。
- **email fallback を削除する**(A014 の schema/repo が subject lookup を提供済み)。
- 認可はデータ取得側強制の原則(設計原則 6)を崩さない。session に PII を追加しない。

## 品質要件

- RED/GREEN テスト。根拠 ID ヘッダ。format / `MISE_LOCKED=1 mise run ci` / traceability green。
- crit CLI 自己レビュー(resolved まで)。
- push → PR(base=main、ai-generated)→ checks green → RESULT。merge は受入後。

## forbidden_actions

- Allowed files 外の編集、依存追加、email fallback の温存、session への email/PII 追加
- merge-before-acceptance、worklog/docs-audit 編集、LLM API、ブラウザ Crit、ユーザーへのレビュー依頼

## 完了報告

```
AGMSG-RESULT v1 task_id=A016 status=ready_for_review|blocked report=.orchestration/reports/A016-report.md validation=.orchestration/validation/A016-validation.md sandbox=.orchestration/sandboxes/A016-sandbox.md learning=.orchestration/learning/A016-learning.md autoskill=.orchestration/autoskill/runs/A016-autoskill.md
```
