<!-- 根拠: P010-F02-T01 / DEC-SPEC-004 -->

# Data handling contract

Primary operational data and approved backups reside in Japan. Processing
residency and provider retention are separately evidenced ENV gates; a data
location claim alone does not satisfy them. If provider terms, retention, abuse
monitoring, or residency are unknown, the affected LLM path fails closed.

## Classification and retention

| Class                     | Examples                                     | Stores                                              | LLM policy                                                       | Retention                  | Owner                     |
| ------------------------- | -------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------- | -------------------------- | ------------------------- |
| authorization identifiers | tenant/object UUID, active persona/scope     | PostgreSQL and authoritative master                 | prohibited                                                       | active lifetime + 365 days | Data Owner                |
| contact/display PII       | name, email, UPN, Teams address              | authoritative master and active delivery system     | prohibited; role label may replace a person                      | active lifetime + 30 days  | Data Owner                |
| raw intake                | email/Teams text after secret sanitization   | controlled intake store                             | only `sanitizeForLlmInput()` output and minimum necessary fields | 90 days                    | PMO Operator              |
| standard report           | validated narrative and deterministic values | PostgreSQL/report archive                           | narrative slots only                                             | 5 years                    | PMO Operator              |
| investor report           | validated masked investor output             | immutable report archive                            | narrative slots only                                             | 7 years                    | Data Owner                |
| audit                     | stable actor/action/reason/hash              | append-only PostgreSQL and long-term archive        | prohibited                                                       | at least 5 years           | Security/Operations Owner |
| smoke evidence            | hashes, status, duration, request IDs        | verification/evidence store or approved CI artifact | prohibited                                                       | 1 year                     | Operations Owner          |

Longer legal holds override deletion. Shorter deletion requires Data Owner and
legal approval. Retention expiry authorizes a controlled deletion workflow; it
does not authorize runtime mutation of `prjops-data`.

## Mandatory controls

1. External text is sanitized before database storage with
   `sanitizeSecrets()`.
2. The smallest necessary narrative input is sanitized again immediately before
   an LLM call with `sanitizeForLlmInput()`.
3. Logs, PR comments, notifications, and evidence are sanitized before output.
4. Authorization identifiers, contact/display PII, raw secrets, access tokens,
   request/response bodies, personal email/name, and replay nonces are never
   placed in committed evidence.
5. Audit records are append-only and include stable actor, action, reason where
   required, and content hash. Application roles receive no audit UPDATE/DELETE.
6. Report and API data is scope-filtered during retrieval. Active recipients are
   reread at each delivery.

## Field disposition

| Field family              | Update                                         | Logical delete                              | Physical delete                                        |
| ------------------------- | ---------------------------------------------- | ------------------------------------------- | ------------------------------------------------------ |
| stable subject            | owner-reviewed migration only                  | deactivate subject and assignments          | after active + 365 days or approved erasure gate       |
| display/contact           | reviewed master change                         | clear active delivery use and mark inactive | after active + 30 days                                 |
| project/assignment master | reviewed `prjops-data` pull request            | `active: false` plus reason/time            | after applicable retention and approved erasure        |
| raw intake                | append sanitized record; no silent replacement | mark expired by retention job               | at 90 days unless legal hold                           |
| report                    | append new immutable version                   | not rewritten                               | 5 or 7 years by report class                           |
| audit                     | append only                                    | forbidden                                   | controlled archival/deletion only after policy minimum |
| smoke evidence            | append immutable run evidence                  | not rewritten                               | 1 year                                                 |

## Evidence classes

Owner/signature evidence and ENV evidence are distinct:

- **Owner/signature:** policy approval, mapping payload digest/signature,
  retention exception, erasure authorization.
- **ENV:** repository/tenant IDs, immutable SHA, regional endpoint, provider
  retention/residency readback, runtime identity.

Neither class may stand in for the other. Fixtures use explicit `environment` and
`owner_approval` objects so automated validators can reject conflation.
