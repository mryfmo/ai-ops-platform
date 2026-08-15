# P5-T07 M365 Data Routing Policy

## Outcome

Implemented the WIQ-004 output-egress checkpoint that evaluates Work IQ output before external LLM dispatch. Restricted output is denied by Rego and independently blocked in the control-plane even if a policy response is accidentally `allow`.

## Policy Matrix

| Effective classification | Bedrock | Anthropic direct | Obligations |
| --- | --- | --- | --- |
| restricted | deny | deny | `allowedProvider=none` |
| customer-confidential | allow | deny | summary required, redact conversation/permission/source metadata, 4 KiB maximum |
| confidential | allow | deny | redact permission/source metadata, 8 KiB maximum |
| internal/public | allow | deny by default | redact permission/source metadata; Anthropic requires explicit policy data and remains limited to these classes |

Unknown classifications and provider `none` remain default-denied. Policy bundle/client/deployment/smoke revision is `0.2.0`.

## Control-plane Boundary

- Constructs the existing `PolicyInput` from trusted actor/project, purpose, provider candidate, requested fields, source systems, and provenance state.
- Escalates `provenanceComplete=false` to at least `customer-confidential`; Rego independently rejects an incomplete-provenance label paired with a lower classification.
- Calls the existing `OpaDecisionClient` contract before dispatch. Missing, deny, approval, malformed, or transport-failed decisions never reach the injected LLM boundary.
- Deterministically selects only requested fields, removes required redactions recursively, sanitizes retained values at the LLM boundary, requires summarized customer-confidential output, and enforces both the policy byte bound and a 16 KiB absolute ceiling.
- Dispatch receives only `{ provider, content }`; blocked results contain a fixed metadata-only E-code.

## Scope

No external dependency, credential, real Work IQ response, model invocation, policy default weakening, or production enablement was introduced. Dependency changes are approved control-plane workspace links to existing `@aiops/policy` and `@aiops/shared` packages; OPA deploy changes are version strings only and `posture.enabled` remains `false`.
