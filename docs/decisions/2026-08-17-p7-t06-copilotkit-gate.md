<!-- 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-004 / FinalArch:FR-UI-005 / FinalArch:FR-UI-006 / ADR-0025 / UX-003 / UX-005 -->

# Owner 署名用裁定: P7-T06 CopilotKit Intelligence gate（2026-08-17）

- 裁定者: Owner（@mryfmo）
- 状態: **Proposed**（本記録を含む PR の Owner merge をもって Accepted / 発効）
- 対象: ENV-DEC-002 / WBS P7-T06
- 評価正本: [`2026-08-17-copilotkit-intelligence-assessment.md`](../security/2026-08-17-copilotkit-intelligence-assessment.md)

## Decision

Phase 1 は **Microsoft-native self-managed Teams adapter fallback** を選択する。

- `packages/channel-teams` の channel-neutral `AgUiRunRequest` と既存 Control API/streaming contract を
  維持し、Microsoft Teams adapter から自己管理 endpoint へ直接接続する。
- CopilotKit Cloud / Enterprise Intelligence Platform、hosted persistence/inspector、vendor API key、
  attachment upload を production/staging/sandbox のいずれにも構成しない。
- server-side identity、recipient scope、SQL capability grant、OPA、Temporal/action ledger を authority
  とし、Teams card、Workbench、Gadget、vendor project scope は authorization authority にしない。
- CopilotKit の design pattern や open AG-UI concept の参照は、この managed-service deny を覆さない。

## Reasons

1. 現行 repository に CopilotKit dependency、runtime、endpoint、credential、または network client は
   なく、既存の自前 adapter と reference-only Workbench が必要な境界を既に提供している。
2. Cloud-hosted Intelligence は thread、event、runtime metadata、user context、raw event payload を
   vendor 管理環境で処理・保持するが、本案件に適用する signed DPA/order、subprocessor、residency、
   retention/deletion、M365 tenant binding の evidence がない。
3. Attachment feature は content を agent/model へ転送できるが、現行 adapter は metadata reference
   のみで要件を満たす。新しい content copy/egress を作る必要がない。
4. UX-003/UX-005 は既存の server-side SQL grant + OPA + direct API negative で成立しており、
   vendor-side persistence/multi-tenancy を追加しても強化されない。

## Fallback implementation impact

- **P7-T09 Teams-to-Workbench handoff**: `AgUiClient` の production transport を Control API に実装し、
  exact tenant/subject/thread/workflow identity、source-message dedupe、fixed non-reflective error を保持する。
  `inputText` は LLM/agent boundary 前に sanitize し、CopilotKit endpoint を経由しない。
- **Attachments**: `ChannelAttachmentRef` の ID/name/content-type のみを渡す。bytes、base64、download URL、
  extracted content は別 security review と allowlist がない限り取得・保存・model 送信しない。
- **Workbench/Gadget**: P7-T07/T08/T10 の signed identity → active recipient → SQL grant → OPA →
  strict reference model を変更しない。UI scope check は defense in depth のままとする。
- **Approvals**: P7-T05 の reviewer authorization、version/CAS、ledger、Temporal signal 順序を変更しない。
- **Operations**: CopilotKit key、DPA、vendor retention job、hosted inspector access の運用は追加しない。

## Reconsideration gate

Managed Intelligence を将来再提案する場合、次を一つの reviewed decision pack で提示する。

- exact artifact/version と controlling license（公開記述の不一致解消を含む）
- signed DPA/order、subprocessor schedule、data location、retention/deletion/backup、incident/SLA、exit/export
- M365 tenant/subject と vendor organization/project/user の binding、および cross-tenant negative test
- prompt/event/tool/attachment/model-provider/telemetry の全 data flow と sanitize 3 層 evidence
- hosted と self-hosted の responsibility matrix、credential rotation、network egress allowlist

これらが揃っても本 decision は自動更新されない。新しい Proposed record の Owner merge が必要である。

## Activation and rollback

本 PR の Owner merge をもって ENV-DEC-002 は self-managed fallback として Accepted になる。
merge 前に AI agent の commit、push、PR、review が approval を代替することはない。

rollback は本 decision/report PR を revert して gate を再び未決定に戻す。rollback は CopilotKit Cloud
を自動で許可せず、既存の self-managed code path と server-side authorization を変更しない。
