<!-- 根拠: DEV-T01 / ADR-0029 -->

# Floci dev-only Terraform pre-validation

This directory provides an optional local check for Terraform wiring before a
real AWS development environment exists. It is **development-only**: it is not
a CI gate, acceptance evidence, staging/prod proof, or permission to apply the
module to AWS.

## Pinned emulator

- Floci `1.6.0` (MIT): [release](https://github.com/floci-io/floci/releases/tag/1.6.0),
  [license](https://github.com/floci-io/floci/blob/1.6.0/LICENSE)
- OCI index: `floci/floci:1.6.0@sha256:eab36252ea43a4a73928423f0372219052c5c6f87207f6c4754db14b91d6ed30`
- Endpoint: `http://127.0.0.1:4566`

The digest was resolved from the official Docker Registry manifest for the
`1.6.0` release. Upgrade the version and digest together in one reviewed change.

## Runtime prerequisite

Floci's ECS/RDS emulation requires a Docker-compatible daemon and
`/var/run/docker.sock`. This repository's normal Temporal smoke uses the Apple
`container` CLI, but that CLI does not provide Docker Compose or a Docker socket.
On this development machine the Owner must install and start a separate runtime
such as Colima before using this check. The script never installs or configures
a runtime.

With a Docker runtime available:

```bash
./deploy/aws/floci/validate-temporal.sh
```

The default runs Floci, copies `deploy/aws/temporal/` into a temporary directory,
activates `floci_override.tf.example` only in that copy, and runs Terraform
init/validate/plan. Production `main.tf`, `variables.tf`, state, and provider
behavior are unchanged.

For a bounded API check:

```bash
FLOCI_APPLY=1 ./deploy/aws/floci/validate-temporal.sh
```

This target-applies the task definition, its secret/log dependencies, per-worker
token secrets, and Cloud Map, then inspects them through the AWS CLI and destroys
them. It deliberately does not create the ECS service or RDS and therefore does
not pull or run the synthetic task images. `KEEP_FLOCI=1` keeps only the emulator
container after successful cleanup. If destroy fails, the script retains the
temporary Terraform state and prints its path so cleanup can be retried.

The script rejects ambient profiles, session/role credentials, non-dummy access
keys, service-specific endpoints, and non-loopback base endpoints before Docker
or Terraform runs. `env.example` contains only accepted local dummy values; the
script does not source it or silently overwrite a real identity.

If Docker/Compose/the daemon is absent, or the digest-pinned image cannot be
pulled because the network is unavailable, the command prints an explicit
`SKIP`. Record that skip; do not claim a Floci-backed plan or acceptance result.

## Hard limits

- No CI workflow or acceptance gate consumes this check.
- Floci does not reproduce AWS IAM/SG enforcement, Fargate networking, mTLS,
  Secrets Manager policy, RDS durability, or production quotas/failure modes.
- Floci Bedrock Runtime is a stub. It cannot replace P2-T03, P2-T04, or P2-T10
  real gateway/model verification.
- Docker-backed ECS/RDS fidelity depends on the Owner-managed Docker runtime.
- The existing `deploy/temporal/docker-compose.yml` and Apple-container smoke
  remain the Temporal runtime verification path and are unchanged.
- `deploy/aws/litellm/` may adopt the same isolated pattern later, after that
  module exists; this task adds no speculative LiteLLM Terraform.
