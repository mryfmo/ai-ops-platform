<!-- 根拠: ADR-0019 / P014-FA-T03 -->

# Plane data governance proposal

Status: **PROPOSED — pending Data Owner approval**

Every field, purpose, retention period, procedure, role, and control in this
document is **PROPOSED**. Nothing here is approved or operationally binding
until the Data Owner records explicit approval. No Plane sandbox or production
integration may rely on this proposal before that approval.

## References

- [ADR-0019: Plane as workflow backend](../adr/0019-plane-workflow-backend.md)
- [Plan 014: Plane integration](../../plans/014-plane-integration.md)
- [Data handling contract](../contracts/data-handling.md)

## Proposed purpose

The proposed Plane data flow supports only:

- webhook deduplication and reconciliation;
- shadow observation of Plane entity state;
- scoped board/report derivation using the canonical `PJ-*` project key; and
- append-only operational audit evidence.

Plane remains a workflow backend, not the platform system of record. Plane data
is not proposed for discussion archiving, free-text search, LLM input, identity
profiling, or authorization. Plane UUIDs and actor identifiers must never grant
access; authorization is evaluated first against the canonical `PJ-*` project
scope.

## Proposed field allowlist

Only the following normalized fields are proposed for persistence. Fields not
listed here are denied.

### Webhook events

| Proposed field                | Proposed use                                                                  | Status   |
| ----------------------------- | ----------------------------------------------------------------------------- | -------- |
| `trace_id`                    | Internal processing correlation                                               | PROPOSED |
| `delivery_id`                 | Delivery deduplication                                                        | PROPOSED |
| `entity_type`                 | Select the deterministic state handler                                        | PROPOSED |
| `canonical_project_id`        | Canonical `PJ-*` scope key                                                    | PROPOSED |
| `plane_workspace_id`          | Plane entity correlation                                                      | PROPOSED |
| `plane_project_id`            | Plane entity correlation                                                      | PROPOSED |
| `plane_entity_id`             | Work item or cycle correlation                                                | PROPOSED |
| `external_source`             | Identify the authoritative source namespace                                   | PROPOSED |
| `external_id`                 | Correlate the authoritative source entity                                     | PROPOSED |
| `action`                      | Represent the normalized lifecycle action                                     | PROPOSED |
| `from_state`                  | Represent the prior normalized state                                          | PROPOSED |
| `to_state`                    | Represent the next normalized state                                           | PROPOSED |
| `occurred_at`                 | Source event timestamp                                                        | PROPOSED |
| `received_at`                 | Platform receipt timestamp                                                    | PROPOSED |
| `source_updated_at`           | Reconciliation ordering timestamp                                             | PROPOSED |
| `actor_entra_correlatable_id` | Optional opaque reference to the existing authoritative Entra subject mapping | PROPOSED |

### Snapshots

| Proposed field                     | Proposed use                                                                  | Status   |
| ---------------------------------- | ----------------------------------------------------------------------------- | -------- |
| `capture_id`                       | Snapshot identity                                                             | PROPOSED |
| `trace_id`                         | Capture correlation                                                           | PROPOSED |
| `captured_at`                      | Snapshot timestamp                                                            | PROPOSED |
| `capture_complete`                 | Prevent partial snapshots from being treated as complete                      | PROPOSED |
| `canonical_project_id`             | Canonical `PJ-*` scope key                                                    | PROPOSED |
| `plane_workspace_id`               | Plane entity correlation                                                      | PROPOSED |
| `plane_project_id`                 | Plane entity correlation                                                      | PROPOSED |
| `plane_entity_id`                  | Work item or cycle correlation                                                | PROPOSED |
| `external_source`                  | Identify the authoritative source namespace                                   | PROPOSED |
| `external_id`                      | Correlate the authoritative source entity                                     | PROPOSED |
| `state`                            | Current normalized entity state                                               | PROPOSED |
| `position`                         | Current normalized workflow position                                          | PROPOSED |
| `source_updated_at`                | Reconciliation ordering timestamp                                             | PROPOSED |
| `assignee_entra_correlatable_id`   | Optional opaque reference to the existing authoritative Entra subject mapping | PROPOSED |
| `last_actor_entra_correlatable_id` | Optional opaque reference to the existing authoritative Entra subject mapping | PROPOSED |

An Entra-correlatable field is proposed only as a reference to an existing
authoritative subject mapping. It must not duplicate a name, email address,
user principal name, tenant/object UUID pair, or other display identity. It is
not user-facing, is not sent to an LLM, and is not an authorization key.

## Proposed denied data

The following data is explicitly proposed to be rejected before queue or
database persistence:

- discussion, comment, intake, description, or other free-text bodies;
- entity titles, labels, display names, and arbitrary custom fields;
- personal names, email addresses, user principal names, and avatar data;
- attachments, file contents, HTML, or Markdown;
- raw webhook payloads, raw request/response bodies, and unallowlisted payload
  fragments;
- tokens, credentials, secrets, cookies, and authorization headers;
- IP addresses, user-agent strings, and Plane membership lists; and
- any field not present in the proposed allowlist.

Raw webhook bytes are proposed to exist in memory only for signature
verification and allowlist projection, then be discarded.

## Proposed retention

Legal hold overrides every proposed deletion deadline. The shorter retention
values below require Data Owner and legal approval under the canonical data
handling contract.

| Proposed data class                                         | Proposed retention                                                                               | Status   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------- |
| Raw webhook bytes                                           | No persistence; discard immediately after signature verification and allowlist projection        | PROPOSED |
| Terminal normalized queue envelope                          | 7 days after successful terminal processing                                                      | PROPOSED |
| Failed/dead normalized queue envelope                       | 30 days after terminal failure                                                                   | PROPOSED |
| Normalized event metadata                                   | 365 days from `occurred_at`                                                                      | PROPOSED |
| Complete snapshot metadata                                  | 90 days from `captured_at`                                                                       | PROPOSED |
| Entra-correlatable fields                                   | Earlier of the containing row's expiry or the canonical active-lifetime-plus-365-day ceiling     | PROPOSED |
| Erasure evidence without direct entity or actor identifiers | 5 years from completion                                                                          | PROPOSED |
| Backups containing allowlisted Plane data                   | At most 35 days from backup creation; primary deletion may remain only until that backup expires | PROPOSED |

## Proposed erasure procedure

1. Record a Data Owner-approved erasure request, its scope, legal-hold result,
   and accountable operator.
2. Stop new correlation for the affected subject or canonical project before
   changing stored data.
3. Using a time-bound maintenance role, delete the affected event/snapshot rows
   or irreversibly null the Entra-correlatable fields. The application role must
   not receive this capability.
4. Preserve append-only audit history; do not update or delete audit records.
   Erasure evidence contains only request/evidence hashes, counts, timestamps,
   and role identifiers—not the erased entity or actor identifiers.
5. Verify zero matching primary rows or correlatable fields with a readback
   query, record the result, and enqueue the corresponding backup purge.

All five steps and their values are **PROPOSED** pending Data Owner approval.

## Proposed backup purge procedure

1. Inventory backup object identifiers, creation times, expiry times, replicas,
   and legal-hold state.
2. Delete eligible backup objects and replicas no later than the proposed
   35-day retention ceiling.
3. When an immutable backup cannot be selectively erased, block it from normal
   restore and allow it to expire. Any approved restore occurs in isolation;
   outstanding erasures are replayed and verified before data can return to
   production.
4. Verify provider deletion/expiry status and record hashed evidence without
   Plane entity IDs or actor identifiers.

All four steps and their values are **PROPOSED** pending Data Owner approval.

## Proposed access roles

| Proposed role                          | Proposed access                                                                         | Status   |
| -------------------------------------- | --------------------------------------------------------------------------------------- | -------- |
| Data Owner                             | Approve the allowlist, purposes, retention, erasure, backup purge, and role assignments | PROPOSED |
| Plane integration service              | Write only allowlisted normalized fields for an already-authorized canonical project    | PROPOSED |
| Scoped board/report service            | Read only rows filtered at retrieval by the canonical `PJ-*` project scope              | PROPOSED |
| Security/Operations retention operator | Run scheduled expiry and backup purge with recorded change authority                    | PROPOSED |
| Erasure maintenance operator           | Time-bound, approved delete/null capability for the stated erasure scope                | PROPOSED |
| Database break-glass operator          | Time-bound emergency access with reason validation and append-only audit evidence       | PROPOSED |
| LLM or agent prompt context            | No access                                                                               | PROPOSED |

## Approval record

The proposal remains unapproved until all boxes have linked, signed evidence:

- [ ] Data Owner identity, approval date, and approval record
- [ ] Webhook event field allowlist
- [ ] Snapshot field allowlist
- [ ] Purpose and prohibited uses
- [ ] Retention periods and legal-hold behavior
- [ ] Primary erasure procedure
- [ ] Backup purge and restore procedure
- [ ] Access roles and retrieval-side project filtering

Any added field, purpose, retention value, or role requires a new Data Owner
approval. A change that alters the ADR-0019 data boundary also requires an ADR
update; an implementation-scope change requires a Plan 014 update.

## Stop conditions

Plane sandbox or production work must stop if:

- the Data Owner has not approved this proposal;
- implementation requires discussion text, a name, an email address, avatar
  data, a raw payload, or any other denied field;
- retrieval-side canonical project filtering cannot be enforced; or
- the approved retention, erasure, or backup purge procedure cannot be
  implemented and verified.
