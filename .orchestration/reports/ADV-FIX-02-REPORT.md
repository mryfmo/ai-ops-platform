# ADV-FIX-02 Report

- Worker: `codex-deep-dot`
- Branch: `agent/ADV-FIX-02`
- Base: `c8704c54c304669036054dfab23f92b7aa560d90`
- Pull request: https://github.com/mryfmo/ai-ops-platform/pull/273
- Implementation commit: `1b0d83af0b4e8418ebb237920f580258c2daff5b`
- cost: N/A (local worker execution; no metered task cost was provided)

## Result

[memory:decision] Approval creation now establishes its CAS authority in the same
database statement: `expected_version = 1` and `expires_at = now() + 60 minutes`.
The 60-minute TTL follows DevOps:TH-002: escalation after 30 minutes and automatic
expiry after another 30 minutes. PostgreSQL supplies both timestamps so application
clock drift cannot split `created_at` from expiry.

[memory:decision] `GET /approvals` exposes `version` and an identity-bound signed
`correlation` only for `canDecide: true` rows. The Web BFF reconstructs the fixed
server action and approval ID, validates the browser-provided capability shape,
and signs that exact body with the authenticated subject envelope. Unauthorized or
legacy rows receive no version/correlation authority.

The list-to-decision route now reaches the CAS repository and Temporal signal
adapter when configured. When the adapter is absent, the existing 503 remains
fail-closed and the UI displays `承認機能は現在準備中です`. The UI also distinguishes
loading from a settled empty list and maps 400/401/403/409/503 failures.

## Scope

- Changed only the approved server repository/route, web BFF/panel, and their tests.
- Did not change schema, migrations, Teams cards, Temporal composition, dependencies,
  permission policy, or unrelated open-PR files.

## Preconditions and project memory

- The required adversarial audit was absent from main and was read without branch
  mutation using `git show 4417cbd:.orchestration/audit/2026-08-18-adversarial-full-review.md`.
- `.claude/hooks/contextdb_cli.py` is absent on this branch. The orchestrator waived
  the command and will consolidate these `[memory:decision]` records after its
  checkpoint branch merges; no replacement tool was installed or cherry-picked.

## Evidence

- Validation: `.orchestration/validation/ADV-FIX-02-validation.md`
- Sandbox: `.orchestration/sandboxes/ADV-FIX-02-SANDBOX.md`
- Learning: `.orchestration/learning/ADV-FIX-02-learning.md`
- AutoSkill: `.orchestration/autoskill/runs/ADV-FIX-02.md`
