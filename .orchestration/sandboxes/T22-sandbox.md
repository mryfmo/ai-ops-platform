# T22 Sandbox

## Environment

- Repository: `/Users/mryfmo/Workspace/ai-ops-platform`
- Branch: `agent/T22`
- Base branch: `agent/T21`
- Date: 2026-07-10

## Commands

- `/Users/mryfmo/.agents/skills/agmsg/scripts/inbox.sh /Users/mryfmo codex`
- `/Users/mryfmo/.agents/skills/agmsg/scripts/inbox.sh ai-ops-platform codex-gpt55-high`
- `git switch -c agent/T22`
- Read task and audit files:
  - `.orchestration/tasks/T22-g1-production-gate.md`
  - `.orchestration/audit/2026-07-09-bestpractice-BC.md`
  - `.orchestration/audit/2026-07-09-bestpractice-A-ops.md`
- Read-only metadata lookups through `gh api` and release checksum fetch for exact pins.
- Targeted regression tests.
- `pnpm run format:write`
- `mise run ci`

## Constraints Observed

- No invented GitHub accounts, teams, SHAs, or secret values.
- No dependency additions.
- No merge, push to main, or force push.
- `.orchestration/` artifacts are not committed.
