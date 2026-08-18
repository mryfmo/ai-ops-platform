# P7-T10: Implement typed Gadget/ViewSpec phase

- task_id: P7-T10
- writer: codex-deep-dot（Owner 指示 2026-08-15 により実務委任。WBS 原記載
  writer=claude。orchestrator は起票・adversarial review・acceptance）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P7-T08 ✅（#257）
- requirement_refs: PRD-001 / FR-UI-001..006
- adr_refs: ADR-0025（+ 必要なら新規 ADR — 許可済み path）
- acceptance_gate_ids: UX-001..005（UI/security tests の ci 面）
- risk: medium
- **並行注意**: open PR #260（server approvals + channel-teams approval 系）/
  #261（channel-teams components）。**両 PR の変更ファイルへ接触禁止** —
  本タスクは packages/web 内で完結（web は open PR 非接触）

## Canon / 前提（必読）

- canon 06_web_workbench.md: **Phase 1 は任意コード生成 Gadget を実行しない。
  typed React components / ViewSpec だけ**。任意コード Gadget は Phase 6+ で
  isolated iframe + CSP + isolated server sandbox + no ambient network +
  capability proxy を満たす場合のみ。**Cloudflare Artifacts: none**
- 既存 web の ViewSpec 資産（Vercel AI SDK chat の tool call → ViewSpec —
  AGENTS 原則 2 の「LLM は ViewSpec の tool call まで」）を読解して拡張
- P7-T08 の capability grants（default none）— gadget の資源 access は
  grant 済み範囲のみ
- P7-T04 の typed-result 設計（markup 拒否・branded URL — web 面でも同水準）

## Objective

1. **approved typed mini-app components**: workspace 向けの typed
   Gadget/ViewSpec カタログ（承認済み component 集合 — 例: workflow
   timeline / source panel / pending actions / decision summary の view 型）。
   **ViewSpec は data 参照 + 表示 parameter のみ**（コード・式・
   イベントハンドラ文字列を含む spec は型で表現不能に）
2. **no arbitrary code/network（acceptance）**: ViewSpec 経由で任意
   script/HTML/外部 URL fetch を注入できないことを型 + strict parse +
   負 fixture で固定。資源 access は P7-T08 grant 検証済み API 経由のみ
3. **Cloudflare Artifacts absent（acceptance）**: 依存・import・設定に
   Cloudflare 系が存在しないことの機械検査（簡易 grep gate で可）
4. tests: UI render（決定的）+ security 負 fixture（script 注入 /
   外部 URL / 未承認 component 参照 / grant 外資源）

## Acceptance（WBS）

- no arbitrary code/network（型遮断 + 負 fixture）
- Cloudflare Artifacts absent（機械検査）

## Forbidden

- 任意コード Gadget / iframe sandbox 実装（Phase 6+ の管轄）
- open PR #260/#261 変更ファイル接触 / 依存追加 / 実資格情報
- main direct push / merge / approve

## Scope / allowed_paths（WBS）

- `packages/web/src/**` + `packages/web/tests/**`
- `docs/adr/**`（設計判断の記録が必要な場合のみ）
- `.orchestration/**`（証跡）

## Validation

- UI/security tests green / fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P7-T10-gadget-viewspec`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P7-T10-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P7-T10 status=ready_for_review
