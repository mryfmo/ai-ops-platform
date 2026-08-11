<!-- 根拠: ENV-DEC-001 / ADR-0029 / FinalArch:GOV-003 -->

# P0-T07a Learning

## Validated learning

- A cloud-baseline supersession needs both a canonical mapping table and an
  explicit exception boundary. Here Entra survives only for M365 access; it
  does not remain as AWS workload identity.
- A checksum manifest can be stale even when the checked file is correct.
  Recompute the manifest entry before changing the checked document; the
  BASELINE.md mismatch required no body edit.
- A self-host Temporal decision is operationally complete only when WBS,
  credential ownership, dev topology, IaC, mTLS scope, and startup evidence
  name the same deployment profile.

## Apply to

- P3-T01 implementation and validation.
- P0-T10 canonical closure.
- Future cloud-baseline replacement ADRs and pack imports.
