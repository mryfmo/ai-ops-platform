# Component Spec: Plane / GitHub

## Authority

- Plane: daily project/work item state、assignee、cycle、discussion、operational risk/milestone。
- GitHub: code、Issue/PR/CI/release/deployment、reviewed ADR/contract/spec。
- AI Ops: event/snapshot/mapping/derived metrics/promotion proposal。

## Sync rules

### Plane → GitHub

Engineering-readyかつ承認済みwork itemだけIssue化。全コメントを同期しない。promotionはbaseline revisionを固定し、draft PR/Issueまで。

### GitHub → Plane

Issue/PR/CI/release/deploymentのstate summaryとcanonical linkだけを投影。code review本文を複製しない。

### Dedupe

`external_source`, `external_id`, `project_id`, `mapping_version`を使う。unknown write resultはreconcile。

## MCP vs official API

- MCP: search/read/context/draft。
- Official API/Webhook: deterministic write、event、formal state transition。
- GitHub merge/deployはplatform protectionのみ。

## License boundary

Plane CEを改変・vendorしない。別serviceの標準API/webhookだけで接続。改変が必要ならAGPL対応source公開と法務承認を先に行う。
