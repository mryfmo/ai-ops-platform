# T09: Phase I2 — 役割別報告の完成(ADR-0010 / ADR-0011 実装 + マネージャービュー統合)

## Objective

設計確定済みの ADR-0010(Seven Keys 正典準拠)、ADR-0011(PE 投資家ペルソナ)に基づき、役割別報告を完成させる。調査根拠: `.orchestration/research/2026-07-09-seven-keys.md`、`2026-07-09-deep-research.md`(ILPA/DORA)。

## スコープ(この順で)

### 1. Seven Keys 正典刷新(prjops)

- `executiveSevenKeys.ts` を正典 7 キーの**プロジェクト毎 × キー毎 RAG** モデルに刷新:
  - キー 3(Work & schedule)・キー 4(Scope)・キー 5(Team)+キー 6 の定量部分: GitHub 由来データ(マイルストーン遅延、バーンダウン、issue churn、レビュー滞留等 — 既存 lib の statusJudge/issueActionBurndown 等を再利用)からコード算出
  - キー 1(Stakeholders)・キー 2(Business benefits)・キー 7(Delivery org benefits)+キー 6 の定性部分: 構造化質問票入力の型と検証を定義(入力欠落時は RAG=grey/未評価として明示。推測で埋めない)
  - 予算消化率は Seven Keys から除去(正典が排除する財務指標)
  - 月次 PDCA: 前月 RAG との差分(改善/悪化キー)を含む月次スナップショット型
- web の `ExecutiveSevenKeysView` を新モデルに追随(7 キー × プロジェクトのマトリクス、RAG は色+ラベルの冗長表示)
- 旧 5 指標に依存する箇所(reportData ハンドラ等)を追随修正

### 2. 投資家(PE)ペルソナ新設(ADR-0011)

- ILPA Portfolio Company Metrics Template(2019)の構成に倣った**メトリクス定義テーブル方式**(フィールドセット非ハードコード、2027 改訂を吸収可能): `packages/prjops/src/lib/investorMetrics.ts`(定義+算出可能なものは GitHub/既存データから、財務系は入力型を定義)
- persona: `investor` を personaResolver / middlewarePolicy / reportPermissionFilter に追加(権限はデータ取得側で強制、recipients active 判定はリクエスト毎)
- web に InvestorReportView(四半期/月次 KPI パッケージ構成: ハイライト、KPI テーブル、マイルストーン、リスク)+ `app/api/data/investor-summary` ルート
- 標準報告基盤(T07 の packages/shared/src/reporting)に reportType `investor-quarterly` を追加(スロット定義+スキーマ拡張)

### 3. マネージャービュー統合(DORA 5 + カバレッジ)

- `doraMetrics.ts` に **deployment rework rate** を追加し 5 メトリクス化(throughput 3 + instability 2 のグルーピング)。**サービス/リポジトリ単位+時系列トレンド表示、チーム間比較は出さない**(公式ガイダンス)
- ManagerSummaryView に統合: バーンダウン(既存)+ ベロシティ(issue/PR スループット、既存データから)+ テストカバレッジ(riskScore の coveragePct 入力を表示に活用)+ DORA 5
- reportType `manager-weekly` を標準報告基盤に追加

### 4. 仕様 ID

- ADR-0010/0011 記載の予定 ID(REQ-038/SPEC-INT-065/AC-038-1、REQ-039/SPEC-INT-066/AC-039-1 等 — ADR を確認して正確に)を登録し traceability green

## Repo / 規約

- ブランチ `agent/T09` を main から作成(T07 の reporting 基盤は main 未マージのため、**origin/agent/T07 を T09 ブランチに merge してから作業**し、PR 説明に「T07 (PR #4) を含む。#4 マージ後に rebase 可」と明記)
- 既存テスト・型を壊さない。テストは describe/it に仕様 ID。数値算出はすべて lib 純粋関数、LLM は文章スロットのみ
- DoD: `mise run ci` green(レース時 -j 1、記録)。Conventional Commits、PR(`ai-generated`)、マージ禁止、`.orchestration/` は commit しない
- チャート新規追加はこのタスクでは**既存の手書き SVG 流儀を踏襲**(Recharts 移行は Phase I5 で一括。二重作業を避けるため新規チャートは最小限にし、データ整形を lib に置くことを優先)

## Forbidden actions

- 依存追加、main への push、PR マージ、force push、実 LLM/GitHub API 呼び出し(テストはモック)
- Phase I1(webhook スナップショット蓄積)や I5(Recharts 化)の先取り

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T09-report.md`
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T09-validation.txt`
- sandbox / learning / autoskill: 同ディレクトリ T09-\*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T09 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 60
