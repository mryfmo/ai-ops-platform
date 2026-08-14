# P4-T02: Implement registry generator and schema hash gate

- task_id: P4-T02
- writer: codex-gpt56-sol-high（codex-deep-dot）
- reviewer: claude-code-fable5-xhigh（orchestrator が adversarial review）
- depends_on: P4-T01（PR #228）
- requirement_refs: PRD-003 / PRD-005 / FR-MCP-001..007
- adr_refs: ADR-0023
- acceptance_gate_ids: MCP-001 / MCP-004（blocking）
- risk: medium

## Objective

platform-owned の MCP registry manifest から、agentgateway の pinned vendor
config（`deploy/agentgateway/config.yaml` の `mcp.targets` と
`mcp.policies.mcpAuthorization.rules`）を**生成**する generator と、
schema drift を deploy 前に止める **schema hash gate** を実装する。
P4-T01 の「rules/targets の手書き追加禁止」を機械化する。

## Canon（実装前に必読）

- `docs/plans/2026-08-final-architecture/04_component_specs/03_agentgateway_mcp_a2a.md`
  — registry entry の canonical shape（id/protocol/transport/owner/version:
  pinned/risk L0-L6/operations/resources/auth/allowed_callers）と initial MCP set
  （Wispr read-only / GitHub read-only / Plane read+draft / Confluence read+draft /
  Work IQ read·ask·get_schema）
- gate MCP-004: High-risk tools absent（registry diff で
  merge/deploy/delete/permission 系 operation の不在を証明）
- P4-T01 の contracts/mcp-gateway（generator 出力は既存 check を必ず通ること）

## Scope / allowed_paths（WBS 準拠）

- `packages/integrations/src/mcp/**`（generator 本体 lib/ 相当 + テスト）
- `deploy/agentgateway/**`（生成出力の反映。config.yaml の生成対象部分以外
  — config block/gateways/A2A route — は変更しない）
- `contracts/tools/**`（新規: registry manifest 正本 + tool-risk 台帳 +
  schema hash 検証の contracts 結線）
- `.orchestration/**`（証跡）

## Forbidden

- main direct push / production configuration without approved environment gate
- 依存追加
- `contracts/mcp-gateway` 既存 check の弱体化・削除
- registry への write 系 operation（merge/deploy/delete/permission）entry 追加
- LLM(`ai`)/stdio の生成経路（generator が生成し得ない設計にする）
- 実資格情報の commit

## Deliverables

1. `contracts/tools/mcp-registry.yaml` — canonical shape の registry 正本。
   initial set は **登録のみ・全 entry `enabled: false`**（実 endpoint 未配備のため。
   有効化は P4-T05..T08 の各 onboarding タスクが 1 entry ずつ行う）
2. `contracts/tools/tool-risk.yaml` — risk ladder（L0-L6）と operation→risk の
   対応台帳（MCP-004 の判定基盤）
3. generator（`packages/integrations/src/mcp/`）:
   - 入力: mcp-registry.yaml + tool-risk.yaml
   - 出力: `deploy/agentgateway/config.yaml` の `mcp.targets` /
     `mcpAuthorization.rules`（enabled entry のみ。全 disabled なら
     targets=[] + 恒偽 sentinel = P4-T01 の現状と byte 一致）
   - 決定的出力（同一入力 → byte 一致。LLM 不使用・数値/表はコード算出）
   - stdio/ai を表現できない型設計 + 生成時 validation（fail-closed）
4. **schema hash gate**: registry schema の正規化 hash を contracts に固定し、
   unapproved drift（schema 変更・生成物と registry の不一致・手書き編集）を
   CI で fail させる（`mise run contracts` 結線）。golden file 検証付き
5. tests: generator unit（境界値: 空 registry / enabled 混在 / 不正 risk /
   forbidden operation 混入 → reject）+ golden files

## Acceptance（WBS）

- unapproved schema drift blocks deploy（負 fixture で実証）
- 生成物が P4-T01 contracts check（MCP-001）を通過
- MCP-004: registry に high-risk operation が不在（機械検分）

## Validation

- `mise run contracts` green（新規 gate 含む）
- generator 出力と現 config.yaml の byte 一致（全 disabled 状態）
- fresh DB で `mise run ci` exit 0（単独判定）

## PR

- branch `agent/P4-T02-registry-generator`、AIOPS_PR_TOKEN で作成、
  ai-generated ラベル、draft 禁止、push 前 approval-dismissal 確認（L-OPS-PR222）

## Expected artifacts

- report: `.orchestration/reports/P4-T02-REPORT.md`
- validation: `.orchestration/validation/P4-T02-VALIDATION.md`
- sandbox: `.orchestration/sandboxes/P4-T02-SANDBOX.md`
- learning: `.orchestration/learning/P4-T02-LEARNING.md`
- autoskill: `.orchestration/autoskill/runs/P4-T02.md`

## Done signal

AGMSG-RESULT v1 task_id=P4-T02 status=ready_for_review

## Scope amendment（2026-08-15、orchestrator 承認）

- 追加 allowed_paths:
  - `contracts/package.json`（test 列挙への 1 行追加のみ — P4-T01/P2-T02 と同型）
  - `packages/integrations/tests/**`（mcp generator の test。repo 規約
    `packages/*/tests/*.test.ts` 準拠のため）
- それ以外の scope / forbidden は不変

## Contract clarification（2026-08-15、orchestrator 裁定）

- 採択: **option (a)** — canonical registry entry に `endpoint: {host, port, path}`
  を追加する
- 制約:
  1. `endpoint` は `enabled: true` の entry でのみ**必須**、`enabled: false` では
     省略可（記載時も schema 検証はする）。全 entry disabled の現状では
     runtime 影響なし（preparatory classification と整合）
  2. 実 endpoint の記入は P4-T05..T08 の各 onboarding タスクの管轄
     （egress allowlist / register gate の下でレビューされる）。T02 では
     endpoint 付き enabled entry は **golden/負 fixture 内のみ**に置き、
     正本 mcp-registry.yaml は全 disabled のまま
  3. generator は enabled entry の endpoint を vendor `mcp.targets[].mcp`
     {host,port,path} へ 1:1 で写像（加工・推測・default 補完をしない。
     欠落は fail-closed で生成拒否）
