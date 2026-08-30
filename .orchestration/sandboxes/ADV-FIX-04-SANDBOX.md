# ADV-FIX-04 Sandbox Record

## Repository boundary

- Branch: `agent/ADV-FIX-04`
- Base: `origin/main` at `c8704c54c304669036054dfab23f92b7aa560d90`
- Only task-allowed implementation, contract-amendment, test, artifact, and worklog paths were edited.
- Pre-existing ADV-FIX-01/02/03 artifacts, task files, `.pnpm-store`, reference ZIP, and contextdb content were not staged.

## External boundary

- No production credentials were read or created.
- No GitHub push, PR, review, ruleset, merge, or workflow dispatch was performed.
- No paid API or external service was invoked for implementation.

## Database boundary

- PostgreSQL 16 clusters were created only under `/tmp/adv-fix-04-*.*/`.
- Test databases were named `advfix04_fresh`, `advfix04_migrate`, `aiops_test`, and `aiops_load_test`.
- The first parity cluster was stopped after validation. The CI cluster was used only for repository/package/full-CI tests and stopped at handoff.

## User-owned files

`.claude/contextdb` was temporarily moved to a unique `/tmp` directory only while Prettier/full CI ran, because its untracked generated config is outside the task and fails repository-wide format checking. A shell trap restored it after every run; its contents were not edited or staged.
