# P1-T06 shared correlation context

- task_id: `P1-T06`
- 根拠: FinalArch:CON-001 / CON-002 / FR-OBS-001 / PRD-003 / ADR-0020
- Writer: codex-gpt56-sol-high / Reviewer: claude-code-fable5-xhigh
- depends_on: P1-T04(merged `aa5323a`)。WBS P1-T06 が正本
- branch: `agent/P1-T06-correlation-context`(base = main `aa5323a` 以降)

## allowed_paths(**P1-T05 と並行のため WBS より狭く運用**)

1. `packages/shared/src/**`
2. `packages/shared/tests/**`(WBS は packages/*/tests/** だが、私が P1-T05 で
   packages/server/tests・packages/devops/tests を触るため **shared/tests に限定**。
   他 package のテスト変更が必要になったら停止して報告)

## deliverables / acceptance

- typed correlation context(trace ID / correlation ID / workflow ID / actor 等)と
  propagation helpers(生成・継承・シリアライズ)。W3C traceparent との整合が
  取れる形を推奨(独自形式を発明しない)
- **全新規 interface が trace/correlation ID を受け取り・発行できる**こと
- **unbounded content field を持たない**(自由文字列の長さ上限・検証。
  secretSanitizer との関係を README/コメントで明記)
- 既存規約: 根拠ヘッダ / lib 純粋関数分離 / describe・it に spec ID / 境界値テスト

## verification

- unit tests / typecheck / lint / coverage
- fresh DB `mise run ci` exit 0 を単独判定してから push

## フロー

App token push/PR、ai-generated ラベル、merge しない。

## 成果物パス

- report: `.orchestration/reports/P1-T06-report.md`
- validation: `.orchestration/validation/P1-T06-validation.md`
- sandbox: `.orchestration/sandboxes/P1-T06-sandbox.md`
- learning: `.orchestration/learning/P1-T06-learning.md`
- autoskill: `.orchestration/autoskill/runs/P1-T06-autoskill.md`
