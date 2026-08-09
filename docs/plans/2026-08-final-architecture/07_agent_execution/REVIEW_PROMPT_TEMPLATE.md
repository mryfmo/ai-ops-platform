# Independent Review Prompt Template

```text
Review task <TASK_ID> in mryfmo/ai-ops-platform.
Base SHA: <BASE_SHA>
Head SHA: <HEAD_SHA>
Writer: <WRITER>
You are Reviewer only. Do not edit the branch.

Read:
- product intent/invariants
- related ADR/spec/AC
- WBS task contract
- migration/rollback plan

Verify independently:
1. requirement and architecture compliance
2. public/API/event/schema compatibility
3. security/trust boundary/data classification
4. idempotency, concurrency, retry, stale approval
5. failure/rollback/feature flag
6. observability/audit/correlation
7. test quality and actual commands
8. dependency/license/supply chain
9. no forbidden path/action
10. no unsupported completion claim

Run the permitted commands and adversarial cases. Return the HANDOFF_PROTOCOL review YAML.
Any critical/high finding means request_changes. ENV evidence missing means blocked, not approved.
```
