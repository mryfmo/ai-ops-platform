# P1-T04 report

- Task: `P1-T04`
- Status: ready for review
- Base: `origin/main@d8a049fd5934761103f17d122ec74b652b03e2f4`
- Branch: `agent/P1-T04-versioned-contracts`
- Head: `baed71ac4e3f33ef6c8289ad6e76c49570318cde`
- PR: `https://github.com/mryfmo/ai-ops-platform/pull/175`
- PR author: `app/aiops-pr-bot`
- PR checks: `build-test`, `gitleaks`, and `CodeRabbit` green at the exact head

## Delivered

- Added versioned OpenAPI, AsyncAPI, domain, policy-input, and policy-decision contracts under `contracts/`.
- Preserved the architecture-pack canonicals unchanged and recorded their source paths and SHA-256 hashes in `contracts/provenance.json`.
- Added immutable v1 compatibility baselines and a machine checker for syntax, internal references, provenance drift, runtime parity, and breaking changes.
- Matched the seven `WORKFLOW_KINDS` and numeric `VersionedPayload.schemaVersion = 1` from `@aiops/control-plane`.
- Closed nested policy objects to unknown fields as required by `FinalArch:CON-004`.
- Added a contributor README and ten focused positive/negative tests, including Draft 2020-12 compilation, N/N-1 event compatibility, and generated-client smoke.

## Scope

- Product changes: `contracts/**` only.
- Canonical pack files: unchanged.
- Dependencies: one new contract-local linter, `@stoplight/spectral-cli@6.16.3`; the isolated package also declares the repository's existing `yaml@2.9.0`. No runtime dependency added.
- Merge: not performed.
