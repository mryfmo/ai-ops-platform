# A001 reusable learning triage

## Candidate

- When an old dirty checkout contains untracked paths that became tracked on `origin/main`, a direct branch switch can overwrite user work. Use a linked worktree after comparing hashes and obtaining task-owner approval.
- Status: candidate only; not promoted.
- Apply to: future repository-audit task setup and dirty-worktree preservation.

## Project-specific finding

- `docs/audit/09-remediation-plan.md` is explicitly historical. Current execution order is `docs/spec/productization-decisions.md` → Plan 010 → referenced lower-level task ledger.
- Apply to: plan/status audits; never infer current completion from the historical checklist alone.

## Review policy

- Crit is an agent-side review surface for Claude Code and Codex. Use its CLI to author, read, reply to, and resolve review records; never open a browser review or ask the user to perform the review.
- Apply to: all future review gates and orchestration tasks.

## No worklog update

The A001 task explicitly forbids worklog edits, so this triage is recorded only at the required orchestration path.
