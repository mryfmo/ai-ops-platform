# Handoff: P5 checkpoint（2026-08-16）

正本 handoff。前版: 2026-08-15-p4-checkpoint.md。

## 到達点（前版以降）

- **SEC-REG-P4**（#236）: agentgateway/OPA の license evidence pack —
  register クローズは Owner/Legal/Security の承認判断のみに縮約
- **P5 依存充足分を全消化**:
  - T01（#237）: Work IQ OBO contract + claim validator（app-only 構造拒否）
  - T02（#238）: delegated Work IQ MCP client（強制再検証・ask 非再送・
    provenance 保持/欠落明示）
  - T03（#239）: /m365/query 境界（identity→claims→OPA→client 固定順序。
    P1 self-review → 裁定 → 是正の好例）
  - T07（#240）: **WIQ-004 egress 統制**（restricted 二重停止・
    customer-confidential=Bedrock only・R01 dist import 欠陥を review で検出是正）
  - T08（#241）: query receipts（追記専用・原文なし）+ two-user
    permission differential harness（曖昧不合格の厳密判定）
  - T06（#242）: Graph app-only 型分離（branded token を本番経路に、
    負型テスト 6 種）
- 全タスク: codex writer + orchestrator adversarial review（全件で反証
  プローブ実測）+ fresh-DB `mise run ci` 単独判定 + exact-head CI green

## Owner 判断事項（すべての残タスクの前提）

1. **license register Decision record 承認**（evidence は #236 で完備）
   → P4 entry 正式クローズ + **P4-T05..T08**（MCP onboarding）解禁
   → その後 P4-T09 → P4-T12（MCP production gate）
2. **sandbox-m365 実 tenant**
   → P5-T04（gateway 経由 conformance）/ WIQ-001/002/005 の実 tenant E2E
   （T08 の harness 実行）→ P5-T05（経路裁定、writer=claude 起票は可能）
   → P5-T09（pilot flag）
3. **AWS env / test tenant**（従来から）: P2-T03/T04/T10、P3-T10 soak、
   P3-T12 退役、P10 系
4. Wispr 調達（P6-T01 系の前提: register OPEN/STOP 行）

## 運用規範の追記（P5 で確立）

- workspace 内部依存（workspace:* link）は「依存追加禁止」の対象外 —
  amendment で package.json + lockfile を限定許可（P5-T03/T07 で定型化）
- worker の self-review P1 検出 → orchestrator 裁定 → 是正の loop が
  3 回機能（T03 scope 意味論 / T06 未使用 factory / T07 は reviewer 側で
  R01 dist import 検出）。**built dist の素 ESM import 検証**を review の
  定型プローブに追加（vitest/tsc が隠す runtime 欠陥を検出する）
- 「拡張子なし subpath import」は typecheck を通るが dist で落ちる —
  `@aiops/*` の subpath は必ず `.js` 付き

## 技術申し送り（前版分に追加）

- P5-T07 note: /m365/query → egress checkpoint の実結線は P5-T09 系の要件
  （結線漏れ確認を T09 task file に含めること）
- P5-T03 note: require_approval は現状 403 遮断 — L2 相当の M365 操作を
  載せる際は P4-T04 approval 链接を再利用
- P5-T02 note: network 例外は idempotent でも非 retry（shared util 仕様）
