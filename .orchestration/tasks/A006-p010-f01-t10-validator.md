# A006: P010-F01-T10 acceptance manifest validator を実装する

- task_id: A006
- repo: /Users/mryfmo/Workspace/ai-ops-platform(worktree /private/tmp/ai-ops-platform-A001)
- 発行: orchestrator-fable5 (2026-07-18)
- 担当: codex-gpt56sol-high
- max_turns: 60
- 根拠: plans/010-recommended-spec-environment-execution.md P010-F01-T10(本文の Allowed files /
  Complete / Verify / Negative が正本。本タスクファイルはその要約+dev-phase 文脈の付加)。
  trust 文脈: docs/decisions/acceptance-trust-bootstrap.md(DEV-DEFAULT、PR #99)。
  過去の REVISE 理由: worker が偽 receipt を自作して green にできた。この是正が本タスクの中核。

## 前提手順

1. A005-merge 完了後の最新 origin/main から新ブランチ `agent/p010-f01-t10-validator` を作成。
2. Plan 010 の P010-F01-T10 本文を全文読み、Complete/Negative を仕様として扱う。

## 実装要件(plan 本文の要約)

- Allowed files(plan 指定): `scripts/validate-acceptance-manifest.mjs`、
  `tests/validate-acceptance-manifest.test.mjs`、`verification/acceptance-manifest.json`、
  root package.json の script entry のみ。
- task universe 抽出: `^#### P010-F[0-9]{2}-T[0-9]{2} ` のみを正規見出しとし、合計 86 件
  (F00=4, F01=11, F02=14, F03=8, F04=8, F05=20, F06=18, F07=3)。golden fixture と完全一致。
- `--through` / `--final` で task ID・status・target SHA・command exit・artifact SHA・
  dependency ancestry・external/human fields を検証。
- exit 1 条件: missing/extra/duplicate/out-of-order/blocked、plan hash mismatch、nonzero command、
  missing artifact、dependency non-ancestor、required null。未来 task は `--through` で要求しない。
- Negative(不受理): symlink artifact、repo 外 path、hash mismatch、自己申告のみの review/ENV evidence。
- 偽 receipt 対策: receipt/record の検証は plan の immutable commit/blob hash と repo 実体
  (git object)からの導出のみを信頼し、manifest 内の自己申告値単独で green にしない。
  reviewer/approver フィールドは requester と同一なら reject(dev-phase では DEV-REVIEWER-1 等の
  DEV-DEFAULT 名を許容するが、その場合 output に DEV-TRUST 警告を必ず出す。silent pass 禁止)。
- 実 manifest: 既に ACCEPTED の task(F00-T01..T04, F01-T01..T09)のみを含む
  `verification/acceptance-manifest.json` を作成し、`--through P010-F01-T09` で green にする。
  T10 自身の record は含めない(自己参照禁止。record 追加は受入後に orchestrator が行う)。

## 検証

- Node test(node:test)で valid / 各 invalid fixture(少なくとも exit-1 条件の各分類 1 件+
  Negative 4 分類)を網羅。
- `MISE_LOCKED=1 mise run format` / `MISE_LOCKED=1 mise run ci` green。
- 新規ファイルに根拠 ID ヘッダ(P010-F01-T10 / 関連 REQ/ADR)。traceability が通ること。
- crit CLI 自己レビュー(resolved まで)。

## 完了報告・PR

- Conventional Commit → push → PR 作成(base=main、ai-generated、DEV-TRUST 文脈を本文に明記)、
  hosted checks green 確認まで。merge は受入後の next_action。
- 成果物パスは A00x 慣行どおり(reports/validation/sandboxes/learning/autoskill の A006-*)。

```
AGMSG-RESULT v1 task_id=A006 status=ready_for_review|blocked report=.orchestration/reports/A006-report.md validation=.orchestration/validation/A006-validation.md sandbox=.orchestration/sandboxes/A006-sandbox.md learning=.orchestration/learning/A006-learning.md autoskill=.orchestration/autoskill/runs/A006-autoskill.md
```

## forbidden_actions

- plan 指定 Allowed files + .orchestration A006 成果物以外の編集(package.json は script entry 1 行のみ)
- 依存追加、schema 変更、merge-before-acceptance、checks red merge
- T10 自身の acceptance record の作成(自己参照禁止)
- worklog・docs/audit 編集、LLM API、ブラウザ Crit、ユーザーへのレビュー依頼
