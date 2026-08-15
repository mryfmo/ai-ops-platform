# P5-T02: Implement Work IQ REST read/ask client

- task_id: P5-T02
- writer: codex-deep-dot（Owner 指示 2026-08-15 により実務委任。WBS 原記載
  writer=claude。orchestrator は起票・adversarial review・acceptance）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P5-T01 ✅（#237 merged, main 8d44a26）
- requirement_refs: PRD-007 / FR-M365-001..006
- adr_refs: ADR-0024
- acceptance_gate_ids: WIQ-001 / WIQ-005（設計/unit 面。実 tenant E2E は後続）
- risk: medium

## Canon / 前提（必読）

- `docs/contracts/workiq-obo.md`（#237）— 6 段 token flow・claim 検証規則・
  cache 分離・gateway conformance。client は本 contract の**消費者**であり
  仕様の再定義をしない
- `packages/integrations/src/workiq/tokenClaims.ts` —
  `validateWorkIqDelegatedClaims` を必ず経由（迂回経路を作らない）
- component spec 04: initial allowlist は fetch / ask / get_schema（+ 最小
  search/list）。write 系（create/update/delete/do_action）は**存在させない**
- Work IQ response は source references と M365 permission context を保持

## Objective

delegated/OBO token で Work IQ REST を呼ぶ **fetch / ask / source-ref adapter**:

1. **client（DI）**: `FetchLike` + token provider（検証済み
   `ValidatedWorkIqDelegatedClaims` と access token を返す抽象）を注入。
   base URL は正典 audience と整合、`pathname` guard（P4-T03 note と同型）
2. **user identity preserved**: 全 request が呼出 user の delegated token で
   実行され、response の source references / permission context を
   落とさず型に保持。client 内で identity を差し替え・昇格する経路がない
   ことを型で固定（app-only token は token provider 段で構造的に不可）
3. **timeouts / error mapping**: bounded timeout（有限 retry は冪等 read のみ、
   ask は再送しない）・HTTP/network/timeout/malformed を E-code 付き
   fail-closed へ正規化（OpaDecisionClient / GovernedMcpToolCaller の既存
   規範踏襲。timeout→success 遷移禁止・部分結果非返却）
4. **strict response boundary**: fetch/ask/get_schema の応答を unknown として
   厳格 parse（未知形は fail-closed）。source references の欠落した ask 応答は
   受理しない（canon: source refs 保持が仕様）
5. write 系 method・app-only 経路・秘密の永続化を**表現できない**設計

## Forbidden

- 実資格情報・実 tenant/endpoint の commit（合成 fixture のみ）
- write 系 operation の実装・app-only fallback
- ネットワークに出る test / 依存追加 / main direct push / merge / approve

## Scope / allowed_paths（WBS + 既存パターン）

- `packages/integrations/src/workiq/**` / `packages/integrations/tests/**`
- `packages/integrations/src/index.ts`（re-export 行のみ、事前承認）
- `.orchestration/**`（証跡）

## Acceptance（WBS）

- user identity preserved（identity 差替え経路の不在 + permission context /
  source refs の保持を test で固定）
- timeouts/error mapping（timeout・5xx・malformed・source-ref 欠落の負 fixture）

## Validation

- unit/contract tests green（DI mock、合成応答 fixture）
- fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P5-T02-workiq-rest-client`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P5-T02-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P5-T02 status=ready_for_review

## Wire contract clarification（2026-08-15、orchestrator 裁定）

- 採択: **option (a)** — HTTP JSON-RPC `tools/call`（`/mcp`、streamable-http）。
  上流実仕様であり、P4 registry の `work-iq-read`（protocol: mcp /
  transport: streamable-http / operations: read, ask, get_schema）とも一致。
  独自 REST envelope（option b）は不採用
- **sourceReferences / permissionContext の扱い**（canon「保持」の解釈を修正）:
  1. 上流が返す場合は**必ず**型に保持し、いかなる変換でも落とさない
     （field 名は Microsoft 公式 doc 記載の名を verbatim 使用し、doc URL を
     コード内根拠コメントで引用）
  2. 上流応答に存在しない場合は**捏造しない**。`sourceReferences: []` /
     `permissionContext: null` として**欠落を明示**し、typed result に
     `provenanceComplete: false` 等の明示 flag を立てる
  3. ask 応答の refs 欠落 = hard reject（当初 task file の記述）は**撤回**。
     代わりに「ask 応答が provenance 不完全のまま下流（LLM 入力等）へ渡ること」
     の遮断は消費側（後続 P5 タスクの OPA egress 判定）の責務とし、
     実 tenant での refs 実在確認を **WIQ-002 conformance check 項目**として
     validation に記録する
- envelope 以外の Objective（identity 保持・timeout/error mapping・
  strict parse・write 不能設計）は不変
