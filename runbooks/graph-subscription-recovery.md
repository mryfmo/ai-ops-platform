# Runbook: Graphサブスクリプション障害からの復旧

根拠: ADR-0005 / SPEC-INT-001（change notification + 5分ポーリングフォールバック）

## 症状と自動復旧の仕組み

| 症状                         | 自動対応                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| restart                      | renewalとpollingを起動直後に実行し、その後は通常の30分/5分間隔でnon-overlap実行       |
| renew失敗                    | pollingへ遷移して即時backfill。404はpolling taskでreplacement、429/5xxはpollingを維持 |
| lifecycle removed/reauth失敗 | pollingへ遷移してbackfillし、polling taskがrenewまたはreplacementを試行               |
| polling中                    | 未失効ならrenew→backfill、失効/invalid/404ならcreate→backfill→DB publishを試行        |

同じ購読のrecoveryはPostgreSQL advisory lockを使う本実装の参加worker間で1 workerに絞る。lock取得後に台帳を再読込し、old subscription IDがまだ`polling`の場合だけGraph操作へ進む。lock loserやwinner publish後のstale contenderはGraph createを行わない。この保証は同じlock規約を使わない外部プロセスには及ばない。

Modeはrenew失敗時に`notification`から`polling`へ先に変わり、その後のbackfill/auditが失敗しても安全側の`polling`に残る。polling renewalはbackfill成功後、replacementは条件付きDB publish成功時だけ`notification`へ戻る。DB publishは条件付き単一UPDATEだが、Graph create・delta backfill・DB publishをまたぐ原子性はない。publish前に失敗した場合は作成済みの新購読をbounded DELETEでcleanupする。DELETEも失敗した場合はGraph側に孤立購読が残り得るため、`graph_subscription_recovery_cleanup` の `cleanup_failed` を監視して手動照合する。

以下は自動再試行・cleanupで復旧しない場合の手動手順。

## 前提条件

- DevOps正本PostgreSQLへのSQL実行権限
- Graph APIのアプリケーション権限（GRAPH_CLIENT_ID）が有効であること

## 手動復旧手順

1. 現在の購読状態を確認:

```sql
SELECT subscription_id, resource, mode, expires_at, updated_at
FROM graph_subscriptions ORDER BY expires_at;
```

2. 全購読がpolling固着している場合、まず認証を疑う:
   - Entra IDでGRAPH_CLIENT_SECRETの有効期限を確認（失効が最頻原因）
   - シークレットローテーション後、常駐コンテナを再起動（環境変数再読込）

3. 通知URLの疎通確認（Graphからの到達性）:

```bash
curl -s -o /dev/null -w "%{http_code}" "https://<PUBLIC_BASE_URL>/webhooks/graph?validationToken=ping"
# 200 かつ本文 "ping" が返ること
```

4. 固着時はレコードを削除しない。削除した行は自動再作成されない。`graph_subscription_recovery_pending` のstatus、callback到達性、権限を修復し、polling rowを残して次回5分周期の再試行を待つ。

   `cleanup_failed` がある場合はGraphのsubscriptions一覧と台帳をsubscription IDで照合し、台帳に存在しないreplacementだけを削除する。clientStateやGraph response bodyを監査ログへ転記しない。

5. 監査記録:

```sql
INSERT INTO audit_log (trace_id, actor, action, basis, detail, at)
VALUES (gen_random_uuid(), '<実施者ID>', 'graph_subscription_manual_recovery', 'SPEC-INT-001',
        jsonb_build_object('subscription_id', '<対象ID>', 'reason', '<原因>'), now());
```

## 確認方法

- graph_subscriptions.mode が 'notification' に戻っていること
- DB publish成功時もresource/team_id/channel_id/delta_linkが保持され、subscription_idとexpires_atだけがGraph返却値に変わること
- テストチャネルへの投稿が数秒でchannel_messagesに反映されること
