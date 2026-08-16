# P5-T06: Separate Graph system integration interfaces

- task_id: P5-T06
- writer: codex-deep-dot（WBS どおり codex）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P5-T03 ✅（main 80dd497）
- requirement_refs: PRD-007 / FR-M365-001..006
- adr_refs: ADR-0024
- acceptance_gate_ids: WIQ-003（Graph remains system/background path — code/type 面。
  実 tenant E2E は sandbox-m365 到達後）
- risk: medium

## Canon（必読）

- ADR-0024: **Work IQ = delegated/OBO（user-interactive）/
  Graph = app-only・background・change notification・delta・正式 write・
  retention/permission** の分離。Work IQ の application-only fallback 禁止の
  対偶として、**Graph の app-only 経路に user-interactive 用途を混入させない**
- component spec 04（Graph path 節）: change notifications / calendar・meeting
  lifecycle / transcript availability / channel delta / SharePoint 正式
  publication / mail・calendar deterministic operation / app-only・selected/RSC
- 既存 `packages/shared/src/clients/graphClient.ts`（615 行）と、その全消費箇所
  （grep で洗い出し、破壊的変更は同一 PR 内で追随）

## Objective

**delegated と app-only を型で分離し、compile-time で誤用を防ぐ**:

1. `packages/integrations/src/graph/`（新規）: Graph 呼出の用途別 interface —
   - `GraphSystemClient`（app-only/background 専用）: subscriptions・delta・
     lifecycle・正式 write 系 operation の型面。**user token / delegated
     claims を受け取れない signature**（型で拒否）
   - delegated 側は Work IQ（workiq/ 配下）が正本 — Graph 側に delegated
     interface を**作らない**（分離の要）。user-interactive 用途が Graph へ
     流れ込む経路を型で閉じる
   - token 種別を **branded/opaque type**（例: `GraphAppOnlyToken`）で表現し、
     Work IQ の delegated token 型と相互代入不能にする
2. `graphClient.ts` の改修: 既存 client を app-only 前提として明示
   （型 rename/marker 追加は後方互換を保つ形で。全消費箇所を同一 PR で追随）
3. **compile-time misuse tests**: `@ts-expect-error` による負型テスト —
   (a) delegated token を GraphSystemClient へ渡す、(b) Work IQ 側 client に
   app-only token を渡す、(c) delegated 文脈から正式 write 系 API を呼ぶ、
   がいずれも compile error になることを型テストで固定 + unit tests

## Forbidden

- 実資格情報 / ネットワーク test / 依存追加（workspace link は要 amendment）
- Work IQ 側の delegated 契約（#237/#238）の破壊的変更
- graphClient.ts の挙動変更（型の明示化のみ。runtime 動作は不変 —
  既存 tests が green のまま）
- main direct push / merge / approve

## Scope / allowed_paths（WBS + test 規約）

- `packages/shared/src/clients/graphClient.ts`（+ 既存消費箇所の型追随が
  必要なら該当 import 行のみ — 変更前に amendment 申請）
- `packages/integrations/src/graph/**` + `packages/integrations/tests/**`
- `packages/integrations/src/index.ts`（re-export 行のみ、事前承認）
- `.orchestration/**`（証跡）

## Acceptance（WBS）

- compile-time misuse prevented（@ts-expect-error 負型テストで機械検証）

## Validation

- type/unit tests green（typecheck 含む）
- fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P5-T06-graph-interface-separation`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P5-T06-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P5-T06 status=ready_for_review

## Scope amendment（2026-08-16、orchestrator 承認）

- 追加 allowed_paths: `packages/server/src/auth/graphTokenProvider.ts`
  （+ 必要なら同 provider の既存 tests）— 本番 token 経路が branded
  `GraphAppOnlyToken` を返す形にする root-fix。未使用 factory で型だけ
  用意する形（本番 `new GraphClient` を制約しない）は不可という
  self-review P1 の是正として妥当。runtime 挙動は不変のこと
