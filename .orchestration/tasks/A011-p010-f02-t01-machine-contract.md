# A011: P010-F02-T01 prjops-data machine contract を追加する

- task_id: A011
- repo: /Users/mryfmo/Workspace/ai-ops-platform(worktree /private/tmp/ai-ops-platform-A001)
- 発行: orchestrator-fable5 (2026-07-18)
- 担当: codex-gpt56sol-high
- max_turns: 60
- 根拠: plans/010-recommended-spec-environment-execution.md P010-F02-T01(本文が正本)。
  Phase 1 は T11 まで ACCEPTED(main@7f7ebf1、validator 15 records green)。

## 前提手順

1. 最新 origin/main から新ブランチ `agent/p010-f02-t01-machine-contract` を作成。
2. **preflight(plan 指定)**: `node scripts/validate-acceptance-manifest.mjs --through P010-F01-T11 verification/acceptance-manifest.json` exit 0 を最初に実行・記録。
3. P010-F02-T01 本文と DEC-SPEC-001〜004(docs/spec/productization-decisions.md)を全文読了。

## 作業内容(plan 本文の要約 — 本文優先)

- Allowed files(plan 指定): `docs/contracts/prjops-data.md`、`docs/contracts/entra-subject-mapping.md`、
  `docs/contracts/persona-scope-matrix.md`、`docs/contracts/data-handling.md`、packet 選定の
  contract fixtures/schema files。
- DEC-SPEC-001〜004 を field、type、path、owner、update、delete、checksum、migration disposition へ展開。
- checksum: DEC-SPEC-001 の canonical manifest bytes を実装言語非依存で記述し、
  empty/one/multi/order/LF/CRLF/BOM/NFC-NFD/path/symlink/boundary の input bytes、
  expected canonical manifest bytes、expected SHA-256 を golden vector へ固定。
- Complete: valid/invalid fixtures を人の解釈なしに判定でき、owner/signature 欄と ENV 値が区別される。
- Verify: preflight validator、link/schema validation、unknown field/duplicate/checksum negative fixtures。

## 品質要件

- 新規ファイルに根拠 ID ヘッダ。format / `MISE_LOCKED=1 mise run ci` green。traceability green。
- crit CLI 自己レビュー(resolved まで)。golden vector は再計算可能な導出手順を明記
  (自己申告値でなく、レビュアーが独立再計算できる形)。
- push → PR(base=main、ai-generated)→ checks green → RESULT。merge は受入後。

## forbidden_actions

- plan Allowed files + .orchestration A011-* 以外の編集、製品コード変更、依存追加
- merge-before-acceptance、checks red merge、worklog/docs-audit 編集、LLM API、
  ブラウザ Crit、ユーザーへのレビュー依頼

## 完了報告

```
AGMSG-RESULT v1 task_id=A011 status=ready_for_review|blocked report=.orchestration/reports/A011-report.md validation=.orchestration/validation/A011-validation.md sandbox=.orchestration/sandboxes/A011-sandbox.md learning=.orchestration/learning/A011-learning.md autoskill=.orchestration/autoskill/runs/A011-autoskill.md
```
