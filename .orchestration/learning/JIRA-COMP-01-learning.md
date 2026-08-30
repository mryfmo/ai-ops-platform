# JIRA-COMP-01 Learning

## Reusable lessons

- [memory:decision] serverの独立性を保つには、serverへcontrol-planeを依存させず、両方に依存する薄いdeployment composition rootでDI seamを結線する。
- [memory:decision] 運用語彙`live`とworkflow contract語彙`active`の差は、compositionのconfig境界で一度だけ明示変換する。
- [memory:decision] Jira webhookとcomplete snapshot reconcileは、既存`deriveJiraRevision`、`assertJiraSyncRequest`、`buildJiraSyncWorkflowId`を再利用すればrequest identityと冪等性が揃う。
- [memory:failure] schema外envの`.env.example`コメントを`# NAME=`形式にするとruntime config inventoryへ誤って入る。非assignment形式で説明する。
- [memory:failure] root Temporal coverageは一時test-serverが終了すると無関係なsuiteが連鎖失敗する。該当package単独runで切り分け、fresh環境のfull CI greenを最終条件にする。

## Promotion

新規Codex learn / skillは作らない。恒久仕様はcomposition package、runbook、project CompactionDB decisionへ集約した。

CompactionDB decision command:

```bash
python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'JIRA-COMP-01: @aiops/composition is the deployment root that wires server Jira seams to the internal Temporal jira-sync workflow; JIRA_SYNC_EXECUTION_MODE defaults to shadow and maps live to the workflow active contract; webhook and complete-snapshot reconcile use canonical event requests and deterministic revision/workflow IDs.'
```

cost: n/a
