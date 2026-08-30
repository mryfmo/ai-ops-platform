# ADV-FIX-03 Validation

Status: **blocked precondition; baseline checks only**

## Authority trace

- `rg` production manifest/digest callers: exit `0`; matches are limited to guard internals, task/review contracts, fixtures, and review workflow path input. Server dispatch/schema matches: none.
- Server confirm dispatch inspection: only `task_id/project_id/instruction/base_ref/agent`.
- `coding_tasks` schema inspection: no manifest bytes/path/digest authority.
- Current branch and `origin/main`: both `c8704c54c304669036054dfab23f92b7aa560d90` at branch creation.

## Baseline commands

| Command | Exit | Result |
| --- | ---: | --- |
| `node --test scripts/coding-agent-path-guard.test.mjs contracts/agent-review/agent-review.test.mjs` | 0 | 24/24 pass; proves existing components work in isolation, not that they are wired |
| `mise run actionlint` | 0 | existing workflows parse |
| `mise run governance` | 0 | 40/40 governance tests plus plane mapping pass |
| `mise run lint` | 0 | all workspace lint tasks pass |
| `mise run traceability` | 0 | baseline traceability passes; generated matrix restored afterward |
| `mise run format` | 1 | unrelated orchestrator-owned untracked `.claude/contextdb/config.json` is not Prettier-formatted |
| `test -f .claude/hooks/contextdb_cli.py` | 1 | CompactionDB CLI unavailable on current main |

## Not run

- New collector digest tests: no implementation was allowed after the missing-authority STOP.
- Local workflow pre/post wiring probe: no production manifest input exists to wire; fixture-only execution would not validate the missing authority path.
- Full CI / PR checks: no implementation commit or PR was created.

## Adversarial conclusion

- Supplying a writer-controlled checkout manifest cannot satisfy F4.
- Adding required workflow inputs without a producer makes all current server-triggered executions fail.
- Deriving allowed paths from instruction/task ID silently creates an unreviewed authority and is rejected.
- Therefore the only fail-closed result inside current scope is to leave execution unmodified and report the prerequisite.
