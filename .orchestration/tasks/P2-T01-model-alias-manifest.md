# P2-T01 platform 所有の model alias manifest

- task_id: `P2-T01`
- 根拠: FinalArch:LLM-002 / PRD-003 / FR-LLM-001..007 / ADR-0022
- Writer: codex-gpt56-sol-high / Reviewer: claude-code-fable5-xhigh
- depends_on: P1-T04(merged)。P2 entry クローズ済み(#181 `8095c41`)。WBS P2-T01 が正本
- branch: `agent/P2-T01-model-alias-manifest`(base = main `8095c41` 以降)

## allowed_paths

1. `deploy/litellm/**`
2. `contracts/model-routing/**`

## deliverables / acceptance

- **logical alias → provider binding の manifest**。正典
  `docs/plans/2026-08-final-architecture/05_contracts/model-routing.yaml` を基点に
  (P1-T04 の provenance 方式踏襲: 正典は編集せず、出所と版を明記したコピー/展開)
- **アプリ側に provider の生 model ID を露出しない**(alias のみ。ADR-0022 の
  Bedrock/Anthropic 使い分けは binding 側に閉じる)
- **fallback は classification を明示**(unknown fallback 禁止 — P2 STOP 条件。
  fallback 先も alias で、data classification が保存されることをスキーマで強制)
- LiteLLM v1.96.2(#181 で pin 済み)の config 形式と整合(P2-T02 が直接読める形)
- P1-T04 の contracts gate との関係: model-routing manifest 用の schema validation を
  contracts/model-routing/ に置き、既存 `contracts` gate または unit test で機械検証

## verification

- schema validation(manifest が schema に適合 + 負 fixture: 生 model ID 露出・
  classification 欠落 fallback が fail する事)
- configuration unit tests
- fresh DB `mise run ci` exit 0 を単独判定してから push

## フロー

App token push/PR、ai-generated ラベル、merge しない(approve 後 Owner merge)。
lockfile 変更禁止(必要が生じたら停止して報告)。

## 成果物パス

- report: `.orchestration/reports/P2-T01-report.md`
- validation: `.orchestration/validation/P2-T01-validation.md`
- sandbox: `.orchestration/sandboxes/P2-T01-sandbox.md`
- learning: `.orchestration/learning/P2-T01-learning.md`
- autoskill: `.orchestration/autoskill/runs/P2-T01-autoskill.md`
