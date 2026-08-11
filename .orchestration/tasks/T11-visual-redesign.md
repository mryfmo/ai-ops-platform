# T11: Phase I5 — ビジュアル刷新(ADR-0009 実装、国際水準のビジネスダッシュボード)

## Objective

ADR-0009(Recharts 3 採用、spec-change issue #2)と `.orchestration/research/2026-07-09-charts-and-design.md` のデザイン指針に基づき、packages/web のダッシュボード全体を国際水準のビジネスダッシュボードデザインに刷新する。

## ブランチ戦略

- `agent/T11` を `agent/T10` から作成(スタック継続)。PR は `gh pr create --base agent/T10`
- PR 説明に「PR #7 の上のスタック PR」と明記

## スコープ

### 1. デザイントークン(Tailwind v4)

- カラー: カテゴリカルパレット(色覚多様性対応、隣接コントラスト最大化)、RAG セマンティック(green/yellow/red/grey)+**色以外の第 2 チャネル(アイコン/形状/ラベル)の冗長化必須**、ライト/ダーク両テーマ(シーケンシャルはテーマ間で反転)
- タイポグラフィ: 数値は **tabular figures**(`font-variant-numeric: tabular-nums`)で KPI タイル・テーブル・チャートの桁を揃える。見出し/本文/キャプションの階層を定義
- 情報密度: ダッシュボードは一瞥即解が目的。チャートジャンク排除(不要な枠線・グリッド・装飾を削る)、データインク比を最大化

### 2. Recharts 3 導入(依存追加はこのタスクで recharts のみ許可)

- 全チャートを Recharts に置換: 時系列ライン/エリア(期間切替対応)、バーンダウン(Composed)、DORA トレンド。`accessibilityLayer` は既定有効のまま使う
- **ドーナツは原則廃止**(角度エンコードは読み取り困難 — NN/g)。部分/全体は横棒または積み上げ棒に置換。例外を残す場合は理由を report に
- チャート型はデータ関係で選ぶ(FT Visual Vocabulary: change-over-time はライン、ranking は棒、part-to-whole は積み上げ棒)
- 色は Tailwind CSS 変数(`var(--color-…)`)で渡し、テーマ切替に追随させる(shadcn/ui charts パターン)
- 既存 svgCharts.ts / renderBurndownSvg 系の手書き実装は、メール/Teams 配信用テンプレート(サーバーサイド SVG が必要な箇所)に残す判断も可 — 用途別に整理し report に方針を記載

### 3. 画面刷新(全ペルソナ)

- レイアウト: ヘッダ(組織/期間切替/ペルソナ)、KPI タイル列(tabular figures、前期比の増減表示)、メインチャート領域、詳細テーブルの階層構成
- ExecutiveSevenKeysView: 7 キー × プロジェクトのマトリクスを RAG チップ(色+形状)で。ドリルダウンで根拠(basis)表示
- ManagerSummaryView: バーンダウン+ベロシティ+DORA 5(サービス単位タブ、トレンド)+カバレッジ
- InvestorReportView: KPI パッケージ(ハイライト/KPI テーブル/マイルストーン/リスク)を one-page 構成で
- ローディング(既存 Skeleton 拡張)/空状態/エラー状態を全ビューで統一
- レスポンシブ(縮小時はチャートを優先度順に折返し)。a11y: コントラスト比、キーボード操作(Recharts accessibilityLayer)、aria-label

### 4. 仕様変更の反映

- REQ-010 AC-010-1(外部チャートライブラリ禁止)の変更: T06 登録済みの `AC-010-3` プレースホルダを実装参照し、spec-change issue #2 を PR から `Refs #2` で参照(クローズはしない — 仕様承認は人間)

### 5. テスト

- 既存 web テストの流儀(React element props 検証、RTL なし)で全ビュー更新。チャートはデータ整形 lib(props 生成)を純粋関数に切り出してユニットテスト。describe/it に仕様 ID

## 規約

- DoD: **並列 `mise run ci` green**。GitHub checks は base が main でないため CodeRabbit のみ確認
- 依存追加は recharts のみ。Tremor/visx/ECharts は不可(ADR-0009)
- Conventional Commits、PR(`ai-generated`)、マージ禁止、`.orchestration/` は commit しない

## Forbidden actions

- recharts 以外の依存追加(フォント・アイコンライブラリも不可 — システムフォントと SVG アイコン自作/既存で)
- main への push、PR マージ、force push、実 API 呼び出し
- データ算出ロジックの変更(表示層の刷新に限定。lib の数値算出はいじらない)

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T11-report.md`
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T11-validation.txt`
- sandbox / learning / autoskill: 同ディレクトリ T11-\*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T11 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 60
