# 手動運用手順書（Manual Operations Runbook）

根拠: PrjOps DOC-02 §5（例外・障害時のふるまい）/ DevOps SPEC-INT-060 / REQ-029（可用性・失敗時挙動）

本書は、エージェント（本システム）が停止・障害中に、人間が代替運用を行うための手順を定義する。
AC-029a「エージェント停止状態で手動デプロイ手順が実行可能」の実体はこの手順書である。

---

## 1. DevOps: 本番デプロイの手動実行

エージェント（AGT-DEP）が停止している場合でも、人間はGitHub Actionsの`deploy-prod`ワークフローを
手動で実行できる（`packages/devops/src/workflows/deploy-prod.yml`）。

1. GitHubリポジトリの Actions タブ → `deploy-prod` ワークフローを選択。
2. 「Run workflow」から`commit_sha`（デプロイ対象）または`rollback=true`+`target_version`
   （ロールバック時）を入力して実行。
3. `environment: production` に設定された **Required reviewers**（必須レビュアー、リーダー以上）
   の承認が求められる。この承認operationが、エージェント経由の承認（TH-002）の代替となる
   （SPEC-INT-060「Environments保護ルールの必須レビュアー承認が代替の人間承認として機能する」）。
4. デプロイ後の監視（TH-003相当）は、エージェント停止中は自動化されないため、
   デプロイ実施者が最低15分間、監視ダッシュボード（Datadog等）を目視で確認すること。
   異常があれば、同じworkflow_dispatchから`rollback=true`で手動ロールバックする。

## 2. DevOps: エージェント停止（フェイルセーフ発動）時の対応

`AGT_ORCH.evaluateFailsafe`が3回連続ヘルスチェック失敗を検知すると、以下が自動的に停止する
（`isOperationAllowedDuringFailsafe`が`false`を返す操作。REQ-029(a)）。

| 操作                                           | フェイルセーフ中       | 人間の代替手段                                  |
| ---------------------------------------------- | ---------------------- | ----------------------------------------------- |
| 自動デプロイ（ステージング昇格・本番デプロイ） | 停止                   | 本書§1の手動手順                                |
| 自動クローズ（誤検知インシデント）             | 停止                   | GitHub Issueを手動でクローズ                    |
| 権限付与（grant）                              | 停止                   | `grants`テーブルへ手動INSERT（要SQL実行権限者） |
| 権限剥奪（revoke）                             | **継続**（安全側操作） | 対応不要                                        |
| 通知送信                                       | **継続**               | 対応不要                                        |

全プロジェクトチャネルへ「自動運用を一時停止中。手動運用手順に切り替えてください」通知
（SPEC-EXT-042）が届いたら、上記表に従い対応する。

## 3. PrjOps: report generation / delivery が失敗した場合

ADR-0014 以降、PrjOps のアウトバウンド配信は package-local workflow ではなく resident server scheduler が担う。
標準 report の生成は `.github/workflows/report-generation.yml`、受領と配信は `POST /reports/ingest` と
`reportDeliveryTask` が担う。

1. `report-generation.yml` が失敗した場合は、GitHub Actions のログと `standard-report.retry.audit.json`
   を確認し、必要に応じて workflow を再実行する。
2. `REPORT_INGEST_URL` または `REPORT_INGEST_SECRET` が未設定の場合、workflow は artifact upload のみで
   正常 skip する。配信失敗として扱う前に設定状態を確認する。
3. server 側で `report_ingest_disabled` または `report_delivery_disabled` の監査ログが出ている場合は、
   [report delivery runbook](report-delivery.md) に従って `REPORT_INGEST_SECRET`、`REPORT_DELIVERY_ENABLED`、
   `FROM_MAILBOX`、recipients を確認する。
4. データ不整合等、コードの修正が必要な場合は、通常のPRを作成し、レビュー後にマージしてから再実行する。

## 4. 監査ログへのアクセス

- PrjOps: `prjops-data`/`prjops-reports`リポジトリのコミット履歴、および`audit/`配下のJSONL
  （`packages/shared/src/auditLog.ts`の`JsonlAuditLog`実装が書き込む形式）。
- DevOps: PostgreSQLの`audit_log`テーブル（追記専用。`REVOKE UPDATE, DELETE`をアプリロールに
  適用していること。`packages/devops/src/db/schema.sql`参照）。

いずれも、`findTraceChain`（PrjOps）または`trace_id`でのSQL検索（DevOps）により、
特定のレポート・デプロイ・インシデントに関わった全操作を時系列で再構成できる
（PrjOps AC-020-1, DevOps AC-028a）。

## 5. コスト超過時の対応

`InMemoryCostGuard`/本番実装のコストガードが日次上限（既定$20、SPEC-INT-060）超過を検知すると、
以降のLLM呼び出しジョブは`DailyCostLimitExceededError`で停止する。運用担当は
`audit/llm_usage.jsonl`（またはDB相当）を確認し、異常な呼び出し量がないか調査した上で、
翌日まで待つか、設定ファイルで上限額を一時的に引き上げる（PRF-03の承認が必要）。
