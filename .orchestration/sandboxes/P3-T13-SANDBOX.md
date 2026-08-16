<!-- 根拠: TMP-003 / TMP-005 / ADR-0021 -->

# P3-T13 Sandbox Record

- Branch: `agent/P3-T13-deploy-monitor-temporal`, based on local
  `main@c96f50273944d6095804538640aaeeb2df047223`.
- Temporal tests used the in-process time-skipping server with injected
  activities; no real deployment, rollback, approval, GitHub, or network write
  was performed.
- Shadow comparison used the plan-only bundle and deny-network execution path.
- Recorded histories use synthetic identities and unique sequences 7001, 7002,
  and 7003.
- Fresh CI used only disposable local PostgreSQL databases named for P3-T13;
  all were dropped after the successful run.
- Existing unrelated worktree entries were preserved and excluded from commit:
  generated traceability output, the orchestrator task file, `.pnpm-store/`, and
  the reference ZIP.
- No `AGMSG_STORAGE_PATH` override, production flag, push, PR, merge, approval,
  or direct main write was used.
- CompactionDB CLI is absent at `.claude/hooks/contextdb_cli.py`; no memory write
  was attempted.
