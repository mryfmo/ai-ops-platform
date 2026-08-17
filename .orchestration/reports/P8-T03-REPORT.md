# P8-T03 Scoped Runner Credentials Report

## Outcome

Implemented the signed GOV-003 credential lifecycle amendment for coding-task runners.
The control-plane activity now issues and revokes bounded LiteLLM virtual keys and
single-repository GitHub App installation tokens through injected clients. The workflow
uses GitHub OIDC with a dedicated audience, gives the LiteLLM token only to the agent,
mints the GitHub token only after the agent finishes, and exposes that token only to the
push and PR steps.

## Security Boundaries

- LiteLLM issuance requires one model alias, a positive budget, and a finite duration;
  the response model, budget, and expiry must match before the token is returned.
- GitHub issuance requests one repository and only `contents`, `pull_requests`, and
  `issues` write permissions. `issues` is required by the existing `ai-generated` label.
- The issuer checks GitHub's OIDC issuer, configured audience, repository, subject, and
  expiry before provider I/O, then requires the exact `agent/<taskId>` branch.
- Root LiteLLM and GitHub App credentials remain inside injected issuer providers. The
  workflow contains no master key, provider key, App private key, or long-lived PAT input.
- A lease ID, not a root credential, identifies cleanup. Provider cleanup failures remain
  visible and retryable; an invalid/expired issued credential is revoked before rejection.
- Both workflow cleanup steps use `always()` and a failed cleanup fails the job before the
  failure callback.

## Scope Decisions

- No `deploy/litellm/**` change was needed: the existing reviewed route allowlist already
  permits the `/key` management prefix, and production endpoint configuration is deferred
  to the approved environment gate.
- No server endpoint was invented outside the signed allowed paths. This change provides
  the injectable issuer activity and workflow contract; live issuer/LiteLLM/GitHub App E2E
  remains the stated environment-gated follow-up.
- `AIOPS_PR_TOKEN` is no longer consumed by `coding-task.yml`; final repository-secret
  deletion remains P10-T10 ownership.

## Delivery

- Branch: `agent/P8-T03-scoped-runner-credentials`
- Base: main `6dc35ba246cce46e818956473cb686dd9a3282f9`
- Dependencies added: none
- Production configuration changed: none
- cost: n/a
