# Deep Research 結果 (2026-07-09) — GitHub PrjOps+DevOps 完成のためのベストプラクティス

deep-research ワークフロー(109 エージェント、26 ソース、116 主張抽出、25 検証 → 23 確認/2 棄却)の要約。Phase D 設計判断の一次材料。

## 検証済み知見(高信頼、3-0 または 2-1 で確認)

### 論点 1: GitHub PM データ基盤 — 「webhook 駆動スナップショット蓄積」が唯一の実行可能戦略

- **Projects v2 GraphQL は per-item のフィールド変更履歴を遡及取得できない**(機能要望 #17405/#196958/#156839 が未解決のまま)。週/月/四半期/半年/年の時系列は、webhook イベントと定期スナップショットを自前 DB に蓄積して構築するしかない。**取得は購読開始以降のみ(forward-only)なので、実装後すぐ蓄積を開始すべき**。
- `projects_v2_item` webhook は 5 種フィールド(single select/text/number/iteration/date)の from/to 値をペイロードに含む(2024-06-27 changelog)。milestone 変更はイベントは発火するが from/to なし。取りこぼし報告例があるため、**定期フルポーリングでの照合(reconcile)を安全網に**。
- `projects_v2_status_update` webhook + `ProjectV2StatusUpdate` GraphQL オブジェクト(2024-06-26〜)でプロジェクトレベルのステータス(ON_TRACK 等、body/startDate/targetDate)は読み書き両方可能。**注意: projects_v2 系 webhook は organization レベルのみ**(org webhook / GitHub App)。ユーザー所有プロジェクトでは使えない。
- GraphQL 制約: 1 コール最大 500,000 ノード、ページネーションは first/last 1-100、ポイントコストはコネクション毎リクエスト数合計 ÷100(切り上げ、最低 1)。ネストしたコネクション(items→fieldValues)はコストが乗算的に増える。**時間あたりポイント予算の数値(5,000/10,000 とされた主張)は棄却済み — ハードコードせず rateLimit オブジェクトから実行時に読むこと**。
- セカンダリリミット: 同時 100 リクエスト、GraphQL 2,000 pt/分、**コンテンツ生成系 80 req/分 + 500 req/時**。大量インポートの律速はこの 500/時。
- Projects v2 の認証: classic PAT または GitHub App installation token で read:project / project スコープ。fine-grained PAT は Projects v2 対応が文書化されていない。
- アイテム追加と更新は 1 コールでできない: addProjectV2ItemById → updateProjectV2ItemFieldValue の 2 ミューテーション必須(GraphQL alias で 1 HTTP リクエストに束ねることは可能)。

### 論点 2: Excel インポート

- 既存ツールは要件を満たさない: github-csv-tools は title/body/labels/state/milestone のみ(Projects v2/sub-issues 非対応、2023-03 が最終リリース)、冪等性なし(再実行で重複作成)。github-issues-importer の「タイトルベース dedup」主張は**棄却**。**冪等性(source-row key を issue body 埋め込み or ローカルマッピング DB)は自前設計が必須**。
- **SheetJS CE (npm の `xlsx`) は CVE-2024-22363 (ReDoS, CVSS 7.5) が npm 版では恒久的に未修正**(npm 最新 0.18.5 は 2022 年発行、修正版 0.20.2+ は SheetJS 独自 CDN のみ)。→ **exceljs を選定するのが妥当**(ただし exceljs 自体のメンテ状況・脆弱性は今回未検証 — Phase D で確認)。
- インポート速度設計: コンテンツ生成 500/時の上限から、大規模インポートはジョブキュー+進捗レポート必須。持続レートは約 1 write/秒以下に。

### 論点 4: PE 投資家報告

- **ILPA が実在の標準テンプレート群を公開**: Reporting Template v2.0(2026Q1 発効)、Performance Template、Capital Call & Distribution Template、**Portfolio Company Metrics Template**(ポートフォリオ企業レベル KPI の GP→LP 標準、2019 初版)。
- Portfolio Company Metrics Template は**現在改訂中で、最終版は 2027 年 1 月リリース予定**。→ 2019 年版 (`ILPA-Portfolio-Company-Metrics-Template_Final.xlsx`) を暫定ベースラインとし、**2027 改訂を吸収できるデータモデル(フィールドセットをハードコードしない)にする**。

### 論点 5: DORA(マネージャービュー)

- **DORA は 2024 年版から公式に 5 メトリクス**: throughput 3 つ(change lead time / deployment frequency / failed deployment recovery time)+ instability 2 つ(change fail rate / **deployment rework rate**)。既存実装の doraMetrics が 4 メトリクスなら rework rate の追加が必要。
- **アプリケーション/サービス単位で提示し、チーム横断比較をしない**のが公式ガイダンス。マネージャービューはサービス/リポジトリ毎 + 時系列トレンドで表示し、チーム間リーグテーブルにしない。

## 棄却された主張(引用禁止)

1. GraphQL 時間あたりポイント予算 = 5,000/10,000(実行時に rateLimit から読む)
2. github-issues-importer のタイトルベース冪等インポート

## 未解決(補完調査中)

1. Seven Keys to Success の 7 項目の正確な定義と RAG 評価基準(一次ソース)
2. チャートライブラリ比較(Recharts/visx/ECharts/Tremor vs 手書き SVG 継続)の React 19/Next 15/SSR 対応・バンドルサイズ
3. Claude Code(skills/output styles/hooks/構造化出力)と Droid/Factory(custom droids/droid exec/AGENTS.md)の報告標準化メカニズム
4. GraphQL 時間あたりポイント予算の実値(GitHub App token と PAT の差)

## 主要ソース

- https://github.blog/changelog/2024-06-27-github-issues-projects-graphql-and-webhook-support-for-project-status-updates-and-more/
- https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api
- https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects
- https://cdn.sheetjs.com/advisories/CVE-2024-22363 / https://nvd.nist.gov/vuln/detail/CVE-2024-22363
- https://ilpa.org/industry-guidance/templates-standards-model-documents/ilpa-templates-hub/ilpa-portfolio-company-metrics-template/
- https://dora.dev/guides/dora-metrics/
