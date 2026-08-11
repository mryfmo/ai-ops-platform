# P1-T07 OpenTelemetry conventions の拡張

- task_id: `P1-T07`
- 根拠: FinalArch:CON-002 / FR-OBS-001 / PRD-003 / ADR-0020
- Writer: codex-gpt56-sol-high / Reviewer: claude-code-fable5-xhigh
- depends_on: P1-T06(merged `77a52b1`)。WBS P1-T07 が正本
- branch: `agent/P1-T07-otel-conventions`(base = main `77a52b1` 以降)

## allowed_paths

1. `packages/shared/src/**`(+ `packages/shared/tests/**` を随伴として許可)
2. `packages/server/src/**`(+ `packages/server/tests/**` 同上)
3. `deploy/otel/**`

## deliverables / acceptance

- semantic attributes(P1-T06 の CorrelationContext — trace/correlation/workflow ID 等 —
  を OTel attribute へ写像する規約。属性名は OTel semantic conventions に整合させ、
  独自 prefix は `aiops.` に統一)
- **redaction policy**: span/attribute に **prompt・document 本文を既定で含めない**
  (含めたい場合の opt-in 経路があるなら明示ゲート + sanitizeSecrets 必須)。
  attribute 値は長さ上限を持つ(P1-T06 の 512 上限と整合)
- **service name / version を必ず記録**(resource attributes)
- 既存 llm_usage / httpMetrics 等の観測資産と矛盾しない(置換ではなく規約の追加)

## verification

- OTel exporter tests / snapshot tests(WBS 指定。exporter 実接続はモックで —
  vendor SDK・実 endpoint 依存を持ち込まない)
- fresh DB `mise run ci` exit 0 を単独判定してから push
- 新規依存が必要な場合は @opentelemetry/* の既存 workspace 使用実績を優先し、
  追加は最小 + pin + 理由記載

## フロー

App token push/PR、ai-generated ラベル、merge しない(approve 後 Owner merge)。
lockfile: packages/policy の空 importer が pnpm install で復活する既知事象あり —
本タスクの diff に混入させない(P1-T08 が正規取込予定)。

## 成果物パス

- report: `.orchestration/reports/P1-T07-report.md`
- validation: `.orchestration/validation/P1-T07-validation.md`
- sandbox: `.orchestration/sandboxes/P1-T07-sandbox.md`
- learning: `.orchestration/learning/P1-T07-learning.md`
- autoskill: `.orchestration/autoskill/runs/P1-T07-autoskill.md`
