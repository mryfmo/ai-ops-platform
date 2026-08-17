# P7-T08: Add capability grants to Workbench

- task_id: P7-T08
- writer: codex-deep-dot（WBS どおり codex）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P7-T07 ✅（#246）/ P4-T03 ✅（#229）
- requirement_refs: PRD-001 / FR-UI-001..006
- adr_refs: ADR-0025
- acceptance_gate_ids: UX-004（security E2E の code/negative 面。
  実ブラウザ E2E は後続）
- risk: medium
- **並行注意**: open PR #255（deploy/aws/identity 系）/ #256（workflows/
  deploy/contracts/deploy-workflow/runbooks）。**接触禁止**（本タスクは
  packages/web・packages/policy・server 面で自然分離。contracts/package.json
  が必要な場合のみ要 amendment — #256 が変更中のため衝突注意）

## Canon / 前提

- canon 06_web_workbench.md: **Capability = resource access default none、
  明示 grant のみ**。Blueprint（承認済み template）。Deferred action
- P7-T07 の workbench read model（workspace/source/run/pending action —
  FK 参照専用）と route 規範（identity envelope・毎リクエスト recipient・
  一様 404）
- P4-T03/P4-T04 の OPA decision 契約（policyBundleVersion 常在・
  fail-closed）。grants の判定は **OPA decision 経由**を基本とし、
  server 側は defense-in-depth の局所検証
- P1-T05 の grants 系既存資産（`packages/server/src/db/grantsRepo.ts` が
  存在 — **読解して evolve 優先、並行 authority 新設禁止**）

## Objective

1. **grant model**: project/repo/space 単位の capability grant
   （**default none** — grant 行が存在しない資源は不可視/不可アクセス）。
   既存 grantsRepo の evolve を優先検討（schema 変更は P1-T05 手順 +
   事前報告）
2. **enforcement**: workbench API（P7-T07 の route）へ grant 検証を結線 —
   データ取得側 SQL 述語で強制（原則 6）+ OPA decision の文脈入力。
   **cross-project negative（acceptance）**: grant のない project の
   workspace/source/run/action が list にも detail にも現れない
   （一様 404 / 空集合 — 存在オラクル回避）
3. web 側: grant 状態の型 + BFF 結線（UI 本体は P7-T10）
4. tests: cross-project negative / default-none / grant 付与後の可視化 /
  revoke 後の即時不可視（キャッシュ禁止）/ dual-test 規約

## Acceptance（WBS）

- cross-project negative tests（default none の機械検証）

## Forbidden

- default-allow の混入 / 表示層 masking / recipient・grant のキャッシュ
- open PR #255/#256 変更ファイルへの接触 / 並行 authority 新設
- 依存追加（workspace link は要 amendment）/ 実資格情報
- main direct push / merge / approve

## Scope / allowed_paths（WBS + test 規約）

- `packages/web/src/**` + `packages/web/tests/**`
- `packages/policy/**`（grants の decision 文脈が必要な場合のみ最小限）
- `packages/server/src/db/**` / `packages/server/src/http/routes/**` +
  `packages/server/tests/**`（P7-T07 の workbench 系 evolve）
- schema 変更時: P1-T05 手順 + 事前報告
- `.orchestration/**`（証跡）

## Validation

- security/unit tests green（`env -u TEST_DATABASE_URL` coverage 含む）
- fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P7-T08-workbench-grants`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P7-T08-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P7-T08 status=ready_for_review

## Scope amendment（2026-08-17、orchestrator 承認）

- self-review High（production composition が decisionClient/environment を
  注入せず、grant 済みでも常に fail-closed 404）の root-fix として追加:
  - `packages/server/src/index.ts`（composition 結線のみ）
  - `packages/server/src/config.ts`（OPA/policy の env 設定 — 既存の
    fail-closed 検証パターン踏襲、E-code 付き）
  - 対応する composition/config tests
- open PR #255/#256 は server 非接触のため衝突なし。他条件不変

## Scope amendment 2（2026-08-17、orchestrator 承認）

- 追加: `.env.example` / `docs/reference/configuration.md` —
  **OPA_BASE_URL / OPA_POLICY_ENVIRONMENT の 2 entry 追加のみ**
  （traceability の config inventory 機械要件。値は placeholder）
