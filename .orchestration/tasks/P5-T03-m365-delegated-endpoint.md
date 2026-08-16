# P5-T03: Implement Control API delegated M365 endpoint

- task_id: P5-T03
- writer: codex-deep-dot（Owner 指示 2026-08-15 により実務委任。WBS 原記載
  writer=claude。orchestrator は起票・adversarial review・acceptance）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P5-T02 ✅（#238 merged, main e24a7a0）/ P4-T03 ✅
- requirement_refs: PRD-007 / FR-M365-001..006
- adr_refs: ADR-0024
- acceptance_gate_ids: WIQ-002（route/auth 面。実 tenant differential は後続）
- risk: medium

## Canon / 前提（必読）

- `docs/contracts/workiq-obo.md` — 6 段 token flow。本タスクは
  **段 1-3（adapter が user token を受け、Control API が subject/tenant/
  audience を検証し、OBO 交換へ渡す）**の Control API 側 route/auth 実装
- `packages/integrations/src/workiq/`（#237/#238）— claim validator と
  delegated client。**再実装禁止、必ず消費**
- `packages/policy`（P4-T03）— OPA decision client。Work IQ 呼出前の
  policy boundary（decision なしで client に到達しない）
- 既存 route 規範: `packages/server/src/http/routes/mcpOps.ts`（P4-T11）の
  identity envelope・毎リクエスト検証・監査 append・fail-disabled パターン踏襲

## Objective

1. **delegated M365 endpoint**（`packages/server/src/http/routes/` 新規）:
   Web/Teams adapter からの user context 付きリクエストを受け、
   (a) inbound identity（identity envelope 既存機構）検証 →
   (b) Entra user token の claim 検証（`validateWorkIqDelegatedClaims` 消費。
   wrong tenant / audience / subject / app-only は**全て deny**、E-code 付き）→
   (c) OPA decision（P4-T03 client。deny/require_approval/障害 = fail-closed 遮断）→
   (d) `WorkIqRestClient`（#238）呼出、の順序を固定
2. **OBO token provider 抽象**（`packages/server/src/auth/`）:
   OBO 交換の interface + DI 実装枠（実 Entra 呼出は env 到達後。
   unit は合成 token provider。**secret/実資格情報なし**）。
   token cache 分離（subject/tenant/scope/resource キー、contract 準拠）
3. **監査**: 認可拒否・policy 拒否は AuditLogWriter.append で記録
   （mcpOps.ts と同型）。応答は metadata のみ（content leakage なし）

## Forbidden

- 実資格情報・実 tenant ID の commit / app-only fallback / write 系
- workiq validator・client の再実装や迂回
- 依存追加 / schema 変更 / main direct push / merge / approve

## Scope / allowed_paths（WBS + test 規約）

- `packages/server/src/http/routes/**` / `packages/server/src/auth/**`
- `packages/server/src/index.ts` / `packages/server/src/http/app.ts`
  （結線行のみ、事前承認）/ `packages/server/tests/**`（事前承認）
- `.orchestration/**`（証跡）

## Acceptance（WBS）

- wrong tenant / audience / subject denied（負 fixture で機械検証。
  app-only 形も含む）

## Validation

- route/auth tests（`app.request()`、ネットワークなし）green
- fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P5-T03-m365-delegated-endpoint`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P5-T03-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P5-T03 status=ready_for_review

## Scope amendment（2026-08-16、orchestrator 承認）

- 追加 allowed_paths: `packages/server/package.json` / `pnpm-lock.yaml`
  — **workspace 内部依存（`@aiops/integrations` / `@aiops/policy` の
  workspace:* entry）の追加のみ**。外部依存の追加・既存依存の版変更は禁止。
  lockfile 差分は当該 workspace link に限定されること
- 相対 path での他 package src import は禁止（package 境界維持）— 本 amendment が正道

## Review finding P1 の裁定（2026-08-16、orchestrator）

- 事実認定: `ask` は自由文 question のみを受け、上流に project/source filter の
  enforceable parameter が存在しない。delegated/OBO 設計における実 enforcement は
  **M365 側の permission trimming（user token の権限半径）**であり、platform が
  ask 入力で project 隔離を「強制」することは現時点で不可能（canon の
  egress 統制モデルとも整合: 出力側で OPA classification/minimization）
- 採択: **option (a) + 是正**。(b) は機能を殺し、(c) は上流仕様待ちの憶測
- 必須是正（RESULT 前に適用）:
  1. **誤解を招く authz 入力の排除**: OPA decision input で
     projectId/allowedSourceTypes を「ask の enforcement 境界」として
     渡さない。purpose-limitation の**文脈情報**として明示的に改名/文書化する
     （例: `context.declaredPurposeScope` 等）か、decision input の
     semantics コメントで「上流 enforcement なし・M365 trimming のみ」と明記。
     platform が enforce していない事を enforce している様に見せない
  2. route/contract doc に「ask の project 隔離は M365 permission trimming +
     出力側 egress 統制（後続 P5 タスクの OPA classification/minimization）で
     担保。入力側 platform enforcement は存在しない」を明記
  3. validation に **WIQ-002 conformance 項目**として実 tenant differential
     （two-user）テストを追記（既存の deferred 項目と統合可）
  4. 上記の意味論を固定する test（decision input に enforcement を示唆する
     field が無い/正しく文書化されている事）
- 本裁定により P5-T03 の到達範囲は「auth/claim boundary + purpose-context 付き
  policy 判定 + client 結線」であり、provider-enforced differential は
  WIQ-002 実 tenant タスクの管轄として記録する
