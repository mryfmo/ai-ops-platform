<!-- 根拠: FinalArch:CON-004, FinalArch:CON-005, ADR-0023 -->

# P1-T03 validation

## Acceptance gates

- `opa version`: 1.19.0, Rego v1.
- `opa test packages/policy/policies -v`: exit 0, 12/12 pass.
- `opa build -b packages/policy/policies -o /private/tmp/p1-t03-policy-bundle.tar.gz`:
  exit 0.
- Canonical catalog comparison: exit 0; L0-L6 dispositions, 14 initial tool
  operations, and eight global denies match exactly.
- `pnpm --filter @aiops/policy run test`: exit 0, 3/3 pass, including durable
  canonical-to-bundle catalog parity.
- `pnpm --filter @aiops/policy run build`: exit 0.
- `pnpm --filter @aiops/policy run typecheck`: exit 0.
- `pnpm --filter @aiops/policy run lint`: exit 0.
- `pnpm exec prettier --check packages/policy`: exit 0.
- `make require-crit-review`: unavailable; the repository has no such target.

## Default-deny evidence

Rego negative tests prove denial for malformed/unknown input, undefined tool,
unknown risk, declared/registered risk mismatch, unknown top-level property,
tool/resource system mismatch, out-of-scope project, accidentally registered
globally forbidden action, and unregistered L4-L6 requests.

## Fresh database CI

- Recreated `aiops_test`, `aiops_load_test`, and `aiops_p001` on
  `127.0.0.1:55432` immediately before the final run.
- Standalone `env CI=true ... mise run ci`: exit 0.
- Final line: `P001 PostgreSQL integration passed`.
- `pnpm audit --prod --audit-level high` remained below its failure threshold
  with one low and two moderate advisories.
- CI-generated empty lockfile importer and traceability timestamp were restored;
  neither is part of the task diff.

## Boundary

- Intended commit paths: `packages/policy/**` only.
- `pnpm-workspace.yaml`, `pnpm-lock.yaml`, root TypeScript config, schema files,
  and parallel P1-T01/T02 paths are unchanged.
- PR #174 revised head: `846f0da683c40f4c68ac1cddd2407111e8047330`.
- GitHub `build-test`: pass; `gitleaks`: pass; `ai-generated`: present.
- PR author: `app/aiops-pr-bot`; merge not performed.
