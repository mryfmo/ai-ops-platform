# P10-T04 Validation

Date: 2026-08-17

## Test-first and PostgreSQL evidence

| Check | Result |
| --- | --- |
| `./deploy/aws/test-db-roles.sh` before provisioning SQL existed | expected exit 1: missing provisioning SQL |
| Missing all password references | rejected before role/database creation |
| Provisioning SQL applied twice before schema and once after | exit 0; only idempotent existing-schema/membership notices |
| Logical databases/schemas/roles | exact app, LiteLLM, Temporal, visibility, owner, and readonly contract present |
| Cross-database isolation | `litellm_app` and `temporal` connections to `aiops` rejected |
| Catalog audit privileges | app UPDATE/DELETE/TRUNCATE false; INSERT/SELECT true |
| Real audit mutations as `app_role` | UPDATE, DELETE, and TRUNCATE each rejected |
| Normal application access | actual `events` INSERT then UPDATE succeeded as `app_role` |
| LLM reservation reconciliation | actual `llm_usage` INSERT then UPDATE succeeded as `app_role` |
| Migration ledger integrity | catalog INSERT privilege absent and actual INSERT rejected as `app_role` |
| Work IQ receipt mutation grant | UPDATE absent after the post-schema provisioning pass |
| Readonly behavior | SELECT succeeded; UPDATE rejected |

Definitive command used a task-owned PostgreSQL 16 cluster:

```text
P10_T04_PG_BIN=/opt/homebrew/opt/postgresql@16/bin ./deploy/aws/test-db-roles.sh
DB ROLE PASS: idempotent provisioning and audit UPDATE/DELETE/TRUNCATE denial verified.
```

The first local attempt exposed Homebrew's `libpq`-only `initdb` symlink and then
the managed sandbox's shared-memory restriction. Selecting the installed
PostgreSQL 16 server bin directory and granting local shared-memory access fixed
the environment; neither issue changed product behavior.

## Terraform and shell

| Check | Result |
| --- | --- |
| `terraform fmt -check -recursive deploy/aws/modules deploy/aws/envs` | exit 0 |
| `bash -n deploy/aws/validate-modules.sh deploy/aws/test-db-roles.sh` | exit 0 |
| `shellcheck deploy/aws/validate-modules.sh deploy/aws/test-db-roles.sh` | exit 0 |
| `P10_T01_STATIC_ONLY=1 ./deploy/aws/validate-modules.sh` | exit 0; nine modules and root valid |
| `./deploy/aws/validate-modules.sh` | exit 0; `create=57 update=0 delete=0; prod-dr-copy=enabled` |
| `git diff --check` | exit 0 |

The full harness planned both synthetic dev and production shapes against the
digest-pinned loopback Floci service. Mechanical assertions covered 35-day RDS
retention, `rds.force_ssl=1`, 35-day AWS Backup retention, selection of the RDS
ARN, the app/LiteLLM secret containers, exclusion of database bootstrap secrets
from ECS IAM, reuse of Temporal's module-owned password, absence of secret
versions, the production Osaka vault/LTR copy, and 35-day encrypted cross-region
automated-backup replication. It never ran `terraform apply`.

An intermediate design placed the Osaka vault inside the child module with an
aliased provider. Standalone module validation correctly failed with `Provider
configuration not present`; the final design keeps the region-specific resource
in the composition root and injects its ARN into the reusable RDS module.

## Repository CI

Two full `mise run ci` passes ran against independent fresh task-owned
PostgreSQL 16 database sets on port 55444. The final set was
`p10t04_final_test`, `p10t04_final_load`, and `p10t04_final_p001`. Both exited 0,
including governance, Rego 25/25, contracts 55/55, audit, actionlint, lint,
traceability, format, build, typecheck, all-package coverage, 930 server tests,
and `P001 PostgreSQL integration passed`.

After independent review fixes, a third full pass used fresh databases
`p10t04_review_test`, `p10t04_review_load`, and `p10t04_review_p001` on port
55447. It exited 0 with 930 server tests and `P001 PostgreSQL integration passed`.
The disposable server was then stopped.

After adding continuous cross-region automated-backup replication, the final
full pass used fresh databases `p10t04_final2_test`, `p10t04_final2_load`, and
`p10t04_final2_p001` on port 55448. It exited 0 with 930 server tests and
`P001 PostgreSQL integration passed`. The disposable server and its data
directory were then removed.

After resolving the final review findings, a further full pass used fresh
databases `p10t04_final3_test`, `p10t04_final3_load`, and `p10t04_final3_p001`
on port 55449. It exited 0 with 930 server tests and `P001 PostgreSQL integration
passed`. The disposable server and its data directory were then removed.

The generated `traceability_matrix.md` remains an unrelated unstaged file and is
not part of this task.

## Secret and scope checks

- Pattern scan found no private-key block, AWS access key, GitHub token, or
  provider API key in the task paths.
- Terraform contains placeholder identifiers only and creates no
  `aws_secretsmanager_secret_version`.
- GitHub PRs inspected with `gh`: #250 (merged), #251, #252, #253. No task path
  overlaps the open PR changed-file lists.
- Existing unrelated worktree files and the task assignment file were excluded
  from staging.

## Review gate

- `make require-crit-review`: exit 2, target absent.
- `crit status --json`: `review_file_exists=false`.
- Browser Crit was not opened because project instructions prohibit it.
- A local staged/commit diff review and receipt are recorded under
  `.orchestration/reviews/P10-T04-*` before RESULT.

The first independent `codex review --commit` reported four findings. Their
resolved records cover ECS IAM secret scope, app repository privileges, Temporal
password-source consolidation, and parameter-group major alignment. A final
review was run after those fixes.

The next review found that daily LTR copies could not meet ADR-0029's regional
RPO. The design independently replicates RDS snapshots and transaction logs
continuously to Osaka with a rotating destination KMS key. The production plan
asserts that resource and 35-day retention.

The final review found five residuals. The provisioning/test now covers the
required `llm_usage` reconciliation update; whole-instance AWS Backup recovery
points and copies expire after 35 days so shorter-retention data is not preserved
for five years; rollback remains available only before writes resume; the Osaka
query reads `RestoreWindow.LatestTime`; and disposable restore targets are deleted
without an unmanaged final snapshot.

The last independent review found five further residuals. The runbook now deletes
only non-promoted exercise targets, requires PITR/AWS Backup/Osaka replication to
protect a promoted ARN before writes resume, queries the emitted replicated-backup
ARN, and filters both backup and copy jobs to the selected RDS ARN. Provisioning
also revokes runtime mutation of `schema_migrations`, with a real denied INSERT in
the disposable PostgreSQL check.

After those fixes, the definitive role test passed again. A fresh-DB `mise run ci`
pass used `p10t04_final4_test`, `p10t04_final4_load`, and `p10t04_final4_p001` on
port 55450. It exited 0 with 930 server tests and `P001 PostgreSQL integration
passed`; the disposable cluster was stopped and removed by the test trap.
