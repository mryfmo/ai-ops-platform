# P8-T03 Validation

## Test-first Evidence

1. RED: the focused Vitest command failed because the scoped credential activity did not
   exist and the workflow still referenced long-lived secrets.
2. GREEN: final focused run passed 32/32 tests across the client, issuer, lease lifecycle,
   negative identity/scope/expiry cases, and workflow structure.

## Commands and Results

- `pnpm --filter @aiops/control-plane exec vitest run tests/scopedRunnerCredentials.test.ts tests/codingTaskCredentialWorkflow.test.ts`: PASS, 32/32.
- `pnpm --filter @aiops/control-plane run typecheck`: PASS.
- `pnpm --filter @aiops/control-plane run lint`: PASS.
- `mise run actionlint`: PASS.
- `pnpm --filter @aiops/control-plane run test:coverage`: PASS; the final full run passed
  control-plane 329/329 with package thresholds unchanged.
- Final fresh-DB `env CI=true ... mise run ci`: PASS, exit 0 using an isolated PostgreSQL
  16 cluster on `127.0.0.1:55444`; governance 40/40, OPA 29/29, contracts 72/72,
  actionlint, lint, traceability, format, build, typecheck, all-package coverage, and
  PostgreSQL integration all passed.
- `git diff --check`: PASS.
- `/private/tmp/gitleaks git --staged --no-banner --redact --verbose .`: PASS, no leaks.
- `make require-crit-review`: unavailable (`No rule to make target`). `crit status --json`
  reported no review file, and browser Crit is prohibited by project policy. The complete
  staged diff was reviewed locally; two findings and their resolutions are recorded in
  `.orchestration/reviews/P8-T03-review-evidence.json`.

## Negative Coverage

- Missing/unsafe LiteLLM issuer URL and missing model/budget/duration.
- Provider response model/budget/expiry drift and already-expired issued credential.
- Missing OIDC token, wrong issuer/audience/repository/subject, and expired OIDC identity.
- Out-of-scope repository, `main` branch, wrong model, excess budget, and excess duration.
- Provider revocation failure remains reported with its lease retained for retry.
- Workflow contains no `LITELLM_CODING_VIRTUAL_KEY`, `AIOPS_PR_TOKEN`, LiteLLM master key,
  or GitHub App private-key secret reference.

## Known Baseline Output

- Contract lint reports 0 errors, 26 warnings, and 1 informational message.
- Production dependency audit reports 2 moderate vulnerabilities and passes the high gate.
- Sandboxed `mise` cache-write warnings do not affect command results.
- The first full CI attempt stopped only at Prettier for the two new TypeScript files; after
  targeted formatting, the complete fresh-DB CI rerun passed.
- A later diagnostic rerun intentionally reused the prior CI-mutated database and reproduced
  the baseline parallel schema collision (`audit_log is not partitioned`). It was discarded;
  the required final run used a newly initialized cluster and passed server 966/966.
