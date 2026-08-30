# JIRA-COMP-01 Report

- status: ready_for_review
- branch: `agent/JIRA-COMP-01`
- base: `26b07eaf033c6798d1b394dad2146875523e4f49`
- commit: `dc04e97d82fe8d92b36244dea8dea5c12add63ab`
- push / PR / external Temporal / Jira / GitHub operation: not performed
- cost: n/a

## Result

- `@aiops/composition`をdeployment rootとして追加し、serverのJira DI seamをcontrol-planeの`jira-sync` Workflowへ接続した。
- Webhookとcomplete snapshot reconcileを既存のrevision、request validation、workflow ID helperで構成した。snapshotは`captureComplete=true`だけを受け付け、issueごとに順次投入する。
- `JIRA_SYNC_EXECUTION_MODE`は既定`shadow`、`live`は内部contractの`active`へ変換する。Temporal address、environment、mTLS cert/key/CA、authorization token pathは欠落・空値・読込失敗時に起動を拒否する。
- workflow startは`REJECT_DUPLICATE`と`USE_EXISTING`を使い、既存workflow IDを冪等に扱う。
- networkless test 14件でrequest変換、workflow ID/policy、snapshot fanout、設定fail-closed、server seamを検証した。
- runbookと`.env.example`へcomposition entry、credential subject/permission、shadow→live切替を追加した。

## Durable facts

- [memory:decision] serverとcontrol-planeの依存方向を変えず、両者の実行時結線は`@aiops/composition`が所有する。
- [memory:decision] 外部設定の`shadow|live`はcomposition境界で内部contractの`shadow|active`へ変換し、既定は`shadow`とする。
- [memory:failure] composition専用envを`.env.example`へ`# NAME=`形式で書くとserver/web Zod inventoryとして誤検出されるため、schema外の変数は非assignmentコメントで記録する。
- [memory:failure] repository全体のTemporal coverageは一時test-server終了でフレークすることがある。変更packageの単独greenだけで完了せず、fresh DBでfull CIを再実行してexit 0を確認する。

## Validation

- test-first RED: implementation module不在でsuite失敗を確認。
- `pnpm --filter @aiops/composition run test`: 14/14 green。
- `pnpm --filter @aiops/composition run test:coverage`: 14/14 green。
- fresh PostgreSQL 16（port 55494）+ `CI=true mise run ci`: exit 0。governance、traceability、format、build、typecheck、全workspace coverage、DB/P001 integrationを完走。
- staged allowed-path check、`git diff --cached --check`、credential-pattern scan: clean。
- Crit: CIからcomposition testsが漏れる指摘1件に`test:coverage` scriptを追加し、resolved。
- `make require-crit-review`: target不在。Crit dataとreceiptを`.agents/worklog/codex/review/`へ保存した。

Full evidence: `.orchestration/validation/JIRA-COMP-01-validation.md`

## CompactionDB

Decision command:

```bash
python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'JIRA-COMP-01: @aiops/composition is the deployment root that wires server Jira seams to the internal Temporal jira-sync workflow; JIRA_SYNC_EXECUTION_MODE defaults to shadow and maps live to the workflow active contract; webhook and complete-snapshot reconcile use canonical event requests and deterministic revision/workflow IDs.'
```

Decision ID: `77ada09c-25be-456a-806f-c6f4471b5b31`
