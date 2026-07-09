# Reports Guide

## Seven Keys

Seven Keys は経営向けのプロジェクト別 RAG マトリクスで、K1〜K7 を表示する。

| Key | Meaning                                     |
| --- | ------------------------------------------- |
| K1  | Stakeholders are committed                  |
| K2  | Business benefits are realized              |
| K3  | Work and schedule are predictable           |
| K4  | Scope is realistic and managed              |
| K5  | Team is high performing                     |
| K6  | Risks are mitigated                         |
| K7  | Delivery organization benefits are realized |

RAG の表示は色だけでなく記号とラベルを併用する。

| RAG    | Label  | Meaning                                                |
| ------ | ------ | ------------------------------------------------------ |
| green  | 順調   | 現時点の入力では問題が小さい。                         |
| yellow | 注意   | 注意が必要。                                           |
| red    | 危険   | 重大なリスクまたは遅延がある。                         |
| grey   | 未評価 | 必要な質問票または観測データがない。推測では埋めない。 |

K1/K2/K7 と K6 の一部は質問票由来。質問票が無い場合、grey が正しい表示であり、AI が補完するものではない。

## Manager View

マネージャービューは次を表示する。

- 総プロジェクト数
- 総チケット数
- 残チケット数
- プロジェクト一覧
- バーンダウンチャート
- DevOps 側データがある場合の velocity、coverage、DORA 5

PrjOps の「チケット」は課題・アクションを指す。DevOps の「チケット」はインシデントを指す。

DORA 5 はサービス/Repository別の表とグラフに出る。画面はチーム間の順位付けではなく、同じスコープ内の状態把握のために使う。

## Investor Report

Investor Report は投資家ペルソナ向けに次を表示する。

- ハイライト
- KPI 現在値
- KPI テーブル
- マイルストーン
- 高重大度リスク

KPI 定義は `packages/prjops/src/lib/investorMetrics.ts` の定義テーブルにある。現在の実装は ILPA 2019 ベースの `revenue`、`ebitda`、`milestone_delay_days`、`high_severity_open_issues` を扱う。

## Standard Agent Reports

AI agent 標準報告は `standard-report.v1` schema に従う。LLM が生成するのは `conclusion`、`riskSummary`、`nextActions` の文章スロットだけで、metrics と evidence IDs はコードで注入される。
