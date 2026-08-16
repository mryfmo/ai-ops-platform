# Handoff: wave-2 checkpoint（2026-08-16）

正本 handoff。前版: 2026-08-16-p5-checkpoint.md。

## 到達点（前版以降の merge）

- P3-T13（#244）: deploy/monitor loop の Temporal 移行（P3 コード面完結）
- P6-T11（#249）: 3-channel status ingest（ING-001。R01: clean-runner
  coverage は PG suite skip 前提 — dual-test 必須の教訓）
- P7-T01（#245）: channel-teams scaffold / P7-T07（#246）: Workbench
  参照専用 read model（R01: PG suite の schema 分離）
- P8-T01（#247）: agent task manifest + One-Writer overlap gate
- P10-T01（#248）: AWS Terraform 9 module + floci 実測 plan（create=49）
- 証跡 sync: #243（P5 checkpoint）

## 現在の解禁済みキュー（機械依存判定 2026-08-16）

| 優先 | タスク | 内容 | 備考 |
|------|--------|------|------|
| 1 | P8-T02（critical） | pre/post path boundary guard | 発注済み/次発注 |
| 2 | P7-T02 | identity/thread/workflow mapping | channel-teams 続き |
| 3 | P8-T06 | Codex independent review job | |
| 4 | P10-T04 | DB roles/schemas/backups | |
| 5 | P10-T03 | identity/secret provisioning | |
| 6 | P10-T05 | deployment pipelines/provenance | |
| 7 | P7-T08 | Workbench capability grants | |
| gate | P4-T05..T08 | MCP onboarding | **register 承認待ち**（裁定 2） |

## Owner gate（不変）

register Decision record 承認（evidence #236 完備）/ sandbox-m365 /
AWS env（P10 の apply 面・staging）/ Wispr 調達 / GH Actions 資格 + dry run

## Review 定型（追加された教訓）

- built dist の素 ESM import 検証（P5-T07 R01）
- real-PG store は dual-test 必須 + `env -u TEST_DATABASE_URL` coverage 通過
  （P6-T11 R01）/ PG suite は固有 schema 分離（P7-T07 R01）
- clean-runner CI が最終環境判定（local green を過信しない）
