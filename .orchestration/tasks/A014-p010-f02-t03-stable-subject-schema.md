# A014: P010-F02-T03 stable subject schema/migration を実装する

- task_id: A014
- repo: /Users/mryfmo/Workspace/ai-ops-platform(worktree /private/tmp/ai-ops-platform-A001)
- 発行: orchestrator-fable5 (2026-07-18)
- 担当: codex-gpt56sol-high
- max_turns: 60
- 根拠: plans/010 P010-F02-T03(本文が正本)+ docs/contracts/entra-subject-mapping.md(A011 merge 済み)。
  repo 規約: schema 変更手順(AGENTS.md)— schema.sql は fresh 用最新形のみ、ALTER は新規
  migrations/NNN_description.sql、対応 repo 層とテストを同一 PR、audit_log の UPDATE/DELETE 権限は付与しない。

## 前提手順

1. 最新 origin/main から新ブランチ `agent/p010-f02-t03-stable-subject` を作成。
2. preflight: validator `--through P010-F01-T11` exit 0 を記録。
3. P010-F02-T03 本文・entra-subject-mapping 契約・既存 schema.sql / migrations / recipient・stakeholder
   関連 repo 層を全文読了。

## 実装要件(plan 本文の要約)

- Allowed files: `packages/devops/src/db/schema.sql`、新規 migration、recipient/stakeholder repository、
  DB tests のみ。
- tenant/object UUID、active、scope_mode、unique key、backfill disposition/state を追加。
  email unique / authorization dependency は除く(T05 以降の領分)。
- Complete: fresh / upgrade / reapply green、duplicate / NULL / foreign tenant fail、
  audit の UPDATE/DELETE 権限不変。
- Verify: disposable PostgreSQL での実測、catalog constraint queries、rollback rehearsal
  (rollback DDL を PR 本文に記載 — repo 規約)。

## disposable PostgreSQL(環境指示)

- brew の postgresql@16 を使い、**使い捨てインスタンス**を worktree 外の一時ディレクトリに構築:
  `initdb` → `pg_ctl -o "-p 55432 -k <tmpdir>" start` → 検証 → `pg_ctl stop` → データディレクトリ削除。
- システムの brew service は起動・変更しない。port 55432 以外を使わない。
- `TEST_DATABASE_URL=postgres://localhost:55432/<db>` 形で verification/run_db_integration.sh の
  既存パターンに従う。接続文字列に秘密値は含めない。

## 品質要件

- 新規ファイルに根拠 ID ヘッダ。format / `MISE_LOCKED=1 mise run ci` / traceability green。
- fresh 適用・migration upgrade・再適用(idempotent)の 3 経路すべての実測ログを validation へ。
- crit CLI 自己レビュー(resolved まで)。
- push → PR(base=main、ai-generated、rollback DDL 記載)→ checks green → RESULT。merge は受入後。

## forbidden_actions

- Allowed files 外の編集、依存追加、schema.sql への inline ALTER、audit_log への UPDATE/DELETE 権限付与
- システム postgres サービスの起動/変更、55432 以外の listen、一時 DB の残置
- merge-before-acceptance、worklog/docs-audit 編集、LLM API、ブラウザ Crit、ユーザーへのレビュー依頼

## 完了報告

```
AGMSG-RESULT v1 task_id=A014 status=ready_for_review|blocked report=.orchestration/reports/A014-report.md validation=.orchestration/validation/A014-validation.md sandbox=.orchestration/sandboxes/A014-sandbox.md learning=.orchestration/learning/A014-learning.md autoskill=.orchestration/autoskill/runs/A014-autoskill.md
```
