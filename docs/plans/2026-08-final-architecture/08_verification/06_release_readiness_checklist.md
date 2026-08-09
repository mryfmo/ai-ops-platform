# Release Readiness Checklist

## Governance

- [ ] baseline/ADR/spec/AC/Owner decisions approved
- [ ] branch protection and CODEOWNERS effective
- [ ] legal/security/license/DPA reviews complete
- [ ] feature flags and kill switches owned

## Build and supply chain

- [ ] exact pins and lockfile
- [ ] GitHub Actions SHA pinned
- [ ] image digest/SBOM/provenance/signature
- [ ] high/critical vulnerabilities resolved or approved
- [ ] secret scan clean

## Functional/contract

- [ ] OpenAPI/AsyncAPI/schema/registry validation
- [ ] `mise run ci` green
- [ ] Temporal replay green
- [ ] OPA/gateway conformance green
- [ ] all blocking acceptance gates green

## Security

- [ ] OBO/issuer/audience/tenant tests
- [ ] prompt injection suite
- [ ] high-risk MCP tools absent
- [ ] runner branch/secret negative tests
- [ ] data classification/provider routing tests
- [ ] audit append-only tests

## Operations

- [ ] SLO/alerts/on-call assigned
- [ ] dashboards and correlation query
- [ ] backup/restore and DR drill
- [ ] canary/rollback rehearsal
- [ ] cost budgets/quotas/alerts
- [ ] runbook handover

## External real-environment

- [ ] Work IQ tenant E2E
- [ ] Graph notifications/delta/formal write E2E
- [ ] Bedrock/Anthropic/LiteLLM E2E
- [ ] Plane/GitHub/Confluence/Wispr E2E
- [ ] Teams desktop/browser/mobile E2E
- [ ] Claude/Droid test-repository PR E2E

## Go/No-Go

Any unchecked blocking item is No-Go. `ENV-blocked` is not equivalent to pass. The release board records approver, version/digest, evidence links, residual risk and rollback owner.
