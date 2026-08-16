# P10-T01 Learning Triage

Date: 2026-08-16

## Candidate

[memory:failure] An empty checked-in S3 backend block still makes local plan
depend on initialized backend metadata even when validation initially used
`init -backend=false`. Keep backend activation as an example copied only into an
ephemeral deployment checkout; keep the validation composition root backend-free.

[memory:decision] Terraform `for_each` keys must be known at plan time. When a
value is produced by another module, pass it in a map with a stable caller-owned
key instead of converting unknown values to a set.

## Disposition

- Reusable and validated for future Terraform composition work.
- Kept as task-local learning only; no direct promotion or skill mutation was
  authorized by P10-T01.
