# P10-T04 Report

- Worker: `codex-deep-dot`
- Branch: `agent/P10-T04-db-roles-backups`
- Base: `34a9bf4b6e1edc92f17c651653279514af9c4292`
- Scope: RDS roles/schemas, PITR/LTR, audit mutation denial, restore procedure

## Result

[memory:decision] One RDS PostgreSQL instance contains isolated logical databases
and schemas: `aiops`/`app`, `litellm`/`litellm`, and
`temporal`/`temporal` plus `temporal_visibility`/`temporal_visibility`.
Runtime logins remain the established `app_role`, `litellm_app`, and `temporal`.
Separate NOLOGIN owner roles own databases/schemas, and `aiops_readonly` is a
NOLOGIN group role. No application login owns its trust boundary.

[memory:decision] The environment root creates only the app and LiteLLM database
password containers. Temporal's existing module-owned password container is the
single source consumed by both its task and bootstrap. Values are injected by the
approved environment bootstrap; no secret version or credential is a Terraform
input, state value, checked-in argument, or evidence field. Bootstrap-only secret
ARNs are excluded from the shared ECS execution role.

[memory:decision] RDS automated backup retention remains fixed at 35 days for
PITR. Production continuously replicates RDS snapshots and transaction logs to
Osaka with 35-day retention for the regional RPO. Separately, AWS Backup creates
daily recovery points, copies them to an IaC-owned Osaka vault, and expires both
after 35 days. Whole-instance backups cannot satisfy five-year audit/report
retention because they also contain data with 30/90-day retention ceilings;
governed archives own long-term retention instead.

## Delivered

- Extended `deploy/aws/modules/rds/main.tf` with `rds.force_ssl=1`, AWS Backup
  vault/plan/selection/IAM, bounded 35-day retention, and production copy input.
- Extended `deploy/aws/envs/main.tf` with a Terraform-managed Osaka production
  vault, encrypted cross-region automated backup replication, two environment
  database secret containers, sensitive ARN outputs, and an ECS IAM boundary
  that retains only caller-declared service secrets.
- Extended `deploy/aws/validate-modules.sh` to assert dev backup/SSL/secret
  contracts and the production DR-vault/copy shape from loopback Floci plans.
- Added idempotent `packages/devops/src/db/provision_database_roles.sql` and a
  disposable PostgreSQL integration test at `deploy/aws/test-db-roles.sh`.
- Updated `deploy/aws/README.md` with the bootstrap order and
  `runbooks/backup-restore.md` with isolated same-region snapshot/PITR restore,
  validation, cutover, rollback, and explicit AWS deferral.

## Security invariants

- `app_role` has INSERT/SELECT but no UPDATE/DELETE/TRUNCATE on `audit_log`.
- `app_role` has SELECT/INSERT plus the existing repositories' exact UPDATE
  table set, including LLM reservation reconciliation; append-only Work IQ
  receipts retain no mutation grant, and the migration ledger is not insertable
  by the runtime role.
- LiteLLM and Temporal roles cannot connect to the `aiops` database and have no
  audit table privileges; readonly cannot mutate it.
- Temporal consumes the same module-owned password that bootstrap assigns to its
  PostgreSQL role; no duplicate environment secret exists.
- The RDS parameter-group family follows the requested PostgreSQL major version.
- The provisioning script fails closed when any password reference is absent,
  is repeatable, and never grants runtime roles database/schema ownership.
- `packages/devops/src/db/schema.sql` was not changed.
- The existing no-real-AWS credential/endpoint guard remains the only Terraform
  plan entrypoint. No apply or restore command ran.

## Deferred gate

The real staging/production plan/apply, RDS backup job, recovery-point copy,
same-region restore/PITR, and measured RPO/RTO require the approved AWS ENV gate.
P10-T04 does not claim REL-001 or restore acceptance from local/Floci evidence;
P10-T08 owns the real rehearsal.

## CompactionDB

The required project-memory command was attempted, but
`.claude/hooks/contextdb_cli.py` is absent in this checkout, so no project DB
mutation was possible. Durable decisions are recorded above with
`[memory:decision]` markers.

## Independent review disposition

The first local Codex commit review found four issues, all resolved before the
final RESULT: bootstrap secrets were visible to the shared ECS execution role,
`app_role` lacked normal repository privileges, Temporal had a duplicate password
source, and the parameter-group family was fixed to PostgreSQL 16 independently
of `engine_version`. The next review found the daily copy did not meet the
regional RPO; production now also uses continuous RDS automated-backup replication.
The third review found five residual issues: missing `llm_usage` reconciliation,
whole-instance retention beyond short-lived data policy, unsafe rollback,
an incorrect replicated restore-window query, and an unbounded cleanup snapshot.
The final review found five more: promoted-target cleanup could delete production,
backup controls were not re-established before write resumption, DR verification
used the source identifier instead of the replicated ARN, Backup jobs were not
scoped to the selected database/copy, and runtime could insert migration ledger
rows. All findings were corrected and mechanically revalidated.
Final review evidence is under
`.orchestration/reviews/P10-T04-*`.

## Evidence

- Validation: `.orchestration/validation/P10-T04-VALIDATION.md`
- Sandbox: `.orchestration/sandboxes/P10-T04-SANDBOX.md`
- Learning: `.orchestration/learning/P10-T04-LEARNING.md`
- AutoSkill: `.orchestration/autoskill/runs/P10-T04.md`
