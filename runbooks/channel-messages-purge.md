# Runbook: チャネル会話写し（channel_messages）の保持期間purge

根拠: ADR-0005（保持期間: プロジェクト終了から13か月）/ REQ-028（DevOps監査保持1年との整合）

## 前提条件

- DevOps正本PostgreSQLへのSQL実行権限（DELETE on channel_messages）
- 実行頻度: 月次（第1営業日を推奨）

## 実行前チェックリスト

- [ ] 対象プロジェクトの project_channels.closed_at が正しく設定されているか確認
- [ ] 削除対象件数を事前カウントし、想定外の大量削除でないことを確認

## 手順

1. 削除対象の確認（closed_atから13か月経過したチャネルのメッセージ件数）:

```sql
SELECT pc.project_id, pc.team_id, pc.channel_id, pc.closed_at, COUNT(cm.message_id) AS messages
FROM project_channels pc
JOIN channel_messages cm ON (cm.team_id, cm.channel_id) = (pc.team_id, pc.channel_id)
WHERE pc.ingestion = 'closed'
  AND pc.closed_at < now() - INTERVAL '13 months'
GROUP BY 1, 2, 3, 4;
```

2. 削除実行:

```sql
DELETE FROM channel_messages cm
USING project_channels pc
WHERE (cm.team_id, cm.channel_id) = (pc.team_id, pc.channel_id)
  AND pc.ingestion = 'closed'
  AND pc.closed_at < now() - INTERVAL '13 months';
```

3. 監査記録（手動操作のため実施者IDで記録）:

```sql
INSERT INTO audit_log (trace_id, actor, action, basis, detail, at)
VALUES (gen_random_uuid(), '<実施者ID>', 'channel_messages_purge', 'ADR-0005',
        jsonb_build_object('deleted_channels', <件数>, 'executed_by_runbook', 'channel-messages-purge'),
        now());
```

## 確認方法

- 手順1のクエリを再実行し、結果が0行であること
- audit_logに purge 記録が存在すること
