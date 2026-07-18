<!-- 根拠: P010-F02-T01 / DEC-SPEC-002 -->

# Entra stable-subject mapping contract

Authorization identity is the tuple `(entra_tenant_id, entra_object_id)`, taken
only from validated Entra `tid` and `oid` claims. Both values are canonical
lowercase UUID strings. Email, UPN, display name, Teams address, and provider
subject are display/delivery attributes only and never authorization keys.

The machine schema is
[`schema/entra-subject-mapping.schema.json`](schema/entra-subject-mapping.schema.json).
Migration cases are included in
[`fixtures/identity-contract-cases.json`](fixtures/identity-contract-cases.json).

## Runtime decision

1. Missing or malformed `tid`/`oid` returns `401 E-AUTH01`.
2. A `tid` different from the protected environment's configured tenant returns
   `403 E-AUTH02` before any project/domain data fetch.
3. The data query matches exact tenant ID, exact object ID, `active: true`,
   active persona assignment, and project/domain scope. Fetch-all then filter is
   forbidden.
4. No active exact match returns `403 E-AUTH02`.

The active subject and assignment are reread for every request and delivery.
There is no authorization cache.

## Legacy migration artifact

The migration input is a signed, owner-reviewed JSON artifact matching the
schema. It contains three deliberately separate sections:

| Section          | Trust class            | Supplied by                                 |
| ---------------- | ---------------------- | ------------------------------------------- |
| `environment`    | ENV values             | protected deployment evidence               |
| `owner_approval` | owner/signature fields | Data Owner approval evidence                |
| `entries`        | migration disposition  | PMO Operator mapping reviewed by Data Owner |

`environment` values identify the target tenant and immutable source snapshot.
`owner_approval` identifies the signer, algorithm, signing key, payload digest,
signature bytes, and approval time; it MUST NOT contain tenant/repository configuration
values. `entries` MUST NOT contain signatures or ENV repository configuration.

Each entry has the exact fields below:

| Field              | Type               | Contract                                                   |
| ------------------ | ------------------ | ---------------------------------------------------------- |
| `legacy_record_id` | `ST-[0-9]+` string | old authoritative stakeholder ID                           |
| `entra_tenant_id`  | lowercase UUID     | exact target tenant                                        |
| `entra_object_id`  | lowercase UUID     | exact stable object                                        |
| `disposition`      | enum               | `migrate_active`, `deactivate`, or `erase_after_retention` |
| `reason`           | non-empty string   | owner-reviewed reason                                      |

`migrate_active` requires an active exact tenant/object target.
`deactivate` produces an inactive record with deactivation metadata.
`erase_after_retention` is not an immediate delete instruction: it records the
approved future disposition and remains inactive until the retention gate passes.

Before any write, the complete artifact is validated and a dry-run digest is
computed. Duplicate legacy IDs, duplicate stable subjects, unresolved entries,
foreign-tenant entries, inactive `migrate_active` targets, signature/digest
mismatch, or changed input aborts the whole migration. There is no partial apply
and no email-only active fallback.

## Migration failure codes

| Code                          | Condition                                                         |
| ----------------------------- | ----------------------------------------------------------------- |
| `E-MAPPING-SCHEMA`            | malformed or unknown field                                        |
| `E-MAPPING-SIGNATURE`         | absent/invalid approval or payload digest/signature mismatch      |
| `E-MAPPING-ENV`               | environment identity is absent or differs from protected evidence |
| `E-MAPPING-DUPLICATE-LEGACY`  | repeated `legacy_record_id`                                       |
| `E-MAPPING-DUPLICATE-SUBJECT` | repeated `(tenant_id, object_id)`                                 |
| `E-MAPPING-FOREIGN-TENANT`    | entry tenant differs from configured tenant                       |
| `E-MAPPING-UNRESOLVED`        | no unique active target for `migrate_active`                      |
| `E-MAPPING-INACTIVE`          | `migrate_active` target is inactive                               |
| `E-MAPPING-DIGEST`            | apply input differs from the accepted dry-run bytes               |

Validators use this table order for the first returned code and make zero writes
on every failure.
