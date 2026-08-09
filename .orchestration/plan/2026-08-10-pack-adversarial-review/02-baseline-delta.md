<!-- 根拠: final-implementation-pack BASELINE.md「基準差分の扱い」手順 / 01-adversarial-review.md -->

# baseline-delta.md — パック基準 49e2e3c → 現 main ff66698

パック規定の手順（新 HEAD 記録 → 差分分類 → 不変条件との衝突抽出 → Owner 承認 →
WBS 更新）に基づく。**本書の承認までパックの実装適用は開始しない。**

## 1. 新しい HEAD

- branch: main
- HEAD: `ff66698`（fix(approvals): enforce project decision scope (#151)）
- 基準からの差分: 6 squash merges（#146〜#151、いずれも bot レビュー消化 + orchestrator 受入 +
  merge 後 CI green の証跡付き）

## 2. 差分の分類

| PR | 内容 | パック不変条件との関係 |
|---|---|---|
| #146 | PrjOps scheduler 結線（weekly/daily、action_reminder_state、PMO mailbox、ADR-0003 amendment） | **整合**（INV-004 は in-process loop を「最終形にしない」ことを求める。本結線は暫定であり P3 の Temporal 移行対象に追加が必要 = DELTA-01） |
| #147 | AGT-02/04 一本化（休眠 orchestration 削除、純粋契約を shared/reporting へ移植） | **整合**（INV-020 の lib/orchestration 分離を強化）。P2-T06 のパス一覧要更新 = DELTA-05。REQ-004/005 の後続 A054 を WBS へ追補 = DELTA-07 |
| #148 | 監視統一（spec 改訂、httpMetrics、KQL 6ルール、prometheus 廃止、rolling gauges） | **整合**（OTel/App Insights 方針と同方向）。P9-T08 は既存資産を起点に = DELTA-04 |
| #149 | AGT_DEP 結線（deployments 状態機械、TH-001 CI artifact、fail-closed 境界） | **整合**（evidence-based enablement の実践）。action_ledger との authority mapping 要定義 = DELTA-03/06 |
| #150 | AGT-07 ゲート強化（metric scope、表示名辞書、V-D master 突合、config 結合） | **整合**（INV-014/015 の実装） |
| #151 | 承認のプロジェクトスコープ認可 | **整合**（INV-012/016）。approval_requests 設計との統合が必要 = DELTA-02/PACK-08 |

**アーキテクチャ不変条件と衝突する変更: なし。** 全差分はパックの意図（決定性・監査・
fail-closed・段階移行）に沿う方向の先行実装であり、必要なのは WBS/契約側の取り込みである。

## 3. 承認を求める事項

| # | 事項 | 提案 |
|---|---|---|
| A | 本 delta の承認（パック適用の前提） | 承認 |
| B | PROC-01: Writer 配分（Claude 56 / Codex 54） | 案A: パックどおり Claude-writer タスクは Claude が専用 worktree+PR で実装、Codex 独立レビュー |
| C | PACK-06: GitHub プラン変更（branch protection 前提） | ENV-DEC 追加。P0-T02 の前提として Owner がプラン変更可否を裁定 |
| D | DELTA-07: A053/A054 の WBS 追補、D-14/15/16 の ENV-DEC 統合 | 追補する（A054 は P6 帯、A053 は P9 帯へ） |
| E | 取込方式 | 原本 zip は references/ に不変保持。修正適用済みコピーを docs/plans/2026-08-final-architecture/ へ取込む PR（P0 前段）を worker 実行 |

## 4. 承認後の WBS 更新（実施予定の要点）

- P3: shadow/cutover 対象を現 15 タスクの全数へ更新、approved-deploy/prod-monitor の
  workflow 化タスクを追加
- P2-T06: LLM consumer 一覧を現実装（AGT03/BLD/INC/teamsConversation/CI）へ更新
- P0-T03: traceability 文法・カタログ拡張を成果物に追加（PACK-04）
- P0-T05: 検証コマンドを実在するものへ修正（PACK-03）
- P8-T04/T06: パス正規化（PACK-02）
- Control API 契約: actorId 排除（PACK-01）、/health 整合（PACK-07）、approvals 統合
  （DELTA-02/PACK-08）
- ENV-DEC 台帳: GitHub プラン、D-14/15/16 を統合

## 5. 判定

- 判定（Owner 記入欄）: **承認**（A〜E 全項。B は案A = Claude-writer タスクは Claude が専用 worktree+PR で実装し Codex が独立レビュー）
- 日付: 2026-08-10（オーナー発言「承認」による。セッション記録参照）
