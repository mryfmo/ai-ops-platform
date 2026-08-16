# P10-T04 Learning Triage

Date: 2026-08-17

## Candidates

[memory:failure] A child Terraform module that owns a resource through a required
aliased provider cannot pass this repository's standalone module validation
without an injected alias. Keep region-specific composition resources at the
root and inject their ARN into the reusable child module.

[memory:decision] AWS Backup accepts RDS recovery-point expiry but ignores cold
storage transition for RDS. Express five-year LTR with `delete_after = 1825` and
omit a misleading cold-tier transition; configure the DR copy independently.

## Disposition

- Both candidates were reproduced and validated in the P10-T04 Terraform harness.
- They are reusable for future multi-region Terraform and AWS Backup work.
- No skill mutation or promotion was authorized; the task artifacts and Codex
  learn index carry the decision forward.
