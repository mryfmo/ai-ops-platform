# A015: P010-F02-T04 legacy backfill dry-run/apply を実装する

- task_id: A015
- repo: /Users/mryfmo/Workspace/ai-ops-platform(worktree /private/tmp/ai-ops-platform-A001)
- 発行: orchestrator-fable5 (2026-07-19)
- 担当: codex-gpt56sol-high
- max_turns: 60
- 根拠: plans/010 P010-F02-T04(本文が正本)+ docs/contracts/entra-subject-mapping.md +
  A014 で merge 済みの stable subject schema(migration 202607180000)。

## 前提手順

1. 最新 origin/main(bd9887d 以降)から新ブランチ `agent/p010-f02-t04-backfill` を作成。
2. preflight: validator `--through P010-F01-T11` exit 0 を記録。
3. P010-F02-T04 本文・契約・A014 の schema/repo 実装を全文読了。

## 実装要件(plan 本文の要約)

- Allowed files: backfill CLI/script 1 本、parser の pure lib、tests、runbook のみ。
- signed mapping CSV/JSON を validate。dry-run summary/hash、all-or-nothing apply、
  unresolved / duplicate / inactive / cross-tenant は abort。
- Complete: apply は「dry-run の exact digest 一致」+「明示的な sandbox database 確認」を必須とし、
  email-only 行が active のまま残らない。
- Verify: invalid matrix、dry-run が無書込みであること、digest mismatch、transaction rollback、
  idempotent reapply。
- parser・判定は lib/ の pure function に置き、CLI は結線のみ(設計原則 1)。
- runbook は runbooks/ の既存書式に従う(new-runbook 相当の構成)。

## 品質要件

- 使い捨て PostgreSQL(A014 と同じ brew postgresql@16 / tmpdir / port 55432 / 完全破棄)で
  dry-run 無書込み・apply・rollback・reapply を実測し validation へ記録。
- 根拠 ID ヘッダ、format / `MISE_LOCKED=1 mise run ci` / traceability green。
- crit CLI 自己レビュー(resolved まで)。
- push → PR(base=main、ai-generated)→ checks green → RESULT。merge は受入後。

## forbidden_actions

- Allowed files 外の編集(schema 変更・既存 repo 層の変更を含む — 必要が生じたら blocked 報告)、依存追加
- 本番 DB 接続、55432 以外の listen、一時 DB の残置
- merge-before-acceptance、worklog/docs-audit 編集、LLM API、ブラウザ Crit、ユーザーへのレビュー依頼

## 完了報告

```
AGMSG-RESULT v1 task_id=A015 status=ready_for_review|blocked report=.orchestration/reports/A015-report.md validation=.orchestration/validation/A015-validation.md sandbox=.orchestration/sandboxes/A015-sandbox.md learning=.orchestration/learning/A015-learning.md autoskill=.orchestration/autoskill/runs/A015-autoskill.md
```
