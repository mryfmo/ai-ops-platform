# DEV-T01 validation

## Local Floci path

- `./deploy/aws/floci/validate-temporal.sh` → exit 0 with explicit `SKIP`: Docker with
  Compose is unavailable and Apple `container` is not a Docker socket runtime.
- No Floci-backed apply/smoke result is claimed.

## Credential boundary

All cases stopped before the Docker check and printed only the rejected variable name:

- `AWS_PROFILE=production` → exit 1
- service-specific `AWS_ENDPOINT_URL_*` → exit 1
- non-dummy `AWS_ACCESS_KEY_ID` → exit 1
- non-loopback `FLOCI_ENDPOINT` → exit 1 without echoing its value

## Static module checks

- `bash -n deploy/aws/floci/validate-temporal.sh` → pass
- `shellcheck deploy/aws/floci/validate-temporal.sh` → pass
- ephemeral copy + `floci_override.tf.example` renamed to `.tf`:
  - `terraform init -backend=false -input=false` → pass, AWS provider 5.100.0 from lock
  - `terraform fmt -check -diff` → pass
  - `terraform validate` → pass
  - dummy credential + `AWS_ENDPOINT_URL=http://127.0.0.1:4566` +
    `terraform plan -refresh=false` → pass: 20 add / 0 change / 0 destroy

## Repository gates

- fresh disposable PostgreSQL databases + `mise run ci` → exit 0
  - governance, policy, contracts, audit, actionlint, lint, traceability, format,
    build, typecheck, coverage, and DB integration all passed
- official checksum-verified gitleaks 8.30.1 directory scans of every DEV-T01
  implementation/evidence path → no leaks found
- the full local all-ref scan additionally found two pre-existing false-positive fixtures
  in a deleted remote branch; current-path scans are clean and the authoritative PR
  full-history job remains required before acceptance.

## Independent review

- `codex review --commit b6c3760` → 3 actionable findings:
  - P1 invalid jq string escaping
  - P2 cleanup armed only after targeted apply
  - P2 `AWS_DEFAULT_PROFILE` guard omission
- all three were fixed and revalidated before push:
  - mocked Docker/Terraform default path → plan summary + `FLOCI PASS`
  - mocked targeted apply exit 42 with `KEEP_FLOCI=1` → cleanup invoked destroy and
    preserved exit 42
  - `AWS_DEFAULT_PROFILE=production` → rejected before Docker
