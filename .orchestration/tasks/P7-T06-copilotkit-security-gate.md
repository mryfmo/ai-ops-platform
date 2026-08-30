# P7-T06: Complete CopilotKit Intelligence security gate

- task_id: P7-T06
- writer: codex-deep-dot（WBS どおり codex）/ reviewer: claude-code-fable5-xhigh
- depends_on: P7-T05 ✅（#260）
- acceptance_gate_ids: UX-003 / UX-005
- risk: **critical**（docs-only だが security gate の正本）

## Canon / 前提（必読）

- WBS deliverables: **DPA / data flow / tenant / attachment / retention
  assessment**。acceptance: **approved or Microsoft-native fallback selected**
- canon 06_web_workbench.md の CopilotKit / Intelligence 該当節と、
  P7-T01..T05,T07,T08,T10 で実装済みの実データ経路（AgUiRunRequest 契約・
  grants・approvals・ViewSpec）を読解し、**実装済みの現実の data flow** を
  評価対象にする（想像上のアーキテクチャを書かない）
- 前例書式: docs/decisions/2026-08-17-gov-003-p8-t03-amendment.md
  （Proposed → Owner merge = 承認発効）と license register の評価表形式

## Objective

1. **assessment 文書** `docs/security/2026-08-17-copilotkit-intelligence-assessment.md`:
   - data flow: どのユーザデータ/テナントデータが CopilotKit 経由で
     どこへ流れるか（LLM 入力・第三者送信の有無・sanitize 3 層との交点）
   - DPA: 第三者サービス送信が存在するか。存在するなら DPA 要否と現状
   - tenant 分離 / attachment 取扱い / retention の各評価
   - 各項目に実装ファイル・contract の根拠 ref を付ける（機械検分可能に）
2. **decision record** `docs/decisions/2026-08-17-p7-t06-copilotkit-gate.md`:
   評価結論として **approve 案 or Microsoft-native fallback 案**を提示、
   状態 **Proposed**（Owner merge = gate 承認）。fallback 選択時の
   実装影響（後続タスクへの波及）も 1 節で明記
3. verification/ へ検分結果の記録（UX-003/UX-005 の ci 面 evidence）

## Forbidden

- 実装コード変更（docs/security・docs/decisions・verification のみ）
- 承認済みを自称する記述（Proposed 厳守）/ main push / merge / 依存追加
- 実資格情報・実 tenant ID の記載（placeholder のみ）

## Scope / allowed_paths（WBS）

- `docs/security/**` / `docs/decisions/**` / `verification/**`
- `.orchestration/**`（証跡）

## Validation

- `mise run format` / `mise run traceability` green、fresh-DB ci は
  docs-only なので format/traceability を単独判定として記録

## PR / blocked-auth

- branch `agent/P7-T06-copilotkit-security-gate`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P7-T06-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P7-T06 status=ready_for_review
