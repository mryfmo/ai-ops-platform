# A008: P010-F01-T11 Phase 1 acceptance(docs 同期 + full CI + 独立レビュー準備)

- task_id: A008
- repo: /Users/mryfmo/Workspace/ai-ops-platform(worktree /private/tmp/ai-ops-platform-A001)
- 発行: orchestrator-fable5 (2026-07-18)
- 担当: codex-gpt56sol-high
- max_turns: 40
- 根拠: plans/010-recommended-spec-environment-execution.md P010-F01-T11(本文が正本)。
  T01〜T10 は ACCEPTED(manifest 14 records、main@d21ddff で validator green 確認済み)。

## 前提手順

1. 最新 origin/main から新ブランチ `agent/p010-f01-t11-phase1-acceptance` を作成。
2. Plan 010 の P010-F01-T11 本文を全文読み、Complete/Verify を仕様として扱う。

## 作業内容

1. Allowed files(plan 指定)の docs/schema/output 同期:
   - `docs/reference/page-agent-tools.md`、`docs/reference/http-api.md` を final HEAD の実装と同期
   - spec catalog / generated output(traceability matrix 等)を final HEAD で再生成し、regression なし
2. Verify(plan 指定)を実行し validation に記録:
   - clean checkout 相当で `MISE_LOCKED=1 mise run ci` green
   - generated matrix の regression なし
   - `node scripts/validate-acceptance-manifest.mjs --through P010-F01-T10 verification/acceptance-manifest.json` exit 0
   - task universe golden fixture 一致
3. **独立レビューの準備**: 変更点と Phase 1 全体(T01〜T10 成果)の self-review を crit CLI で実施し、
   P0/P1 finding 0、P2 は owner/date/mitigation 付きで記録。orchestrator 側でも独立の
   high review を別途実施する(worker はその材料として diff 要約と検証証跡を report に揃える)。
4. push → PR(base=main、ai-generated)→ hosted checks green → RESULT。merge と T11 record 追加は
   orchestrator の受入・独立レビュー後(record は A007 と同じ機械的コミット方式で別途指示)。

## allowed_files

- docs/reference/page-agent-tools.md
- docs/reference/http-api.md
- spec catalog / generated output(final HEAD で生成されるファイルのみ。生成コマンドと対象を validation に列挙)
- .orchestration の A008-* 成果物一式

## forbidden_actions

- 上記以外の編集、製品ロジック変更、依存追加、T11 record の作成(自己参照禁止)
- merge-before-acceptance、checks red merge
- worklog・docs/audit 編集、LLM API、ブラウザ Crit、ユーザーへのレビュー依頼

## 完了報告

```
AGMSG-RESULT v1 task_id=A008 status=ready_for_review|blocked report=.orchestration/reports/A008-report.md validation=.orchestration/validation/A008-validation.md sandbox=.orchestration/sandboxes/A008-sandbox.md learning=.orchestration/learning/A008-learning.md autoskill=.orchestration/autoskill/runs/A008-autoskill.md
```
