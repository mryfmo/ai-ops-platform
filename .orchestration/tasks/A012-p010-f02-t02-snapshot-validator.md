# A012: P010-F02-T02 snapshot validator を実装する

- task_id: A012
- repo: /Users/mryfmo/Workspace/ai-ops-platform(worktree /private/tmp/ai-ops-platform-A001)
- 発行: orchestrator-fable5 (2026-07-18)
- 担当: codex-gpt56sol-high
- max_turns: 60
- 根拠: plans/010 P010-F02-T02(本文が正本)+ docs/contracts/prjops-data.md(A011 で merge 済みの契約)。

## 前提手順

1. 最新 origin/main(7098797 以降)から新ブランチ `agent/p010-f02-t02-snapshot-validator` を作成。
2. preflight: validator `--through P010-F01-T11` exit 0 を記録。
3. P010-F02-T02 本文と docs/contracts/prjops-data.md・schema・fixtures を全文読了。

## 実装要件(plan 本文の要約)

- Allowed files: `packages/prjops/src/lib/` の新 validator、exports、tests、fixtures のみ。
- schema version / sorted checksum / canonical IDs / cross-reference / duplicate identity /
  partial snapshot を **pure function** で fail-closed に(repo 設計原則 1: lib/ は外部 API・LLM・DB 非依存)。
- Complete: DEC-SPEC-001 の全 invalid condition が**固有 error code** で失敗
  (E-SNAPSHOT-* は契約の Failure codes 表と一致させ、独自コードを発明しない)。
- checksum 正規化は docs/contracts/fixtures/checksum-golden-vectors.json の 17 vector を
  テストでそのまま消化して全件一致させること(契約とバイト互換の実装証明)。
- Verify: RED/GREEN focused tests、PrjOps typecheck。describe/it に仕様 ID を含める(repo テスト規約)。

## 品質要件

- 新規ファイルに根拠 ID ヘッダ。format / `MISE_LOCKED=1 mise run ci` / traceability green。
- crit CLI 自己レビュー(resolved まで)。
- push → PR(base=main、ai-generated)→ checks green → RESULT。merge は受入後。

## forbidden_actions

- packages/prjops/src/lib/ 外の製品コード変更(agents/・server・web・schema 禁止)、依存追加
- 契約文書・fixture の変更(矛盾を見つけたら blocked 報告)
- merge-before-acceptance、worklog/docs-audit 編集、LLM API、ブラウザ Crit、ユーザーへのレビュー依頼

## 完了報告

```
AGMSG-RESULT v1 task_id=A012 status=ready_for_review|blocked report=.orchestration/reports/A012-report.md validation=.orchestration/validation/A012-validation.md sandbox=.orchestration/sandboxes/A012-sandbox.md learning=.orchestration/learning/A012-learning.md autoskill=.orchestration/autoskill/runs/A012-autoskill.md
```
