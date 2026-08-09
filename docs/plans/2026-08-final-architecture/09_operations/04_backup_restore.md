# Backup and Restore

## Scope

| Data | Backup authority | Restore requirement |
|---|---|---|
| PostgreSQL ledgers/audit/read models | Azure PostgreSQL managed backup + approved LTR | PITR and regional restore |
| Temporal Cloud | service retention/export per contract; app mappings in PostgreSQL | workflow continuity playbook |
| Temporal OSS profile | persistence DB + visibility/config | tested server/worker restore |
| GitHub | Git is canonical; repository/org settings evidence | clone + settings/IaC restoration |
| Plane | application DB/volume per deployment runbook | project/work item integrity |
| Confluence/SharePoint | vendor retention/export policies | content/version/permissions verification |
| OPA bundles/config/manifests | GitHub + immutable release artifact | last-known-good deploy |
| LiteLLM/agentgateway config | GitHub/IaC + Key Vault secrets | recreate, not restore plaintext secret dump |

## Targets

Use accepted ADR-0016 targets unless superseded:

- same-region RPO <= 5 min, RTO <= 60 min
- regional disaster RPO <= 60 min, RTO <= 4 hours
- audit/records retention by existing classes and formal record policy

## Quarterly restore drill

1. select recovery point.
2. restore into isolated environment.
3. verify schema/migrations/audit immutability.
4. replay representative workflow/read models.
5. verify external object mappings without re-executing writes.
6. validate authentication/policies/secrets re-provisioning.
7. record measured RPO/RTO and gaps.

Backups without restore evidence do not satisfy readiness.
