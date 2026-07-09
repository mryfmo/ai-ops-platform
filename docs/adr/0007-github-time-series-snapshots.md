# ADR-0007: GitHub時系列データ基盤をwebhook駆動スナップショット蓄積で構築する

## ステータス

採用

## コンテキスト

- PrjOps/DevOpsの週次・月次・四半期・半年・年次レポートでは、Issue、Project v2、milestone、deploymentの状態変化を時系列で集計する必要がある。
- `docs/research/2026-07-09-deep-research.md` は、GitHub Projects v2 GraphQL APIからper-itemのフィールド変更履歴を遡及取得できないこと、`projects_v2_item` webhookが一部フィールドのfrom/toを含むこと、`projects_v2_status_update` webhookでプロジェクト状態を取得できることを確認している。
- 既存の `events` テーブル経路はADR-0005で常駐サーバに集約済みであり、GitHub webhook受信経路を持つ。
- 予定仕様ID: PrjOps `REQ-036` / `SPEC-INT-062` / `AC-036-1`、DevOps `REQ-031` / `SPEC-INT-081` / `AC-031a`。実装コード参照を追加しない本ADR段階では、`REQ`/`SPEC-INT` のspec-id登録は実装フェーズへ送る。

## 決定

- Projects v2の時系列データは、org-level webhook（`projects_v2_item`のfrom/to、`projects_v2_status_update`）を既存 `events` テーブル経路で受け、状態スナップショットとして自前DBに蓄積する。
- webhookの取得はforward-onlyであるため、この基盤を最優先で稼働開始する。過去分はGitHubから完全復元できない前提で扱う。
- webhook取りこぼしを前提に、定期フルポーリングでGitHub現在値とDBスナップショットを照合するreconcileジョブを置く。
- GraphQLのrate limit値はハードコードせず、`rateLimit` オブジェクトから実行時に取得してジョブのページングと待機を決める。
- 週/月/四半期/半年/年の集計はDBスナップショットからコードで算出する。LLMに数値算出を任せない。
- DORAは2024年版の5メトリクスに合わせ、`deployment rework rate` を `doraMetrics` に追加する。表示単位はサービスまたはリポジトリ単位とし、チーム間比較のリーグテーブルは作らない。

## 根拠

- GitHub Projects v2はper-item変更履歴の遡及取得APIを提供していないため、定期バッチだけでは任意期間の変化量を復元できない。
- `projects_v2_item` webhookは主要フィールドのfrom/toを含むが、milestone変更など一部はfrom/toを持たない。webhook単独ではなくフルポーリング照合を組み合わせる方が欠損に強い。
- GraphQLの時間あたりポイント予算を固定値として扱う主張は調査で棄却済みである。実行時 `rateLimit` を正とする方がGitHub側の差分に追随できる。
- DORAの公式指針はサービス単位の改善に使うことを求め、チーム横断比較を避ける。基盤データの集計粒度もそれに合わせる。

## 影響

- 本ADR以後、Project v2履歴を必要とする機能は、GitHub APIから過去履歴を直接取得できる前提を置かない。
- DBにはProject v2 item/status、Issue、milestone、deploymentのスナップショット保存先とreconcile結果の監査ログが必要になる。
- 初回リリース前にorg-level webhookまたはGitHub App権限の設定が必要になる。ユーザー所有Projectは対象外とする。
- `REQ`/`SPEC-INT` のspec-id登録は、対応する実装コード参照と同じPRで追加する。
