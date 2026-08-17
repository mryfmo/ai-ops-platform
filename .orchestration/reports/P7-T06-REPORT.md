# P7-T06 CopilotKit Intelligence Security Gate Report

## Outcome

Selected the Microsoft-native self-managed Teams adapter fallback for Phase 1. CopilotKit Cloud / Enterprise Intelligence remains disabled: the current repository sends no data to CopilotKit, and the required DPA/order, subprocessors, residency, retention/deletion, license boundary, and M365 tenant-binding evidence is not available.

The binding decision is Proposed. Only Owner merge of the decision PR makes ENV-DEC-002 Accepted.

## Current Data Flow

- `packages/channel-teams` normalizes Teams input and constructs an identity-bound `AgUiRunRequest`; `AgUiClient` has no implementation or network wiring.
- Attachment handling is reference-only: platform ID, name, and content type. No bytes, base64, URL fetch, or model upload is implemented.
- Existing Graph ingestion sanitizes before PostgreSQL, before LLM/agent input, and before Teams output.
- Existing Web chat sanitizes messages/context and sends only through the same-origin/path-guarded LiteLLM gateway. It is not a CopilotKit path.
- Workbench acquisition is signed identity → active recipient → SQL scope/grant → OPA → strict reference model. UI checks are defense in depth only.

## Gate Result

- Managed CopilotKit third-party processing: denied for Phase 1.
- Self-managed Microsoft Teams adapter consuming the existing Control API/AG-UI boundary: selected.
- Hosted persistence, inspector, CopilotKit key, multimodal upload, and vendor-project authorization: prohibited.
- Future fallback transport must preserve tenant/subject/thread/workflow identity and connect all three sanitizer boundaries before egress.

## Evidence

- Assessment: `docs/security/2026-08-17-copilotkit-intelligence-assessment.md`
- Proposed decision: `docs/decisions/2026-08-17-p7-t06-copilotkit-gate.md`
- UX-003/UX-005 inspection: `verification/P7-T06-copilotkit-security-gate.md`
- Vendor evidence is limited to official CopilotKit documentation, Terms, and Privacy Policy linked from the assessment.

## Scope

This is docs-only. No implementation, dependency, lockfile, credential, endpoint, production configuration, real tenant, vendor account, or PR #264 path was changed.

## Handoff

- Branch: `agent/P7-T06-copilotkit-security-gate`
- Orchestrator owns push and non-draft PR creation after `AGMSG-RESULT`.
- cost: n/a

[memory:decision] For Phase 1 Teams/Workbench, prefer the existing self-managed identity-bound adapter and server-side grant/OPA authority. A hosted conversation-intelligence layer is denied until its exact license, DPA, subprocessors, residency, retention/deletion, attachment/model data flow, and tenant-binding negatives are reviewed and Owner-approved.
