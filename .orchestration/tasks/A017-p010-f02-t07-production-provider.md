# A017: P010-F02-T07 production report data provider を実装する

- task_id: A017
- repo: /Users/mryfmo/Workspace/ai-ops-platform(worktree /private/tmp/ai-ops-platform-A001)
- 発行: orchestrator-fable5 (2026-07-19)
- 担当: codex-gpt56sol-high
- max_turns: 80
- 根拠: plans/010 P010-F02-T07(本文が正本)+ docs/contracts/prjops-data.md(T01 契約)+
  A012 snapshot validator + A016 stable subject/persona scope。

## 前提手順

1. 最新 origin/main(ae439e8 以降)から新ブランチ `agent/p010-f02-t07-production-provider` を作成。
2. preflight: validator `--through P010-F01-T11` exit 0 を記録。
3. T07 本文・契約・A012 validator・A016 の scope 実装を全文読了。

## 実装要件(plan 本文の要約)

- Allowed files: provider interface/implementation、repository SQL、tests、config factory
  (packet で選定し report に列挙)。
- pinned snapshot から projects/issues/snapshots/investor inputs を **A012 validator で validate してから**
  ロードし、subject/persona/project 条件を provider/SQL query 自体に含める。
- Complete: **全件 fetch 後 filter は 0 件**(データ取得側強制 — 設計原則 6)、snapshot commit/checksum
  不一致は 503 fail-closed、request 間の active cache 0(recipients active 判定のキャッシュ禁止)。
- Verify: allow/deny の query spy、partial/corrupt snapshot、scope leakage tests。

## 追加要件(orchestrator)

- **P2-05 の解消**: delivery/provider context を DB の scope_mode から構築する本タスクで、
  devops isProjectInScope の legacy fallback(scopeMode 無し ctx の fail-open 分岐)を除去し
  fail-closed 化する。reportPermissionFilter.ts(devops)+ 影響 caller/tests をこの目的に限り許可。

## 品質要件

- 使い捨て PostgreSQL(brew postgresql@16 / tmpdir / port 55432 / 完全破棄)での実測。
- 根拠 ID ヘッダ、format / `MISE_LOCKED=1 mise run ci` / traceability green。
- crit CLI 自己レビュー(resolved まで)。
- push → PR(base=main、ai-generated)→ checks green → RESULT。merge は受入後。

## forbidden_actions

- 選定 packet 外のファイル編集(packet は report に列挙し、逸脱時は blocked 報告)、依存追加
- fetch-all-then-filter 実装、request 間 active cache、snapshot 検証の省略
- 本番 DB 接続、55432 以外の listen、一時 DB の残置
- merge-before-acceptance、worklog/docs-audit 編集、LLM API、ブラウザ Crit、ユーザーへのレビュー依頼

## 完了報告

```
AGMSG-RESULT v1 task_id=A017 status=ready_for_review|blocked report=.orchestration/reports/A017-report.md validation=.orchestration/validation/A017-validation.md sandbox=.orchestration/sandboxes/A017-sandbox.md learning=.orchestration/learning/A017-learning.md autoskill=.orchestration/autoskill/runs/A017-autoskill.md
```
