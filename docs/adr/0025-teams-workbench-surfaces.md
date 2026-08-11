# ADR-0025: OpenTag由来Teams surfaceと既存Next.js Workbenchを交換可能なPresentation Layerとして採用する

## Status

Accepted（2026-08-11 Owner 承認。根拠: 承認済み baseline-delta と pack 取込の Owner 承認（PR #152）、P0 フェーズでの本 ADR 群に基づく実行実績、および ENV-DEC-001 / ADR-0029 の Owner 裁定。取込元: docs/plans/2026-08-final-architecture/10_adrs/。承認署名 = 本 Status 変更 PR への Owner approve（ruleset 20678089 強制下）。2026-08-10 取込時は Proposed）

## Decision

OpenTagからchannel/thread/rich UI/file/HITL/AG-UIの設計を取り込み、標準OpenAI agentやMCP接続を全体control planeとして使わない。Cloudflare OSからworkspace/gadget/capability/deferred-actionの設計だけを既存Webへ移植し、Cloudflare runtimeへ依存しない。

## Supersession

ADR-0005のGraph ingestion/RSCは維持し、Teams内rich interactionを拡張。ADR-0013/0018のViewSpec/Reasoning/Generative UIをcapability-scoped Workbenchへ拡張する。
