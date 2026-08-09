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
   デプロイ実施者が最低15分間、Application Insights / Log Analyticsの監視ダッシュボードを目視で確認すること。
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

## 6. dead letter event の復旧

`AiOpsDeadLetterQueueNotEmpty` は、再試行上限へ到達した event が1件でも5分間残ると発火する。
無条件の一括再投入は poison event を再実行するため、以下を event ID ごとに行う。

1. **検知**: alert の発火後、対象と累積試行回数を確認し、出力を障害・変更チケットへ保存する。

   ```sql
   SELECT event_id, trace_id, source, status, attempts, received_at
   FROM events
   WHERE status = 'dead'
   ORDER BY received_at;
   ```

2. **原因確認**: 手順1の `trace_id` と `event_id` で `audit_log` と server log を照合し、外部API障害、
   設定不足、または payload/コード不具合を解消する。通常の処理失敗なら audit action
   `event_dispatch_dead` が残る。lease 切れ回収で dead になった場合はこの action が無いため、同時刻帯の
   scheduler/server 障害と直前の event log を確認する。原因未解消の event は再投入しない。
3. **再投入**: `DATABASE_URL` と通常のDB接続設定を指定した管理用 source-checkout 環境で build 後、
   CLIを event ID ごとに実行する。actor は64文字以内の英数字・`._@-`、reason は障害・変更チケットと解消内容を含める。

   ```bash
   mise run build
   pnpm --filter @aiops/server run events:requeue-dead -- \
     --eventId "<event UUID>" \
     --actor "<operator-id>" \
     --reason "<ticket ID>: <確認した原因と解消内容>"
   ```

   CLI は操作用 trace ID を生成し、再投入結果とともにJSONで出力する。対象が dead でなければ失敗するため再実行しない。
   HTTP route や直接 UPDATE は、reason のsanitization/検証と追記専用監査を迂回するため使用しない。
   `attempts` は累積試行履歴として**保持する**。
   リセットして過去の試行回数を失わせず、再投入後の1回が失敗すれば即座に dead へ戻す。

4. **監視復帰**: event が `queued` → `dispatched` → `done` と進み、
   Application Insights `AppMetrics` の `aiops_events_queue_depth`（`Properties.status="dead"`）が0へ戻り、
   `AiOpsDeadLetterQueueNotEmpty` alert が解消することを確認する。
   再び dead になった場合は再投入を繰り返さず、手順2へ戻る。
