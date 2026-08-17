<!-- 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-004 / FinalArch:FR-UI-005 / FinalArch:FR-UI-006 / ADR-0025 / UX-003 / UX-005 -->

# P7-T06 CopilotKit security gate verification

## Inspection point

- Branch base: `6dc35ba246cce46e818956473cb686dd9a3282f9`
- Date: 2026-08-17
- Environment: CI/static inspection only; no real tenant, credential, endpoint, vendor account, upload, or message.
- Decision under review: Microsoft-native self-managed Teams adapter fallback; status remains Proposed until Owner merge.

## Runtime and egress inventory

| Check                               | Evidence                                                                                  | Result                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| CopilotKit dependency/import/config | root/package manifests, `pnpm-lock.yaml`, `packages/*/src/**`                             | No runtime package, import, endpoint, credential, or route               |
| AG-UI transport                     | `packages/channel-teams/src/lib/channel.ts` (`AgUiClient`) and repository callers         | Interface only; no network implementation or composition root            |
| Teams attachment                    | `packages/channel-teams/src/adapters/teams.ts` (`parseAttachments`)                       | ID/name/content-type only; no content fetch/upload                       |
| Web model egress                    | `packages/web/src/server/chat/chatHandler.ts`; `packages/web/src/server/chat/provider.ts` | Pre-LLM sanitize; same LiteLLM origin/path only; unrelated to CopilotKit |
| Graph content path                  | `packages/server/src/agents/teamsConversationAgent.ts`                                    | DB-before, LLM-before, output-before sanitize boundaries present         |

## UX-003: Workbench capabilities are resource-scoped

Required evidence is a cross-project negative in CI.

- `packages/server/tests/workbenchPg.test.ts`: `rejects cross-project run/action links and non-HTTPS source references` and `keeps a granted cross-project workspace and all nested references invisible` exercise the real PostgreSQL projection.
- `packages/server/tests/workbench.test.ts`: SQL applies project scope and active capability grants before projection; revoked/expired/out-of-scope grants fail closed.
- `packages/web/tests/gadgetViewSpec.test.tsx`: wrong workspace/resource/workflow/source references throw `E-GADGET-SCOPE` and all renderers perform zero network calls.
- `packages/server/src/db/workbenchRepo.ts`: `findByIdFor()` joins active grants in SQL and omits raw source/workflow/action payloads.

Inspection disposition: **evidence present**. CopilotKit is not part of this authority chain; selecting the fallback preserves it.

## UX-005: UI does not enforce authorization alone

Required evidence is a direct API negative in CI.

- `packages/server/tests/workbench.test.ts`: direct route calls return 401 for invalid/missing signed identity and the same 404 for missing/out-of-scope; OPA deny, unavailable OPA, unwired OPA, recipient deactivation, and grant revoke all fail closed.
- `packages/server/src/http/routes/workbench.ts`: verifies the signed tenant/object identity, resolves the active recipient on every request, calls the SQL-scoped repository, then requires OPA allow before returning data.
- `packages/web/tests/workbench.test.ts`: the Web BFF signs from the authenticated session subject, blocks unauthenticated/disabled/invalid input before fetch, and rejects malformed/extra grant state.
- `packages/web/src/components/workbench/GadgetView.tsx`: UI scope checks consume an already authorized projection and are explicitly defense in depth; they are not the primary authorization control.

Inspection disposition: **evidence present**. No vendor-side project or UI state is treated as authorization.

## Docs-only acceptance commands

P7-T06 changes documentation/evidence only. The task-defined acceptance commands are:

```text
mise run format
mise run traceability
```

Their final passing results are recorded in `.orchestration/validation/P7-T06-VALIDATION.md`.

## Deferred evidence

- Real Teams mention/follow-up and P7-T09 handoff remain sandbox-tenant work; this gate does not claim them.
- No CopilotKit DPA/order, tenant, key, or Cloud project was created to test a path that is being denied.
- Managed Intelligence can only be reconsidered under the evidence list in the Proposed decision record.
