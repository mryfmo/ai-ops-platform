# P8-T04 Validation

## Test-first Evidence

1. RED: the focused Node test failed with `ERR_MODULE_NOT_FOUND` before the action-profile
   validator existed.
2. GREEN: the final focused run passed 6/6 tests, including malicious mutations of the
   artifact pin, credential boundary, branch/tool policy, fixed ceilings, and evidence
   schema. Every composite Bash script also passed `bash -n`.

## Commands and Results

- `node --test contracts/agent-execution/claude-profile.test.mjs`: PASS, 6/6.
- `pnpm --dir contracts test`: PASS, 78/78. The sandboxed attempt failed only because
  `tsx` could not bind its local IPC socket; the identical approved rerun passed.
- `mise run actionlint`: PASS.
- Targeted Prettier check and `git diff --check`: PASS.
- `shasum -a 256 /private/tmp/claude-code-linux-x64-2.1.222.tgz`: PASS, exact reviewed
  digest `6680125b6f3baab47c84797cbeb3196e343c61bb4679cae15d138041a325c1ff`.
- Final fresh-DB `env CI=true ... mise run ci`: PASS, exit 0 on PostgreSQL 16 at
  `127.0.0.1:55453` using untouched `aiops_p8t04_final_test`,
  `aiops_p8t04_final_load_test`, and `aiops_p8t04_final_p001` databases; governance
  40/40, OPA 29/29, contracts 78/78, actionlint, lint, traceability, format, build,
  typecheck, all package coverage, server 966/966, and P001 PostgreSQL integration passed.
- `make require-crit-review`: unavailable (`No rule to make target`). `crit status --json`
  reported no review file; local staged-diff review found and resolved two validator gaps,
  recorded in `.orchestration/reviews/P8-T04-review-evidence.json`.

## Negative Coverage

- Floating CLI version, wrong digest, missing pre-extraction SHA verification, and package
  manager installation.
- Direct provider/master keys or virtual-key exposure to the installer.
- Profile substitution, raised ceilings, detached/non-agent branch, widened built-in
  tools, enabled web access, or missing network/deploy/git-mutation denies.
- Missing timeout, cost, task-token, turn, structured-schema, or callback-output contract.

## Known Baseline Output

- Contract lint reports 0 errors, 26 warnings, and 1 informational message.
- Production dependency audit reports 2 moderate vulnerabilities and passes the high gate.
- The first full CI attempt passed all package coverage but the final disposable-name
  guard rejected `aiops_p8t04`. The corrected rerun used three untouched databases named
  `aiops_p8t04_test`, `aiops_p8t04_load_test`, and `aiops_p8t04_p001` and passed.
- The pinned artifact is Linux x64; local verification covered digest and static contract,
  not a macOS execution or staging E2E claim.
