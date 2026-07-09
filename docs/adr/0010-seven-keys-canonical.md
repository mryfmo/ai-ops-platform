# ADR-0010: executiveSevenKeysをSeven Keys to Success正典準拠に刷新する

## ステータス

採用

## コンテキスト

- 既存 `executiveSevenKeys` は、ポートフォリオ健康度、進捗達成率、高リスク課題数、予算消化率、スケジュール遵守率という独自の5指標であり、Seven Keys to Successの正典7キーとは一致しない。
- `docs/research/2026-07-09-seven-keys.md` は、IBM系資料に基づき7キー名と月次PDCA、キー毎RAG評価、direct controls/indirect controlsの区分を整理している。
- 同調査は、財務指標が遅行指標として意図的に除外されること、現行の予算消化率が正典に合わないことを確認している。
- 予定仕様ID: PrjOps `REQ-038` / `SPEC-INT-065` / `AC-038-1`。実装コード参照を追加しない本ADR段階では、`REQ`/`SPEC-INT` のspec-id登録は実装フェーズへ送る。

## 決定

- `executiveSevenKeys` は、以下の正典7キーをプロジェクト毎 × キー毎のRAGで評価するモデルに刷新する。
  - Stakeholders committed
  - Business benefits
  - Work and schedule predictable
  - Scope managed
  - Team high performing
  - Risks mitigated
  - Delivery organization benefits
- direct controlsであるキー3/4/5と、キー6の一部はGitHub由来データからコードで算出する。
- indirect controlsであるキー1/2/7と、キー6の定性的部分は構造化質問票で入力する。LLMは文章スロットの整形に限定し、RAG判定の数値算出には使わない。
- 現行の予算消化率はSeven Keysから除去する。必要な場合は財務・投資家向けの別ビューで扱う。
- 月次PDCAサイクルを報告ジョブに組み込み、前月RAG、当月RAG、主要変化、次アクションを記録する。

## 根拠

- Seven Keysはポートフォリオの単一色分布ではなく、プロジェクト毎に7観点を点検する運用である。
- GitHubデータで強く観測できるのはスケジュール、スコープ、チーム活動、リスクの一部であり、スポンサーコミットや事業便益をコードだけで推定すると誤判定になりやすい。
- 財務指標をSeven Keysに混ぜると、正典が意図する早期警告と行動点検の性格が弱くなる。

## 影響

- 既存のSeven Keys UI/レポートは、5指標の集約表示から7キーRAG表へ変更される。
- 構造化質問票の保存先と入力フローが必要になる。
- 既存の予算消化率表示が必要な利用者には、Seven Keysとは別の財務ビューまたは投資家ビューで提供する。
