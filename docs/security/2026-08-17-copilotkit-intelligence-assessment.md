<!-- 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-004 / FinalArch:FR-UI-005 / FinalArch:FR-UI-006 / ADR-0025 / UX-003 / UX-005 -->

# CopilotKit Intelligence security assessment（2026-08-17）

## 結論

CopilotKit Cloud / Enterprise Intelligence Platform は Phase 1 では承認しない。
Microsoft-native Teams adapter を自己管理し、既存の Control API / AG-UI 契約へ直接接続する
fallback を選択する。正式な発効条件は
[`2026-08-17-p7-t06-copilotkit-gate.md`](../decisions/2026-08-17-p7-t06-copilotkit-gate.md)
の Owner merge である。

現行 repository には CopilotKit package、runtime route、credential、endpoint、または
`AgUiClient` 実装がない。したがって、現時点で CopilotKit への user/tenant data 送信は
**0 件**である。一方、managed Intelligence を有効化すると、vendor 公開仕様上、thread、
event、runtime connection metadata、API key、app user context、raw event payload が vendor
管理環境へ保存・表示され得る。公開資料だけでは本案件に必要な DPA、subprocessor list、
data location、確定 retention/deletion、M365 tenant と vendor project の対応を検証できない。

## 評価境界

| 境界                                       | 今回の判定                                                                     | 根拠                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 現行 Teams presentation package            | 自己管理、第三者送信なし                                                       | `packages/channel-teams/src/adapters/teams.ts`; `packages/channel-teams/src/lib/channel.ts`                                             |
| 現行 Graph conversation ingestion          | Microsoft Graph → Control Plane/PostgreSQL。CopilotKit 非経由                  | `packages/server/src/agents/teamsConversationAgent.ts`; `packages/server/src/db/channelMessagesRepo.ts`                                 |
| 現行 Web chat                              | Web → LiteLLM gateway。CopilotKit 非経由                                       | `packages/web/src/server/chat/chatHandler.ts`; `packages/web/src/server/chat/provider.ts`                                               |
| 現行 Workbench                             | signed identity → active recipient → SQL grant → OPA → reference-only response | `packages/server/src/http/routes/workbench.ts`; `packages/server/src/db/workbenchRepo.ts`; `packages/web/src/server/workbenchClient.ts` |
| CopilotKit Cloud / Enterprise Intelligence | 未実装、未承認                                                                 | root/package manifests、`pnpm-lock.yaml`、`packages/*/src/**` に runtime dependency/import なし                                         |

ここでいう「第三者送信なし」は CopilotKit に対する判定である。Microsoft Graph、LiteLLM、
およびその先の承認済み model provider は別の既存データ経路であり、CopilotKit 採否によって
新設・承認されるものではない。

## 実装済み data flow

### Teams / AG-UI contract

1. `teamsAdapter.normalize()` は Teams activity から conversation/thread ID、Entra tenant ID、
   subject ID、display name、message text、mention entity、attachment の ID/name/content-type を
   channel-neutral value に変換する。attachment body は読まない。
2. `decideChannelFlow()` は bot/self/非 mention を無視し、`buildAgUiRunRequest()` は
   server-authoritative mapping の address、provider、tenant、subject が全て一致した場合だけ、
   `conversationId`、`threadId`、`workflowId`、`userIdentity`、`attachmentRefs`、
   `sourceMessage`、`inputText` を組み立てる。
3. `AgUiClient` は interface のみで、`stream()` の実装・composition root・network endpoint は
   repository に存在しない。data flow はこの in-process contract で停止する。

`inputText` はこの presentation contract 内では未 sanitize である。送信実装がないため現在の
egress leak ではないが、fallback の transport を追加する後続 task は Control API 受信境界で
sanitize 3 層を接続するまで fail closed にしなければならない。

### Graph conversation mirror（別経路）

`TeamsConversationAgent` は Graph から取得した本文に `sanitizeSecrets()` を適用してから
`channel_messages` へ保存する。自由文を LLM/agent input に変換する箇所は
`sanitizeForLlmInput()` を適用し、Teams reply は送信直前に再度 `sanitizeSecrets()` を適用する。
これは「DB 保存前 / LLM 入力前 / 外部出力前」の 3 層を実装した既存経路である。

### Web chat（別経路）

`handleChat()` は text parts と page context を `sanitizeForLlmInput()` で処理してから
`streamText()` へ渡す。`createWebGatewayFetch()` は virtual key を server-side で注入し、
同一 LiteLLM gateway origin/path 以外と redirect を拒否する。この経路にも CopilotKit はない。

## Control matrix

| 項目                         | 現行 / fallback                                                                                                                 | Managed Intelligence を採る場合の差分                                                                                           | 判定                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| DPA / third-party processing | CopilotKit への送信なし。CopilotKit 用 DPA は不要                                                                               | hosted service は thread/event/user context 等を処理・保存するため DPA と order が必要                                          | **未充足。managed deny**                            |
| Tenant isolation             | Entra `tenantId + subjectId` を mapping lookup、active recipient、SQL grant、OPA に渡し、missing/out-of-scope を同じ 404 にする | vendor は organization/project/user isolation を説明するが、M365 tenant binding と negative evidence は repository/契約にない   | **fallback は充足、managed は未検証**               |
| Authorization location       | DB query と OPA が authorization authority。React の scope check は defense in depth のみ                                       | vendor project scope を authorization authority にしてはならない                                                                | **UX-003/UX-005 維持**                              |
| Attachments                  | ID/name/content-type の reference metadata のみ。body fetch/upload なし                                                         | vendor attachment feature は既定で file を base64 化し agent/model へ送信できる                                                 | **fallback は reference-only、managed upload deny** |
| Retention                    | `channel_messages` は project close 後 13 か月で手動 purge。mapping/workbench は content を複製しない                           | Cloud は persistent threads/raw events を保存し、retention は plan-dependent。契約済み期間、backup deletion、residency は未確認 | **managed は未充足**                                |
| Sanitization                 | Graph path は 3 層。Web chat は LLM 前 sanitize と gateway egress guard。AG-UI transport は未実装                               | managed へ接続するなら vendor 送信前にも 3 層を強制する必要                                                                     | **fallback transport の実装条件**                   |
| UI/data minimization         | RichResult は strict typed/plain-text、Workbench は references/current state のみ、Gadget は既取得 projection を同期描画        | hosted inspector/raw events は別の content copy/inspection surfaceを追加                                                        | **managed は不採用**                                |
| Telemetry                    | CopilotKit dependency がないため送信なし                                                                                        | OSS telemetry は vendor 説明上 metadata-only だが既定 sampling がある                                                           | **将来 OSS 導入時も明示 disable + review**          |

## DPA / vendor public evidence

2026-08-17 に確認した official public sources:

- [Cloud-Hosted Enterprise Intelligence](https://docs.copilotkit.ai/google-adk/premium/managed-intelligence-platform): hosted service が project-scoped thread、event、runtime connection metadata、API key、app user context、raw event payload を保持し、thread retention と multimodal storage が plan-dependent であると説明する。
- [OSS vs Enterprise Intelligence Platform](https://docs.copilotkit.ai/a2a/concepts/oss-vs-enterprise): OSS は external CopilotKit service 不要、Enterprise は Cloud または self-hosted の別 backend で、organization/project/user isolation と persistence を提供すると説明する。
- [Terms of Service](https://www.copilotkit.ai/terms-of-service): managed service は Terms と signup 時の追加条件に従うが、processor obligations や本案件の DPA schedule は示さない。
- [Privacy Policy](https://www.copilotkit.ai/privacy-policy): service provider との sharing と国際移転を許容する一般的 policy であり、subprocessor、location、retention/deletion schedule は特定しない。
- [Multimodal Attachments](https://docs.copilotkit.ai/google-adk/multimodal-attachments): attachment は既定で base64 inline content として agent/model へ送れる。
- [Open-source Telemetry](https://docs.copilotkit.ai/telemetry): OSS telemetry は content を収集しないと説明する一方、runtime events の sampling と opt-out 設定がある。

公式 site と repository の既存
[`license/service review register`](2026-08-10-license-service-review-register.md) から、公開 DPA または
本案件に適用できる signed DPA、current subprocessor schedule、data residency/deletion commitment は
特定できなかった。これは「存在しない」という主張ではなく、**承認 evidence が repository に
ない**という gate 判定である。また、official docs の OSS license 表示と inspected repository
license の不一致も register 上 OPEN のままである。

## Retention authority

- Content copy: `packages/devops/src/db/schema.sql` の `channel_messages` と
  `runbooks/channel-messages-purge.md`。project close 後 13 か月。
- Identity/thread mapping: `packages/devops/src/db/migrations/202608160300_channel_identity_thread_mapping.sql`。
  tenant/subject/workflow reference のみで message content は持たない。
- Workbench: `packages/server/src/db/workbenchRepo.ts`。source metadata と authority/current-state
  references のみを返し、raw source/workflow/action payload を投影しない。
- CopilotKit Cloud: repository authority なし。plan-dependent retention を project の正本にしない。

## Gate conditions

Phase 1 は次を binding とする。

1. CopilotKit Cloud / Enterprise Intelligence endpoint、key、thread persistence、hosted inspector、
   attachment upload を追加しない。
2. P7-T09 以降は `AgUiRunRequest` を自己管理 Control API transport へ結線し、tenant/subject を
   end-to-end で保持する。UI や vendor project ID を authorization authority にしない。
3. `inputText` や将来取得する attachment content は DB 保存前、LLM 入力前、log/card/output 前の
   各境界で sanitize する。attachment は reference-only を維持し、content fetch は別 security task
   と explicit allowlist なしでは追加しない。
4. managed Intelligence を再提案する場合は、exact package/version/license、signed DPA/order、
   subprocessors、residency、retention/deletion/backup、tenant negative test、attachment/model-provider
   data flow、exit/export plan を新しい Owner decision で承認する。

## Residual risk

- fallback transport はまだ未実装であり、今回の docs-only gate はその transport の production
  readiness を承認しない。
- `channel_conversation_mappings` は content を持たないが retention/purge lifecycle が明文化されて
  いない。workflow retention に合わせる処理は後続 schema/operations task の ownership とする。
- Microsoft Graph、LiteLLM、model provider の既存 gate はこの decision で置換しない。
