# ADR-0025: OpenTag由来Teams surfaceと既存Next.js Workbenchを交換可能なPresentation Layerとして採用する

## Status
Proposed（2026-08-10 取込。Owner 承認後に Accepted 化。取込元: docs/plans/2026-08-final-architecture/10_adrs/）

## Decision
OpenTagからchannel/thread/rich UI/file/HITL/AG-UIの設計を取り込み、標準OpenAI agentやMCP接続を全体control planeとして使わない。Cloudflare OSからworkspace/gadget/capability/deferred-actionの設計だけを既存Webへ移植し、Cloudflare runtimeへ依存しない。

## Supersession
ADR-0005のGraph ingestion/RSCは維持し、Teams内rich interactionを拡張。ADR-0013/0018のViewSpec/Reasoning/Generative UIをcapability-scoped Workbenchへ拡張する。
