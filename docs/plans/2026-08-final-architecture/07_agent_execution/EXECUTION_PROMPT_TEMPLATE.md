# Execution Prompt Template

```text
Repository: mryfmo/ai-ops-platform
Baseline/branch: <BASE_SHA> / <TASK_BRANCH>
Task: <WBS_TASK_ID> — <TITLE>
Writer profile: <WRITER>
Reviewer profile: <REVIEWER>

Authority to read in order:
1. AGENTS.md + final architecture addendum
2. Related approved ADR/spec/AC
3. This task manifest
4. Existing code/tests

Intent:
<WHY THIS TASK EXISTS>

Allowed paths:
<PATHS>

Forbidden paths/actions:
<PATHS_AND_ACTIONS>

Required deliverables:
<DELIVERABLES>

Acceptance gates:
<GATE_IDS_AND_CRITERIA>

Required verification:
<COMMANDS>

Migration/feature flag:
<FLAG_AND_ROLLBACK>

Rules:
- Do not change architecture, SoR, approval location or product selection.
- Do not make unsupported claims.
- Stop on unresolved owner decision, baseline drift, or forbidden path need.
- Preserve deterministic lib logic, sanitization, append-only audit, permission filtering.
- One task/one writer; no main push/merge/production changes.

Before editing, output a concise implementation map: existing files reused, files changed, tests, risks, rollback.
After editing, output the completion evidence defined in AGENTS_ADDENDUM.md.
```
