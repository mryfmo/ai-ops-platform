# P3-T01 Temporal namespace / worker connectivity の整備

- task_id: `P3-T01`
- 根拠: FinalArch:TMP-001 / PRD-001 / PRD-002 / PRD-010 / FR-CP-001..008 / ADR-0021 / ADR-0029 / ENV-DEC-001
- Writer: claude-code-fable5-xhigh（WBS 指定） / Reviewer: codex-gpt56-sol-high
- depends_on: P1-T01（scaffold）/ P0-T07（ENV-DEC-001 案 B'）— 済
- branch: `agent/P3-T01-temporal-provision`（base = main `78c3af5` 以降）
- risk: medium（ただし認可コンポーネントを含む）

## allowed_paths（WBS）

1. `deploy/temporal/**`（新設）
2. `deploy/aws/**`（新設 — Terraform。ADR-0029/P0-T07a どおり Bicep でなく Terraform）
3. `packages/control-plane/**`

（付随: Temporal image 群の license/pin は docs/security register の追補が必要 —
litellm #181/#186 と同型の**別 governance PR** とし、本タスクからは分離する）

## deliverables（WBS + ENV-DEC-001 B'）

- **dev compose**（docker-compose 単一ノード。**mTLS を dev で