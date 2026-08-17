# P7-T05 Approval Cards + Temporal Signal Report

## Outcome

Implemented versioned Teams Adaptive Card approval actions and the server-side decision boundary. The route verifies signed Entra identity, current project authorization, a signed identity-bound correlation, and the self-approval prohibition before performing one pending/version/unexpired database CAS. Only the winning CAS result is forwarded through the injected P3-T03-compatible Temporal signal port.

## Card Contract

- `buildApprovalCard` emits Adaptive Card 1.5 with explicit approve/reject actions.
- Each action carries `approvalId`, positive integer `version`, `decision`, and a signed `v1.<sha256>` correlation value.
- UUID, version, correlation, title, and summary inputs are validated at the pure channel boundary.
- No business state is stored in the card or channel package.

## Authorization and Ordering

1. Require an injected signal port; otherwise decision writes fail closed before parsing or database mutation.
2. Verify signed Entra identity and per-request recipients/project authorization.
3. Parse and validate the action, approval ID, version, decision, and reason.
4. Verify the HMAC correlation bound to approval ID, version, tenant, and subject.
5. Reject a decider matching `requested_by` (object ID or canonical Entra principal).
6. Execute one database CAS constrained by pending status, expected version, and unexpired deadline.
7. Confirm that the returned authority receipt still matches ID, version, and requested decision.
8. Signal the injected P3-T03 port with the exact approval ID, version, decision, sanitized reason, and decider.

Unauthorized, stale, expired, replayed/double-clicked, self-approved, and authority-mismatched attempts do not emit a signal. Signal failure after a successful CAS returns a fail-closed 503 and writes an audit event; the database remains the decision authority.

## Scope

- Evolved the existing `approvalsRepo` and existing P1 columns; no schema or dependency change was needed.
- Reused existing signed-identity, recipient authorization, sanitization, audit, and repository patterns.
- Did not reimplement P3-T03 state transitions or add automatic approval.
- `ApprovalRoutesDeps.signalApprovalDecision` is the approved composition seam. `packages/server/src/index.ts` is outside this task's scope, so production decision writes remain disabled until the real Temporal adapter is injected there in a separately approved composition change. The route test proves that the injected path is reached only after the CAS.

## Deferred Gate

Real Teams tenant card-submit and Temporal worker E2E remain deferred until tenant/runtime access is available. The deterministic card, HTTP, database, and injected-signal contracts are covered locally.

## Handoff

- Branch: `agent/P7-T05-approval-cards`
- Orchestrator owns push and PR creation after `AGMSG-RESULT`.
