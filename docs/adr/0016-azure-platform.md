# ADR-0016: Azure managed platform is the production baseline

## Status

Accepted — 2026-07-13

## Context

ADR-0003 and ADR-0005 require a resident container but intentionally leave the cloud provider undecided. ADR-0015 is a Proposed record whose backup technology, retention, RPO, and RTO are `TBD(HUMAN)`. That uncertainty prevents deterministic infrastructure, release, restore, disaster-recovery, and acceptance work.

The repository owner accepted the recommended environment in the 2026-07-13 productization decision session. This ADR records that choice at the architecture layer so the accepted-ADR precedence rule and `docs/spec/productization-decisions.md` do not conflict.

## Decision

- Run the server and web runtime on Azure Container Apps in multiple-revision mode.
- Store images in Azure Container Registry and deploy immutable digests with SBOM and provenance.
- Use Azure Database for PostgreSQL Flexible Server on private networking.
- Resolve secrets from Azure Key Vault through separate user-assigned managed identities for staging and production.
- Expose only Azure Front Door Premium with WAF; the Container Apps origin and PostgreSQL endpoint are not public application entry points.
- Use Log Analytics and Application Insights for logs, metrics, traces, and alert routing.
- Define all Azure resources in Bicep. Portal-only production resources are configuration drift and do not satisfy acceptance.
- Use Japan East as primary and Japan West as regional disaster recovery.
- Separate staging and production by subscription when available and, at minimum, by resource group, identity, vault, database, Container Apps environment, and GitHub environment.
- Release revisions at 0% direct-label smoke, then 10%, 50%, and 100% traffic. A failed gate returns traffic to the previous immutable digest.
- Retain PostgreSQL automated backups for 35 days, enable geo-redundant backup at server creation, and retain weekly long-term backups for five years.
- Target same-region RPO <= 5 minutes and RTO <= 60 minutes; target regional-disaster RPO <= 60 minutes and RTO <= 4 hours.
- Target 99.9% monthly availability for the authenticated application path. The required alert set and ownership rules are defined in DEC-ENV-002.

Exact subscription IDs, resource IDs, DNS names, certificates, identity IDs, SKU sizing, budgets, and on-call destinations are ENV inputs. They are not architecture choices and must not be committed as secrets.

## Supersession

This ADR supersedes only the unresolved cloud-provider statements in ADR-0003 and ADR-0005. Their resident-server, scheduling, Hono, Graph, and permission decisions remain in force.

This ADR also supersedes the undecided provider/backup/RPO/RTO portions of Proposed ADR-0015. ADR-0015 remains as historical option analysis; implementation and acceptance use this ADR and DEC-ENV-002.

## Alternatives rejected

| Alternative                             | Reason rejected now                                                                                           | Reconsider only if                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| AWS or another managed cloud baseline   | Splits the Microsoft identity/Graph operating model and leaves the accepted Azure resource design unusable    | The owner approves a replacement ADR with equivalent identity, private network, backup, DR, cost, and E2E evidence |
| Self-managed Kubernetes                 | Adds cluster, ingress, upgrade, autoscaling, and control-plane operations not required by current workloads   | Container Apps cannot meet a measured workload, networking, or compliance requirement                              |
| Virtual machines or Docker hosts        | Adds patching, host HA, scheduler, secret distribution, and rollout mechanisms already supplied by Azure      | A required component cannot run on Container Apps and an owner accepts the additional operating burden             |
| Azure App Service                       | Does not match the accepted multi-revision traffic and job/container operating model as directly              | A validated design meets the same rollout, private-network, job, probe, and rollback criteria more simply          |
| Self-managed pgBackRest as the baseline | Duplicates managed PITR/geo-backup operations and increases credential, storage, monitoring, and restore load | Managed backup cannot satisfy an approved retention/export/account-loss requirement                                |

## Consequences

- Phase 6 may implement Bicep and local policy tests without waiting for subscription IDs.
- Staging apply, restore, DR, traffic-shift, and alert evidence remain external ENV/human gates.
- Azure cost and service coupling are accepted tradeoffs; they are controlled by budgets, immutable IaC, tested restore, and a replacement-ADR requirement.
- No implementation may claim production readiness from a Bicep build or mocked deployment alone.

## References

- [Productization decision record](../spec/productization-decisions.md)
- [Azure Container Apps revisions](https://learn.microsoft.com/en-us/azure/container-apps/revisions)
- [Azure Container Apps traffic splitting](https://learn.microsoft.com/en-us/azure/container-apps/traffic-splitting)
- [Azure Container Apps Key Vault references](https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets)
- [Azure Database for PostgreSQL backup and restore](https://learn.microsoft.com/en-us/azure/postgresql/backup-restore/concepts-backup-restore)
