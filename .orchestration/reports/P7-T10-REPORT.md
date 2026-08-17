# P7-T10 Typed Gadget/ViewSpec Report

## Outcome

Implemented the Phase 1 Workbench Gadget catalog inside `packages/web`: workflow timeline, source panel, pending actions, and decision summary. Each mini-app is selected by an exact typed ViewSpec and rendered by locally authored React components from an already-acquired P7-T08 workspace reference model.

## Typed Boundary

- `GADGET_COMPONENTS` is the complete approved component catalog.
- Every spec is `kind: "gadget"` plus one catalog component, a workspace UUID, an exact project/repository/space resource reference, and only component-specific record references or enum filters.
- Zod `.strict()` schemas reject missing/extra fields, unknown components, arbitrary code, HTML, event handlers, expressions, URL/fetch fields, URL-shaped resource IDs, and script-like references.
- Compile-time negative fixtures show that code, network target, handler, and unapproved component object literals are not assignable to `GadgetViewSpec`.
- The renderer reparses typed input so an unsafe runtime cast cannot bypass the schema.

## Grant and Render Boundary

- The P7-T08 identity + SQL grant + OPA acquisition path remains the authorization authority. This UI adds no alternate grant authority or cache.
- Before rendering, workspace ID and resource type/ID must exactly match the grant context returned with the workspace. Optional workflow/source IDs must exist inside that already grant-shaped projection.
- A mismatch uses fixed `E-GADGET-SCOPE` and renders nothing; the check is defense against spec/data mix-up, not UI-only authorization.
- Rendering is synchronous and performs no fetch. React owns text escaping; no raw HTML, script, dynamic component, iframe, eval, or event-handler string path exists.
- Provenance links come only from the strict Workbench API model, never from ViewSpec input.

## UI and Inventory

- One deterministic static-markup snapshot covers all four Japanese-capable views: table overflow, source references, deferred actions, and policy decision metadata.
- A native filesystem test scans web dependencies/scripts, root configuration filenames/content, and all source imports/config for Cloudflare or wrangler surfaces; the gate is green.
- No dependency, lockfile, route, server, schema, credential, arbitrary-code sandbox, or iframe was added.
- Open PR #260/#261 files were not touched.

[memory:decision] Phase 1 Workbench gadgets must be a closed discriminated catalog whose specs contain only scoped references and display filters; rendering consumes only the grant-shaped Control API reference model, reparses the spec, and has no code or network execution surface.

## Deferred

- Workbench page/tool wiring is deferred because the task did not authorize a new runtime route/tool contract; the catalog and renderer are ready for that consumer.
- Arbitrary-code gadgets, iframe/CSP isolation, server sandboxing, ambient-network controls, and capability proxies remain Phase 6+ work.
- Real browser/tenant screenshots remain part of their sandbox acceptance gates, not this CI-only task.

## Handoff

- Branch: `agent/P7-T10-gadget-viewspec`
- Orchestrator owns push and non-draft PR creation after `AGMSG-RESULT`.
