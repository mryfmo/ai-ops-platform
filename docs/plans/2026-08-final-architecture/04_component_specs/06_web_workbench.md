# Component Spec: Web AI Workbench

## 基盤

既存`packages/web`（Next.js）を発展させる。Cloudflare OS repository/runtimeをforkせず、次の設計だけを採用する。

- Workspace: task/chat/source/result/approvalを同一contextに束ねる。
- Capability: resource accessはdefault none、明示grantのみ。
- Gadget: typed mini-app/view。ただしsandboxとapprovalを満たす範囲から開始。
- Blueprint: 承認済みworkspace/gadget template。
- Deferred action: side effect候補をpending actionへ集約。

## Initial features

- workflow timeline
- source/provenance panel
- pending actions review
- project/repo/meeting/incident workspace
- Teams deep link handoff
- model/tool/policy decision summary
- role-based views

## Sandbox

Phase 1では任意コード生成Gadgetを実行しない。typed React components/ViewSpecだけ。任意コードGadgetはPhase 6以降、isolated iframe + CSP + isolated server sandbox + no ambient network + capability proxyを満たす場合だけ。

## Storage

- workspace metadata/read model: PostgreSQL
- large transient artifact: approved object storage
- code: GitHub
- formal document: SharePoint
- working knowledge: Confluence
- workflow state: Temporal
- Cloudflare Artifacts: none
