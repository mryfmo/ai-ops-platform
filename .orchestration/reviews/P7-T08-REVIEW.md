# P7-T08-REVIEW — approve at `9b134f4`

- task_id: P7-T08 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-17
- head_sha: 9b134f4（full SHA は PR 参照）
- verdict: **approve**

## 独立再検証

- server 931 pass（config/grants/workbench 拡張 81 含む）/ web tests /
  rego **29/29** 再実行
- **DB-less coverage**（dual-test 受入条件）: `env -u TEST_DATABASE_URL` で
  server coverage 閾値通過
- fresh-DB `mise run ci` exit 0（reviewer 環境単独判定 — validation 参照）
- disjointness: open PR #255/#256 変更ファイルとの重複 **0**（機械確認）

## 検分（UX-004）

- **既存 authority の evolve**: grantsRepo に namespaced target
  （workbench:project|repository|space: prefix、resourceId 検証付き）を追加 —
  並行 grant テーブルなし（DELTA-03 遵守）
- **default none**: grant 行が存在しない資源は SQL 述語段階で不可視。
  cross-project negative は**一様・非反射 404**（存在オラクル回避、
  P7-T02/T07 と同型を維持）
- **二層 enforcement**: SQL 解決済み grant を OPA decision に渡し、
  deny/unavailable/未結線すべて fail-closed。**revoke は即時**
  （毎リクエスト re-query — キャッシュ禁止の遵守を test で固定）
- **self-review High の是正**: production composition（index.ts）への
  OPA client 注入 + config（fail-closed 検証・E-code）+ composition test
  （「結線されて 2xx に到達する」test まで含む — fail-closed 一辺倒で
  実は未出荷、を防ぐ正しい両面検証）
- rego 拡張は policy matrix と整合（29/29）。config inventory 2 entry は
  amendment どおり。worker の exact-commit review は NO FINDINGS

## 妥当性判断

capability = 明示 grant のみ（canon）を、既存 authority の evolve +
二層 fail-closed + 即時 revoke で実装。self-review が「安全側に倒れすぎて
機能しない」欠陥を High として拾った点は、fail-closed 文化の成熟を示す。
