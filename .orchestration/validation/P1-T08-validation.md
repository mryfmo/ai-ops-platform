# P1-T08 validation

- `mise run policy:rego`: passed, 12/12 OPA tests.
- OPA missing-PATH validation: failed with the expected clear install message.
- Destructive negative validation: a temporary invalid Rego token made `mise run policy:rego` exit 1 with `rego_parse_error`; the mutation was immediately removed and the gate returned to 12/12 green.
- `mise run contracts`: passed after isolated `pnpm --dir contracts install --frozen-lockfile`; Spectral reported 0 errors and compatibility tests passed 10/10.
- Root `pnpm install --frozen-lockfile`: passed with the new `packages/policy: {}` importer.
- `mise run actionlint`: passed.
- Prettier on changed YAML and `git diff --check`: passed.
- Fresh-DB `mise run --skip-tools ci`: exit 0 with the new OPA/contracts gates, build, typecheck, coverage, traceability, and PostgreSQL integration. Shared 485 tests and server 840 tests passed; P001 integration passed.
- Audit gate passed at `high`; existing inventory was 1 low and 2 moderate.
- Local Next.js Turbopack was blocked by the known macOS Seatbelt port restriction, so local CI used a repo-external preload selecting Next's official `--webpack` path. GitHub exact-head CI remains the normal-build verification.
- Independent Codex review: no actionable findings.
- Exact-head GitHub Actions run 31546159915 passed at `198c02fb7688f173be2fc1c5065525574842137b`: `build-test` and `gitleaks` green. The sha256-pinned OPA install, OPA policy gate, contracts gate, normal build, and PostgreSQL integration all passed.
- Plan-quality validator, hook, reviewer definition, Make target, and CI were unavailable in this repository. The worklog plan's required headings, evidence, positive/adversarial tests, done criteria, and STOP conditions were checked manually.
