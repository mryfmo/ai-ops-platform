# P1-T04 versioned Control API / event contracts

- task_id: `P1-T04`
- 根拠: FinalArch:CON-001 / CON-002 / CON-004 / CON-005 / PRD-003 / FR-CP-001 / ADR-0020
- Writer: codex-gpt56-sol-high / Reviewer: claude-code-fable5-xhigh
- depends_on: P1-T01(merged `c153c81`)。WBS P1-T04 が正本
- branch: `agent/P1-T04-versioned-contracts`(base = main `d8a049f` 以降)

## allowed_paths(この範囲外の編集禁止)

1. `contracts/**`(新設。repo 実装用の versioned contract の正本置き場)
2. `docs/contracts/**`(契約の説明文書が必要な場合)

pack 内の正典契約(`docs/plans/2026-08-final-architecture/05_contracts/*`)は**編集禁止**。
そこからの取込は「コピー + 出所と版の明記」で行い、差分を付ける場合は理由を文書化。

## deliverables

- OpenAPI(Control API。正典 `control-api.openapi.yaml` を基点に version を明示)
- AsyncAPI(events。正典 `events.asyncapi.yaml` 基点)
- JSON Schemas(domain / policy-input / policy-decision。正典基点。
  P1-T01 の `WORKFLOW_KINDS` 7 種・`VersionedPayload(schemaVersion)` と矛盾しないこと)

## acceptance

- contract lint green(lint 手段は既存依存を優先。新規依存が必要なら最小の
  well-known なもの 1 つまでとし、選定理由を report に記載)
- **backward-compatibility baseline stored**(現版のハッシュ/コピーを
  `contracts/baseline/` 等に固定し、後続 PR が互換破壊を検知できる形。
  検知は schema validation テストまたは CI 実行可能なスクリプトで機械化)
- 正典との対応関係(どのファイルがどの正典契約の版か)を README か
  docs/contracts に 1 枚で明記
- 新規ファイルに根拠 ID ヘッダ / describe・it に spec ID

## verification

- contract lint(実行コマンドを validation に記録)
- schema validation テスト(正典との整合 + baseline 突合)
- fresh DB `mise run ci` exit 0 を単独判定してから push

## フロー

- App token で push / PR 作成、`ai-generated` ラベル。merge しない
  (approve 後に Owner が exact head を merge)

## 成果物パス

- report: `.orchestration/reports/P1-T04-report.md`
- validation: `.orchestration/validation/P1-T04-validation.md`
- sandbox: `.orchestration/sandboxes/P1-T04-sandbox.md`
- learning: `.orchestration/learning/P1-T04-learning.md`
- autoskill: `.orchestration/autoskill/runs/P1-T04-autoskill.md`
