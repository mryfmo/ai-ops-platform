# A051 Report

- Branch: `agent/a051-approval-scope`
- Base: `a6f4b4b3fdcd17a554adce886c30b6d1f30dd221`
- Pull request: https://github.com/mryfmo/ai-ops-platform/pull/151
- Initial implementation commit: `86a686a80fd40f57b51bd6642307988804ab5dcd`

- Added request-time, data-side change-approval authorization keyed by the validated Entra tenant/object subject. `PRF-L` may decide only approvals whose non-null `project_id` is in the active recipient assignment; `PRF-G` retains A051's explicitly required all-project behavior.
- Kept list visibility separate from decision authority as required by A051: pending change rows remain visible, while the server returns `canDecide`/`decisionDisabledReason` and the Web UI disables both decision controls for unauthorized rows.
- Reused the existing 403 + append-only denial audit and transactional approval CAS; no approval schema, identity envelope, dependency, or AGT_CHG production change was needed.
- Confirmed AGT_CHG already requires and forwards `projectId`. Generic approvals may still contain `NULL`; those decisions fail closed to `PRF-G` only.
- Advanced the real-PostgreSQL approval fixture through the already-existing current schema/migrations so clean-database coverage exercises the columns used by the current repository.
- Independent review raised two P1 suggestions that conflict with A051's explicit acceptance text (hide unauthorized list rows; scope project-mode `PRF-G`). They were not applied and are dispositioned in `.orchestration/reviews/A051-codex-review.md`.
- GitHub workflow run `31308497540` passed `build-test` (4m29s) and `gitleaks` on evidence head `11ca554c9dbdaab6ceaf1dd7ddbbbd30f9d08ed5`.
- Ready-state GitHub Codex review later raised the same two task-contract conflicts as the local independent review. Both received evidence-backed no-change dispositions and were resolved; final unresolved thread count is 0.
- CodeRabbit completed its initial ready check and later reported its review limit on bookkeeping-only revisions. The merge state was CLEAN, the PR carries `ai-generated`, and it remains unmerged.
