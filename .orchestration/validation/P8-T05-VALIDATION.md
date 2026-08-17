# P8-T05 Validation

## Test-first Evidence

1. RED: the focused Node test failed because `validateDroidExecutionAction` did not exist.
2. GREEN: the final focused run passed 13/13 combined Claude and Droid tests. Droid
   mutations cover the artifact pin, checksum order, gate reachability, provider route,
   branch/policy controls, ceilings, and evidence schema.

## Commands and Results

- `node --test contracts/agent-execution/claude-profile.test.mjs contracts/agent-execution/droid-profile.test.mjs`:
  PASS, 13/13.
- Synthetic Droid evidence through the committed `jq` filter: PASS.
- Settings-template render with a dummy LiteLLM URL/key: PASS.
- `mise run actionlint`: PASS.
- `mise run contracts`: PASS, 85/85; contract lint reported 0 errors, 26 warnings,
  and 1 informational message.
- `mise run format`: PASS.
- `mise run traceability`: PASS.
- Final fresh-DB `env CI=true ... mise run ci`: PASS, exit 0 on PostgreSQL 16 at
  `127.0.0.1:55457` using untouched `aiops_p8t05_final_test`,
  `aiops_p8t05_final_load_test`, and `aiops_p8t05_final_p001` databases. Governance
  40/40, OPA 29/29, contracts 85/85, actionlint, lint, traceability, format, build,
  typecheck, all package coverage, server 966/966, and P001 PostgreSQL integration passed.
- `make require-crit-review`: unavailable (`No rule to make target`). `crit status --json`
  reported no review file. The local staged-diff review found and resolved two findings,
  recorded in `.orchestration/reviews/P8-T05-review-evidence.json`.

## Negative Coverage

- Floating/wrong CLI version or digest, missing checksum-before-install, and an untrusted
  distribution route.
- Conditional, bypassable, reordered, or `continue-on-error` activation gates.
- Direct provider/Factory credential exposure or a non-LiteLLM model route.
- Detached/non-agent branch, widened tools/network/deploy/mutation policy, or non-isolated
  settings.
- Raised or missing runtime/cost/token/turn contract values; missing, negative,
  non-numeric, oversized, or wrongly typed callback evidence.

## Known Baseline Output

- Production dependency audit reports 2 moderate vulnerabilities and passes the high gate.
- The first local PostgreSQL startup was blocked only by sandbox shared-memory policy; the
  identical approved external run used an isolated fresh cluster and passed.
- Validation is static plus synthetic execution. No Factory credential, model call,
  staging E2E, or active parity claim was used.
