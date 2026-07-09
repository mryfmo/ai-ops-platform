# Runbook: Graphサブスクリプション障害からの復旧

根拠: ADR-0005 / SPEC-INT-001（change notification + 5分ポーリングフォールバック）

## 症状と自動復旧の仕組み

| 症状                             | 自動対応（subscriptionRenewalTask, 30分間隔）                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| renewSubscription失敗（E-SUB02） | graph_subscriptions.mode='polling'へ遷移。channelPollingTask（5分間隔）がdelta取得で継続 |
| polling中                        | 30分ごとにcreateSubscription再作成を試行し、成功でmode='notification'へ復帰              |

**通常は人間の介入不要**。以下は自動復旧が機能しない場合の手動手順。

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

4. 固着した購読レコードの削除→次回renewalTask実行時に再作成される:

```sql
DELETE FROM graph_subscriptions WHERE subscription_id = '<対象ID>';
```

5. 監査記録:

```sql
INSERT INTO audit_log (trace_id, actor, action, basis, detail, at)
VALUES (gen_random_uuid(), '<実施者ID>', 'graph_subscription_manual_recovery', 'SPEC-INT-001',
        jsonb_build_object('subscription_id', '<対象ID>', 'reason', '<原因>'), now());
```

## 確認方法

- graph_subscriptions.mode が 'notification' に戻っていること
- テストチャネルへの投稿が数秒でchannel_messagesに反映されること
