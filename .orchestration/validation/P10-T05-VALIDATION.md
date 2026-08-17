# P10-T05 Validation

Date: 2026-08-17

## Test-first and structural evidence

| Check | Result |
| --- | --- |
| Validator test before implementation | expected `ERR_MODULE_NOT_FOUND` |
| `node --test deploy-workflow/deploy-workflow.test.mjs` | exit 0; final 9/9 |
| `pnpm --dir contracts test` | exit 0; final 72/72 |
| `mise run actionlint` | exit 0 |
| `bash -n deploy/aws/ecs-release.sh` | exit 0 |
| `shellcheck deploy/aws/ecs-release.sh` | exit 0 |
| scoped Prettier check | exit 0 |
| `git diff --check` | exit 0 |

The negative fixtures reject floating action refs, mutable or cross-repository
images, arbitrary build paths, long-lived AWS credential references, missing
OIDC, tag-scoped SBOM/provenance, missing GitHub Environment approval, reordered
or skipped 0/10/50/100 gates, and rollback outside the failed production job.
The shell guard separately rejects a mutable image before invoking AWS.

## Repository CI

Three `mise run ci` passes ran against independently recreated task-owned fresh
PostgreSQL 16 databases
`aiops_p001`, `aiops_test`, and `aiops_load_test` on local port 55434. It exited
0 before review and after each review-fix round, including governance, Rego 25/25,
contracts 72/72 on the final pass, dependency audit,
actionlint, lint, traceability, format, build, typecheck, all-package coverage,
940 server tests, and `P001 PostgreSQL integration passed`. The dedicated
`aiops-p10-t05-postgres` container was stopped and deleted after each pass; the pre-existing
`aiops-p001-postgres` container was untouched.

## Scope and secret checks

- PR #255 was inspected through `gh`; its exact changed-file list was treated as
  forbidden and none of those paths changed.
- The P10-T05 implementation contains placeholders and GitHub Environment
  variables only; no real credential, access key, signing key, AWS endpoint, or
  Terraform apply is present.
- Existing unrelated worktree changes, task files, reviews, generated
  traceability output, package store, and reference archive were excluded.

## Review gate

- `make require-crit-review`: exit 2 because this repository has no such target.
- Browser Crit was not opened because project instructions prohibit it.
- Exact-commit Codex review found and prompted fixes for repeated use of a
  one-shot ECS pause hook and a non-terminal rollback timeout. Final exact-commit
  review then found an automatic-progression race when a runner observes a gate
  after ECS has passed it. The final implementation accepts an already-reached
  gate only after deployment status and alarm validation. The exact final code
  commit review reported no actionable regression.
