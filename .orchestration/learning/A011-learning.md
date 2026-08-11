# A011 Learning

## Validated Learnings

- Entra tenant/object IDs should validate the exact lowercase canonical UUID
  shape required by DEC-SPEC-002 without assuming RFC version/variant bits that
  the decision does not specify.
- Owner approval evidence needs explicit signature bytes and signing-key
  identity in a strict object separate from protected ENV repository/tenant
  values; a signature reference alone is not a self-contained machine contract.
- A zero-byte regular file is a useful layer-boundary vector: checksum
  canonicalization can succeed deterministically while document schema
  validation subsequently fails.

## Application

- Applied to the stable-subject schemas, owner/signature fixture, checksum
  contract, and golden vectors in this task.
- Worklog learn update was not performed because A011 forbids worklog edits.
