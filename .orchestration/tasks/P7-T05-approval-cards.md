# P7-T05: Implement approval cards and Temporal signal

- task_id: P7-T05
- writer: codex-deep-dot（Owner 指示 2026-08-15 により実務委任。WBS 原記載
  writer=claude。orchestrator は起票・adversarial review・acceptance）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P7-T03 ✅（#258）/ P3-T03 ✅
- requirement_refs: PRD-001 / FR-UI-001..006
- adr_refs: ADR-0025
- acceptance_gate_ids: UX-002（Teams approval E2E は tenant 到達後 deferred —
  code/negative tests まで）
- risk: **high**
- **並行注意**: open PR #259（.orchestration のみ）— 自然分離

## Canon / 前提（必読）

- **P3-T03 approval workflow が正本**: durable signal / CAS / expiry /
  restart-safe / auto-approval 禁止。approvals table（P1-T05 DELTA-03）が
  authority。**bare signal 禁止 — 権威は authoritative DB read**（P3 不変条件）
- 既存 `packages/server/src/http/routes/approvals.ts`（P1 期の approval
  route — identity envelope / 検証パターンを読解して evolve）
- P4-T04 の approval 二重照合パターン（workflow result × approvals authority
  の id/version/status 一致）
- canon: 「OpenTag approval だけで外部操作を確定しない」（Do not adopt）—
  card は UI であり、確定は server 側検証 + Temporal signal 経由のみ

## Objective

1. **approval card 契約**（channel-teams）: approve/reject/version 付き
   Adaptive Card payload の型 + 生成（pure）。card には
   approvalId + **version** + 署名付き correlation を含める
   （stale card 検出の基盤）
2. **card action 受信**（server routes/approvals.ts evolve）:
   - **only authorized reviewer（acceptance）**: card 押下者の identity
     （tenant+subject）を approvals authority の想定 reviewer と照合。
     不一致 → 403 + 監査（存在オラクル回避の一様応答）
   - **stale card rejected（acceptance）**: card 内 version と approvals の
     現 version 不一致 → 拒否（過去 card の replay / 二重承認防止）
   - 検証成功時のみ **P3-T03 workflow へ signal**（bare signal 禁止 —
     signal 後の権威は workflow 側の authoritative DB read が担保）
3. 決定は必ず approvals authority への CAS 記録 → signal の順
   （P3-T03 の既存契約を消費 — 再実装禁止）
4. tests: authorized/unauthorized/stale/replay/expiry/二重押下の負 fixture、
   dual-test 規約、`env -u TEST_DATABASE_URL` coverage

## Acceptance（WBS）

- only authorized reviewer（負 fixture）
- stale card rejected（version 不一致・replay の負 fixture）

## Forbidden

- auto-approval / bare signal / P3-T03 契約の再実装・変更
- card 押下だけで外部操作確定（server 検証を経ない経路）
- open PR #259 接触 / 依存追加（workspace link は要 amendment）/ 実資格情報
- main direct push / merge / approve

## Scope / allowed_paths（WBS + test 規約）

- `packages/channel-teams/src/**` + `packages/channel-teams/tests/**`
- `packages/server/src/http/routes/approvals.ts` + `packages/server/tests/**`
- （必要時）`packages/server/src/db/approvalsRepo.ts` の evolve — 事前報告
- `.orchestration/**`（証跡）

## Validation

- 負 fixture 網羅 green / fresh DB で `mise run ci` exit 0（単独判定）
- Teams approval E2E は deferred（tenant 到達後）と validation に明記

## PR / blocked-auth

- branch `agent/P7-T05-approval-cards`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P7-T05-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P7-T05 status=ready_for_review

## Contract 裁定（2026-08-17、orchestrator）

1. **approvalsRepo evolve 承認**: decide CAS を pending+version+unexpired の
   単一 CAS へ（route-only 検査は race する、という分析は正しい。
   schema 変更なし・authority の意味論不変）
2. **expected-reviewer は option (a) 採択**: 専用 reviewer 列は追加しない。
   authorized reviewer = 「署名済み Entra identity + 毎リクエストの
   recipients/project authorization」で判定し、同 identity を署名付き
   correlation に束縛。**追加条件: 自己承認禁止** — decider identity が
   approval の requested_by と一致する場合は拒否（403 + 監査）。
   per-approval の名指し reviewer 割当が将来必要になれば別タスクで
   schema evolve（現時点の canon は role/scope authority で足りる）
3. **signal port 承認**: server は control-plane 非依存のまま、card-action
   endpoint に **必須注入の signal port**（P3-T03 の正確な payload 形を
   消費、port 不在は fail-closed）— P7-T08 の教訓どおり
   「結線されて動く」side の composition test も必須（後続 wiring task で
   実結線する場合はその旨 report に記録）
