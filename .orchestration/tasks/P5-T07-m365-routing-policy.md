# P5-T07: Implement M365 data routing policy

- task_id: P5-T07
- writer: codex-deep-dot（WBS どおり codex）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P5-T03 ✅（#239 merged, main 4c4201d）/ P4-T03 ✅
- requirement_refs: PRD-007 / FR-M365-001..006
- adr_refs: ADR-0024
- acceptance_gate_ids: WIQ-004（restricted data does not leave M365 boundary — blocking）
- risk: **critical**

## Canon（必読）

- component spec 04（Data egress 節）: Work IQ output を LiteLLM へ送る前に
  OPA へ classification/label・purpose・user/project・provider candidate・
  requested fields・source systems を入力。**restricted は Work IQ 内で完結。
  customer-confidential は Bedrock only かつ要約済み最小情報。
  Anthropic direct は explicit allow が必要**
- ADR-0024: external LLM へ渡す前の OPA classification/minimization
- P5-T03 P1 裁定（task file 参照）: 入力側 enforcement は存在しない —
  **本タスクがその補償統制（出力側 egress 判定）の正本実装**
- 既存 rego（packages/policy/policies/policy.rego、default deny・
  bundle_version）と decision client 契約（P4-T03。unknown 形 = deny）

## Objective

1. **rego 拡張**（`packages/policy/policies/`）: M365 egress decision —
   入力（classification / purpose / provider candidate / requested fields /
   source systems / user・project）に対し
   `allow / deny / require_approval` + obligations
   （`allowedProvider: bedrock|anthropic|none`、`redactFields`、
   `maxResultBytes` 等既存 obligation 語彙）を返す:
   - **restricted → 常に deny**（provider 候補に依らず。M365 境界外へ出ない）
   - **customer-confidential → allowedProvider=bedrock のみ + 要約/最小化
     obligation**。Anthropic direct は deny（explicit allow 規則が
     policy data に存在する場合のみ許可 — default は不存在）
   - confidential/internal/public の段階規則、未知 classification → deny
     （default deny 維持。bundle_version 更新は semver で）
2. **data-flow 結線**（`packages/control-plane/**`）: Work IQ output →
   LLM 入力経路の egress checkpoint（pure lib + 薄い結線）。decision なし・
   deny・obligation 不履行（redact 未適用等）で LLM 入力へ到達しない構造。
   provenanceComplete=false（P5-T02）の出力は classification を
   **保守的に customer-confidential 以上として扱う**（不明 = 緩和しない）
3. rego tests + client/data-flow tests（負 fixture:
   restricted×全 provider / customer-confidential×anthropic /
   explicit-allow 不在時の anthropic / 未知 classification / obligation 不履行）

## Forbidden

- default deny の緩和・既存 decision 契約の破壊的変更
- LLM による判定・依存追加・実資格情報
- main direct push / merge / approve

## Scope / allowed_paths（WBS + test 規約）

- `packages/policy/**` / `packages/control-plane/**`
- `.orchestration/**`（証跡）

## Acceptance（WBS）

- restricted never leaves Work IQ/M365（全 provider 組合せの負 fixture）
- customer route tested（bedrock only + 最小化 obligation の正負 fixture）

## Validation

- `mise run policy:rego` green（既存 16 + 追加）/ 各 package tests green
- fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P5-T07-m365-routing-policy`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P5-T07-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P5-T07 status=ready_for_review

## Scope amendment（2026-08-16、orchestrator 承認）

- 追加 allowed_paths: `packages/control-plane/package.json` / `pnpm-lock.yaml`
  — **`@aiops/policy` の workspace:* entry 追加のみ**（P5-T03 と同型の裁定:
  依存追加禁止は外部依存が対象。workspace link が正道、相対 src import は禁止）。
  lockfile 差分は当該 link 限定

## Scope amendment 2（2026-08-16、orchestrator 承認）

- 追加 allowed_paths: `deploy/opa/deployment.yaml` / `deploy/opa/smoke.sh`
  — **bundle_revision / 期待 version 文字列の semver 更新のみ**
  （parity test と smoke の 0.1.0 hardcode 追随。posture.enabled: false ほか
  他 field の変更禁止 — preparatory classification 不変）

## Scope amendment 3（2026-08-16、orchestrator 承認）

- 追加: `packages/control-plane/package.json` / `pnpm-lock.yaml` への
  **`@aiops/shared` workspace:* entry**（sanitizeForLlmInput の消費 —
  原則 4 の LLM 入力前 sanitize 層。self-review P1 の是正として妥当）。
  lockfile 差分は当該 link 限定、他条件不変
