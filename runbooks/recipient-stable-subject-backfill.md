<!-- 根拠: P010-F02-T04 / DEC-SPEC-002 -->

# Recipient stable-subject backfill

## Purpose

Use the signed Data Owner mapping to move legacy `recipients` rows from
`inactive/pending` to an applied Entra stable subject. The command validates the
complete artifact before querying recipients and applies every row in one
transaction.

This task's apply command is sandbox-only. It accepts only a PostgreSQL URL on
`localhost:55432` and requires the exact database name as a separate
confirmation. Do not use it against production.

## Signed artifact

JSON follows `docs/contracts/schema/entra-subject-mapping.schema.json`.
CSV uses RFC 4180 quoting and this exact header:

```text
contract_version,configured_tenant_id,source_repository_id,source_repository_node_id,source_commit_sha,owner_id,owner_role,approved_at,payload_sha256,signature_algorithm,signing_key_id,signature_base64,legacy_record_id,entra_tenant_id,entra_object_id,disposition,reason
```

CSV repeats the contract/environment/approval columns on every entry row; every
copy must be identical. For both formats, the signed payload is UTF-8 JSON with
no trailing newline and keys in this exact order:

```text
contract_version
environment: configured_tenant_id, source_repository_id, source_repository_node_id, source_commit_sha
entries[]: legacy_record_id, entra_tenant_id, entra_object_id, disposition, reason
```

`payload_sha256` is SHA-256 of those canonical bytes. `signature_base64` is an
Ed25519 signature over the same bytes, or a DER-encoded ES256 signature using
SHA-256. The operator supplies the separately trusted public key and expected
`signing_key_id`; a key embedded in the mapping is never trusted.

## Preconditions

1. Run migration `202607180000_recipients_stable_subject.sql`.
2. Obtain the protected tenant, repository numeric ID, repository node ID, and
   exact 40-character source commit SHA from deployment evidence.
3. Confirm the mapping owner, signing key ID, approval time, and reasons.
4. Start the disposable PostgreSQL 16 sandbox on port 55432 and set
   `DATABASE_URL`.

Set reusable command arguments:

```sh
set -- \
  --mapping /reviewed/mapping.json \
  --public-key /reviewed/data-owner-public.pem \
  --signing-key-id owner-key-2026 \
  --tenant-id 11111111-1111-4111-8111-111111111111 \
  --repository-id 123 \
  --repository-node-id R_example \
  --commit-sha 1111111111111111111111111111111111111111
```

## Dry-run

```sh
pnpm --filter @aiops/devops exec tsx src/tools/backfillRecipients.ts dry-run "$@"
```

Record the complete one-line JSON result. It includes the exact raw-file
`digest`, entry/disposition counts, and already-applied count. Dry-run opens a
repeatable-read, read-only transaction and performs no updates.

Any schema, signature, environment, duplicate, foreign-tenant, unresolved, or
inactive error stops the run. Correct the reviewed artifact or environment
evidence; never edit only the digest.

## Apply

Use the same mapping bytes and arguments. Replace the example digest and
database name with the values reviewed from dry-run and `DATABASE_URL`:

```sh
pnpm --filter @aiops/devops exec tsx src/tools/backfillRecipients.ts apply "$@" \
  --dry-run-digest 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
  --confirm-sandbox-database aiops_a015
```

Apply revalidates the signature, environment, database rows, and exact raw-file
digest after taking the transaction lock. It updates only pending rows. Any
error rolls back every update. Reapplying the identical artifact is a successful
no-op with `applied: 0` and all entries counted as `already_applied`.

`migrate_active` reactivates an A014-quarantined pending row. An already-applied
inactive row cannot be changed to `migrate_active`; it fails with
`E-MAPPING-INACTIVE`. `deactivate` and `erase_after_retention` remain inactive;
the latter does not delete data.

## Verification and cleanup

```sql
SELECT user_id, active, entra_tenant_id, entra_object_id,
       backfill_disposition, backfill_state
FROM recipients
ORDER BY user_id;

SELECT count(*) AS active_email_only
FROM recipients
WHERE active = true AND (entra_tenant_id IS NULL OR entra_object_id IS NULL);
```

The second query must return zero. Preserve the redacted artifact digest,
summary, database name, source commit, signer/key ID, and query result as
evidence. Do not preserve email values, private keys, database credentials, or
raw signatures in general logs.

Stop PostgreSQL with `pg_ctl`, remove the complete disposable cluster directory,
and confirm port 55432 returns no response.

## Rollback

Before owner acceptance, restore the disposable database from its pre-apply
checkpoint and rerun dry-run. Do not reverse individual rows by hand: the
mapping is all-or-nothing, and the schema intentionally has no automatic
production rollback path.
