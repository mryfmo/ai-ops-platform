# P4-T03: Implement OPA decision client and bundle

- task_id: P4-T03
- writer: codex-gpt56-sol-high（codex-deep-dot）
- reviewer: claude-code-fable5-xhigh（orchestrator が adversarial review）
- depends_on: P1-T03 ✅
- requirement_refs: PRD-003 / PRD-005 / FR-MCP-001..007
- adr_refs: ADR-0023
- acceptance_gate_ids: MCP-002（blocking）
- risk: medium

## Objective

P1-T03 の default-deny rego（`packages/policy/policies/policy.rego`、
`bundle_version` 0.1.0、risk_catalog.yaml）を土台に、
(1) 配布可能な OPA **bundle**（deploy/opa/）と
(2) DI 注入可能な **decision client**（TS）を実装する。
decision の `policyBundleVersion` が receipts（後続 P4-T04 の invocation
receipt）へ伝搬できる形で client の返り値契約に含まれること。

## Scope / allowed_paths（WBS 準拠）

- `packages/policy/**`（client 実装は policy 配下 src/、または既存構成に従う）
- `packages/shared/src/**`（共有型・FetchLike 注入が必要な場合のみ最小限）
- `deploy/opa/**`（新規: bundle build・pinned OPA image・server 設定）
- `.orchestration/**`（証跡）

## Forbidden

- main direct push / production configuration without approved environment gate
- 依存追加（既存 devDeps と PATH 上の `opa` で完結。新規 npm 依存は不可）
- gate 変更（mise `policy:rego` の弱体化禁止。追加はよいが既存検証は維持）
- rego の default deny 崩し（`default decision := deny` は不変条件）
- 実資格情報・secrets の commit

## Deliverables

1. `deploy/opa/` — bundle 化: `opa build` による versioned bundle
   （`.manifest` に revision = bundle_version）、pinned digest の OPA image 宣言、
   server 起動設定（internal-only、decision log は stdout/OTel 方針をコメントで明記）。
   build/smoke script（既存 deploy/*/smoke.sh の形式踏襲、Apple container CLI）
2. decision client（TS、`@aiops/policy` 配下推奨）:
   - `FetchLike` コンストラクタ注入（AGENTS.md 原則 7。ネットワークなしで test 可能）
   - OPA `POST /v1/data/aiops/policy/decision` 呼び出し + 応答の
     zod/手書き validation（unknown 形は fail-closed で deny 扱い）
   - **fail-closed**: HTTP error / timeout / malformed response はすべて
     `decision: "deny"` 相当へ正規化（E-code 付き）。retry は有限・冪等
   - 返り値契約に `policyBundleVersion` を必須で含める（MCP-002/receipts 結線）
3. tests: rego（`opa test` 既存系列に bundle 検証を追加）+ client unit
   （DI mock で allow / deny / require_approval / malformed / timeout / 5xx）

## Acceptance（WBS）

- default deny（負 fixture: 未登録 tool・catalog 外 risk・input 欠落 → deny）
- bundle version in receipts（client 返り値に policyBundleVersion が常在し、
  deny 正規化経路でも欠落しない）

## Validation

- `mise run policy:rego` green（既存 + 追加）
- `pnpm --filter @aiops/policy run test` green
- deploy/opa smoke: bundle を載せた OPA container が decision API で
  default deny を返す実測（unknown tool denied の runtime evidence）
- fresh DB で `mise run ci` exit 0（単独判定）

## PR

- branch `agent/P4-T03-opa-decision-client`、AIOPS_PR_TOKEN で作成、
  ai-generated ラベル、**draft 禁止**。push 前に approval-dismissal 確認
  （L-OPS-PR222）

## Expected artifacts

- report: `.orchestration/reports/P4-T03-REPORT.md`
- validation: `.orchestration/validation/P4-T03-VALIDATION.md`
- sandbox: `.orchestration/sandboxes/P4-T03-SANDBOX.md`
- learning: `.orchestration/learning/P4-T03-LEARNING.md`
- autoskill: `.orchestration/autoskill/runs/P4-T03.md`

## Done signal

AGMSG-RESULT v1 task_id=P4-T03 status=ready_for_review
