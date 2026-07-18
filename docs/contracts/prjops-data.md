<!-- 根拠: P010-F02-T01 / DEC-SPEC-001 -->

# prjops-data machine contract

This document fixes the repository, file, lifecycle, and checksum contract for the
authoritative PrjOps snapshot. Normative words (`MUST`, `MUST NOT`, `SHALL`) are
requirements. The machine schema is
[`schema/prjops-data.schema.json`](schema/prjops-data.schema.json), executable
contract cases are
[`fixtures/prjops-data-contract-cases.json`](fixtures/prjops-data-contract-cases.json),
and checksum vectors are
[`fixtures/checksum-golden-vectors.json`](fixtures/checksum-golden-vectors.json).

## Source and publication

| Property            | Contract                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Repository          | Private repository logically named `prjops-data`; it is separate from this application repository                 |
| Default branch      | `main`                                                                                                            |
| Production identity | Exact repository owner, name, stable numeric repository ID, node ID, and immutable lowercase 40-hex commit SHA    |
| Runtime access      | Read-only GitHub App installation; no contents write, issue, pull-request, workflow, or administration permission |
| Authoring           | Data Owner controls schema and retention; PMO Operator edits records only through a reviewed pull request         |
| Runtime mutation    | Forbidden                                                                                                         |
| Rollback            | Change the protected environment's accepted immutable commit SHA to a previously accepted snapshot                |
| Partial snapshot    | Forbidden; validation and publication are all-or-nothing                                                          |

Repository URL, repository identity, installation identity, and accepted commit
SHA are deployment ENV values. They are not fields in an authoritative data
record and MUST NOT be copied into fixtures as production-looking values.

## Paths and document schemas

All paths are repository-relative and use `/`. Every path and filename is ASCII.
No absolute path, empty segment, `.`, `..`, backslash, control character, or
unlisted path is accepted.

| Path                                               | Document schema                  | Identity / uniqueness                                                                |
| -------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| `schema/version.yaml`                              | `#/$defs/version`                | exactly one                                                                          |
| `organizations/ORG-[0-9]+.yaml`                    | `#/$defs/organization`           | `id` equals filename; unique `id`                                                    |
| `projects/PJ-[0-9]+.yaml`                          | `#/$defs/project`                | `id` equals filename; unique `id`                                                    |
| `stakeholders/ST-[0-9]+.yaml`                      | `#/$defs/stakeholder`            | `id` equals filename; unique `id`, stable subject, email, and Teams ID where present |
| `issues/ISSUE-[0-9]+.yaml`                         | `#/$defs/issue`                  | `id` equals filename; unique `id`                                                    |
| `actions/ACT-[0-9]+.yaml`                          | `#/$defs/action`                 | `id` equals filename; unique `id`                                                    |
| `status_updates/SU-[A-Za-z0-9-]+.yaml`             | `#/$defs/statusUpdate`           | `id` equals filename; unique `id`                                                    |
| `report_jobs/RPT-[A-Za-z0-9-]+.yaml`               | `#/$defs/reportJob`              | `id` equals filename; unique `id`                                                    |
| `seven_keys/questionnaires/SKQ-[A-Za-z0-9-]+.yaml` | `#/$defs/sevenKeysQuestionnaire` | `id` equals filename; unique `id`; unique `(project_id, month)`                      |
| `seven_keys/snapshots/SKS-[A-Za-z0-9-]+.yaml`      | `#/$defs/sevenKeysSnapshot`      | `id` equals filename; unique `id`; unique `(project_id, month)`                      |
| `investor/financial_inputs.yaml`                   | `#/$defs/financialInputs`        | singleton; unique project IDs                                                        |
| `investor/board_pack.yaml`                         | `#/$defs/boardPack`              | singleton; unique project IDs per history snapshot                                   |

The schema rejects unknown fields. Duplicate YAML mapping keys, aliases, and
merge keys are forbidden; each document MUST decode to exactly one mapping. IDs are case-sensitive.
References MUST resolve inside the same accepted snapshot. A missing required
collection, dangling reference, duplicate ID, duplicate stable subject, duplicate
assignment, filename/ID mismatch, or ownership total outside `0..100` rejects the
entire snapshot.

## Record lifecycle

Mutable master and operating records include `active`, `created_at`,
`updated_at`, and `updated_by`. Active records have null
`deactivated_at`/`deactivation_reason`; logically deleted records set
`active: false` and supply both fields. Physical deletion requires the applicable
retention period to have elapsed and a separately approved erasure request.
Runtime code never writes these files. Every update, deactivation, and approved
physical deletion is a reviewed PMO Operator pull request.

`seven_keys/snapshots` and delivered `report_jobs` are historical records; a new
record supersedes information without rewriting prior accepted history.

## Version file

`schema/version.yaml` contains exactly:

| Field            | Type            | Contract                                            |
| ---------------- | --------------- | --------------------------------------------------- |
| `schema_version` | string          | initial value `1.0.0`; semantic version             |
| `generated_at`   | RFC 3339 string | snapshot build time                                 |
| `content_sha256` | string          | lowercase SHA-256 of canonical manifest bytes below |

An unsupported schema version fails closed. `schema/version.yaml` is excluded
from the content manifest so its checksum field cannot be self-referential.

## Canonical manifest bytes

The following algorithm is language-independent. It operates on bytes before
YAML parsing.

1. Enumerate every repository entry except `schema/version.yaml`. Reject a
   symlink, submodule, device, socket, FIFO, directory where a file is expected,
   or other non-regular entry with `E-SNAPSHOT-NONREGULAR` (a symlink uses
   `E-SNAPSHOT-SYMLINK`). Reject an unlisted path with
   `E-SNAPSHOT-UNKNOWN-PATH`.
2. For every regular file, read its exact bytes once without following links.
   Reject invalid UTF-8 (`E-SNAPSHOT-UTF8`), a leading UTF-8 BOM
   (`E-SNAPSHOT-BOM`), any CR byte (`E-SNAPSHOT-NEWLINE`), text not normalized
   to Unicode NFC (`E-SNAPSHOT-NFC`), or non-empty content that does not end in
   exactly one LF byte (`E-SNAPSHOT-NEWLINE`). A zero-byte file is accepted by
   the checksum layer and is subsequently rejected by schema validation.
3. Compute lowercase `SHA-256(fileBytes)` and the byte length. Create an entry
   with exact key order and no extra keys:
   `{"path":"<path>","sha256":"<64 lowercase hex>","size":<base-10 integer>}`.
4. Sort entries by unsigned bytewise comparison of their ASCII path bytes.
   Locale, case folding, natural-number order, filesystem order, and Unicode
   collation MUST NOT be used.
5. Concatenate exact UTF-8 bytes with no insignificant whitespace:
   `{"files":[` + entries joined by `,` + `]}` + one final LF.
6. `content_sha256` is lowercase `SHA-256(canonicalManifestBytes)`. It MUST
   equal `schema/version.yaml#content_sha256`; otherwise reject with
   `E-SNAPSHOT-CHECKSUM`.

No JSON library's default property ordering or pretty-print behavior is part of
this contract. The literal key order and punctuation above are normative.

## Failure codes

| Code                           | Condition                                                                               |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `E-SNAPSHOT-SYMLINK`           | any symlink                                                                             |
| `E-SNAPSHOT-NONREGULAR`        | any other non-regular entry                                                             |
| `E-SNAPSHOT-UNKNOWN-PATH`      | path outside the table                                                                  |
| `E-SNAPSHOT-UTF8`              | invalid UTF-8                                                                           |
| `E-SNAPSHOT-BOM`               | UTF-8 BOM                                                                               |
| `E-SNAPSHOT-NEWLINE`           | CR/CRLF, missing final LF, or more than one final LF                                    |
| `E-SNAPSHOT-NFC`               | decoded text differs from its NFC normalization                                         |
| `E-SNAPSHOT-SCHEMA`            | YAML shape/type/required-field violation                                                |
| `E-SNAPSHOT-UNKNOWN-FIELD`     | field absent from the selected strict schema                                            |
| `E-SNAPSHOT-FILENAME-ID`       | filename identity differs from document identity                                        |
| `E-SNAPSHOT-DUPLICATE-ID`      | duplicate record or composite identity                                                  |
| `E-SNAPSHOT-DUPLICATE-MAPPING` | duplicate stable subject, display mapping, or assignment                                |
| `E-SNAPSHOT-REFERENCE`         | unresolved or invalid cross-reference                                                   |
| `E-SNAPSHOT-OWNERSHIP`         | any ownership percentage is outside `0..100`                                            |
| `E-SNAPSHOT-PARTIAL`           | required singleton/collection is absent or validation attempted publication of a subset |
| `E-SNAPSHOT-CHECKSUM`          | canonical manifest digest differs from `content_sha256`                                 |

When multiple conditions exist, validators return the first code in the table
above and publish nothing. The contract-case fixture fixes representative
positive and negative oracles; golden values can be independently recomputed
with the byte algorithm in this section.
