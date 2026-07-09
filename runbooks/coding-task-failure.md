# Runbook: AIコーディングタスク失敗時の対応

根拠: ADR-0006（coding_tasks状態機械: queued → running → pr_created | failed | cancelled）

## 状態確認

```sql
SELECT task_id, project_id, requested_by, agent, status, workflow_run_id, pr_url, created_at
FROM coding_tasks WHERE status IN ('queued', 'running', 'failed')
ORDER BY created_at DESC LIMIT 20;
```

## 症状別の対応

### 1. status='queued' のまま進まない

- 原因候補: workflow_dispatch失敗（GitHubトークン失効・workflowファイル名変更）
- 確認: GitHub Actions画面で coding-task.yml の実行履歴を確認
- 対応: トークン更新後、WebUIから再実行、または手動dispatch:
  `gh workflow run coding-task.yml -f task_id=<ID> -f instruction="<指示>" -f base_ref=main`

### 2. status='running' のまま長時間（>30分）

- 確認: 該当workflow run（workflow_run_id）のログを確認
- タイムアウト・APIレート制限が典型。ジョブをキャンセルし status を手動更新:

```sql
UPDATE coding_tasks SET status = 'failed', updated_at = now() WHERE task_id = '<ID>';
```

### 3. status='failed'

- workflow runログで原因分類:
  - **指示が曖昧/実現不能**: 指示者に差し戻し（Teamsスレッドに理由を返信）
  - **CI失敗（エージェント生成コードの品質）**: PRが作られていれば人間がレビューして修正 or クローズ
  - **インフラ起因（secrets欠落等）**: OPS対応後に再実行
- 再実行はWebUIまたは手動dispatchで新タスクとして発行する（同一task_idの再利用はしない）

### 4. mainに直接pushされた形跡がある（重大）

- **発生してはならない事象**（ADR-0006ガバナンス違反）。ブランチ保護設定を即時確認
- git履歴・audit_log・workflow runログを保全し、インシデント（Sev2以上）として起票
- 該当コミットはrevert PRで巻き戻す（force-push禁止）

## 監査

- 手動でのstatus変更・キャンセルは必ずaudit_logへ記録する:

```sql
INSERT INTO audit_log (trace_id, actor, action, basis, detail, at)
VALUES (gen_random_uuid(), '<実施者ID>', 'coding_task_manual_intervention', 'ADR-0006',
        jsonb_build_object('task_id', '<ID>', 'from_status', '<旧>', 'to_status', '<新>', 'reason', '<理由>'), now());
```
