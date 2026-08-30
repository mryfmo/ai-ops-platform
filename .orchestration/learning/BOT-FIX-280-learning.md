# BOT-FIX-280 Learning

[memory:decision] Jira runtime の production backend は server に Temporal 依存を足さず、deployment composition から `main()` DI seam へ注入する。Jira env が有効なのに backend がなければ起動を拒否する。

[memory:failure] pnpm store の初回 bootstrap を複数プロセスで並列化すると purge 判定が競合する。未準備 workspace の focused tests は `CI=true pnpm install --frozen-lockfile` 後に逐次実行する。

[memory:failure] traceability は server Zod config と `docs/reference/configuration.md` の key inventory を一致させる。新規 env を追加するときは task scope に台帳が含まれるか先に確認する。

CompactionDB decision command:

```bash
python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'BOT-FIX-280: Jira runtime remains dependency-inverted: server main() accepts deployment-injected Temporal jira-sync dispatch and snapshot-commit seams, and configured JIRA_* gates fail startup when either backend is absent. Per-event revision is SHA-256 of canonical updated timestamp plus fieldHash and participates in workflow, business, and idempotency identity.'
```

cost: n/a
