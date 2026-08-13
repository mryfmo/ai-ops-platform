# DEV-T01 report — Floci dev-only Terraform pre-validation

- writer: codex-deep-dot / branch `agent/DEV-T01-floci-prevalidation`
- base: `origin/main` at `d7076c6d91d0452c679240444d366f375716db72`
- scope:
  - exact-pinned Floci `1.6.0` compose definition and local dummy environment example
  - ambient AWS identity/endpoint guard followed by start → init/validate/plan
  - opt-in bounded task-definition/secrets/Cloud Map apply → AWS CLI smoke → destroy
  - production Temporal Terraform is unchanged; its provider override is inert as
    `floci_override.tf.example` and is activated only in an ephemeral copy
  - ENV-DEC-002 records that this is optional dev-only evidence, never a CI or
    acceptance gate
- runtime result: this Apple-container development machine has no Docker CLI/socket,
  so the Floci-backed run correctly returned explicit `SKIP`. No runtime was installed.
- static result: the same ephemeral module shape initialized, validated, and planned
  20 creates / 0 changes / 0 destroys with dummy credentials and a loopback endpoint.
