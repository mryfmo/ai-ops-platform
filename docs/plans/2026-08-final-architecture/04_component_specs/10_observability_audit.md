# Component Spec: Observability / Audit

## OpenTelemetry

Services: Control API、Temporal workers、LiteLLM、agentgateway、Teams adapter、Web、Runner callbacks。W3C trace contextを使用し、external systemsへ可能な範囲でcorrelation IDを渡す。

## Metrics

- workflow started/completed/failed/cancelled/stuck
- activity retry/timeout/unknown result
- approval wait/expiry/reject
- model requests/tokens/cost/latency/fallback
- tool requests/deny/approval/error/latency
- provider/gateway health
- runner queue/runtime/PR success
- publication partial failure
- incident MTTD/MTTA/MTTR

## Audit receipt

Auditはappend-only DBに以下を保存。

- actor/workload identity
- basis/purpose
- action/resource
- classification
- policy decision/version
- approval ID/version
- workflow/activity IDs
- source references
- result/status/error class
- model/tool aliases and versions

Prompt/content本文は原則保存せず、approved evidence store reference/hashを使う。

## Debug vs compliance

OTel backendはdebug/operations。PostgreSQL audit ledger/SharePoint evidenceは正式監査。OTelが失われても正式監査が成立し、監査ledgerが大量debug payloadで汚染されない構成にする。
