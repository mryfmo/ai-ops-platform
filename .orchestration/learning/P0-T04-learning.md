<!-- 根拠: FinalArch:GOV-004, FinalArch:GOV-005 -->

# P0-T04 Learning

## Validated learning

- A dependency-free Node scanner is sufficient for repository-shape governance when it reads canonical YAML/config sources and rejects only narrow, explicit forbidden patterns.
- Exact feature-flag parity must cover complete records, not just names: defaults, owners, stages/modes, kill switches, immutable state, exclusions, requirements, scope, notes, ordering, and duplicates all matter.
- With Vitest 4, `pnpm --filter <pkg> run test -- <pattern>` may not filter as intended; `pnpm --filter <pkg> exec vitest run <test-file>` is deterministic.
- Architecture invariants that need operational or legal judgment should remain documented manual gates rather than fragile static heuristics.

## Apply to

- Future governance checks: prefer canonical repository data, task-local fixtures, and one explicit counterexample per rule.
- Future load-test commands: pass file selectors directly to Vitest.
- Future invariant additions: update the canonical invariant document, fitness matrix, scanner/test when automated, and governance task together.

