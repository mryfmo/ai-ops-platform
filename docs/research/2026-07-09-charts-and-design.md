# 補完調査: チャートライブラリ比較 + ダッシュボードデザイン指針 (2026-07-09)

一次ソース検証済み(npm registry API / GitHub API / bundlephobia / 公式 docs / OSV)。

## チャートライブラリ評価(Next 15 / React 19 / Tailwind v4)

| 候補               | React 19                                    | SSR/RSC                             | バンドル(gzip)           | メンテ状況                                  | 備考                                                                                                 |
| ------------------ | ------------------------------------------- | ----------------------------------- | ------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Recharts 3.9.2** | ✔ peerDeps 対応                             | ✖ client-only(メンテナ明言 #6139)   | 145 kB                   | 非常に活発(2026-07-04 リリース)             | **a11y デフォルト有効(v3)**、CSS 変数テーミング= Tailwind v4 トークンと整合(shadcn/ui パターン)、MIT |
| visx 4.0.0         | ✔(v4, 2026-06)                              | △ 静的プリミティブは RSC 可         | 50 kB 以下               | 活発だが间欠的(19 ヶ月ギャップあり)         | 軸/tooltip/a11y は自作、最小バンドル、MIT                                                            |
| ECharts 6.1        | コア非依存(wrapper に React 19 型問題 #628) | △ SSR 文書化あり(renderToSVGString) | 368 kB(モジュール分割可) | Apache、最活発                              | React グルーが最弱、JS テーマが Tailwind と相性悪                                                    |
| Tremor             | ✖ react ^18 固定、npm 凍結(2025-01)         | ✖                                   | 222 kB                   | **弱い**(Vercel 移籍後 copy-paste モデルへ) | npm 依存としては現状ブロック                                                                         |
| 手書き SVG 継続    | ✔                                           | ✔ 唯一のゼロ JS RSC                 | 0                        | 自前負担                                    | **唯一 REQ-010 変更不要**。5 期間切替の軸/目盛/tooltip を全部自作・全部テストする負担                |

**証拠上の最有力: Recharts 3**(React 19 対応 + 活発メンテ + a11y デフォルト + Tailwind トークン整合。弱点は client-only と 145 kB)。次点は visx(バンドル/RSC 重視の場合)。採否は Phase D の ADR で決定(REQ-010 AC-010-1 の spec-change 手続きが必要)。

## exceljs 健全性判定(Excel インポート用)

**休眠だが脆弱性なし — npm の SheetJS より安全で採用可**。最終リリース 4.4.0 (2023-10)、未修正 advisory なし(OSV/GitHub 確認)。対して npm `xlsx` は CVE-2024-22363 が恒久未修正。注意: セキュリティ即応体制はないため、信頼できないファイルのパースは自前バリデーションを厚く。

## デザイン指針(高品質ソースのみ)

- 定量エンコードは**長さと 2D 位置**。ダッシュボードでは pie/donut/gauge/3D を避ける(NN/g)※既存 donut は再考対象
- ダッシュボードは**一瞥即解**用。探索用ではない。色は他チャネルの補強であり単独の定量チャネルにしない(色覚多様性 ~8%)(NN/g)
- **チャートジャンク排除・データインク比最大化**(Tufte / NN/g)
- カテゴリカルパレットは隣接コントラスト最大化の規定順で。**シーケンシャルはライト/ダークで反転**。アラート色: 赤=危険、橙=重大警告、黄=警告(IBM Carbon data-viz)
- **RAG は色+第 2 チャネル(形状/パターン/ラベル)の冗長化**(NN/g / ECharts decal)
- **数値は tabular figures(等幅数字)** — KPI タイル・表・チャートで桁を縦に揃える(Google Fonts Knowledge)
- チャート型はデータ関係で選ぶ: FT Visual Vocabulary の 9 分類(deviation/correlation/ranking/distribution/change-over-time/part-to-whole/magnitude/spatial/flow)

## 主要ソース

- npm registry / GitHub API / bundlephobia(各セル)
- https://www.nngroup.com/articles/dashboards-preattentive/
- https://carbondesignsystem.com/data-visualization/color-palettes/
- https://fonts.google.com/knowledge/introducing_type/understanding_numerals
- https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary
- https://echarts.apache.org/handbook/en/best-practices/aria/
- https://github.com/exceljs/exceljs / OSV / GitHub Advisory DB
