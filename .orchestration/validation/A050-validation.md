# A050 Validation

- PR #150 head: `4e84ae4b197b9d4e0cd3ecebf6fc9a440bdd14dc`.
- RED: the prior blanket-mask assertions failed for all-hidden clean narratives and clean sibling slots.
- RED: mixed-domain `REPORT_PROJECT_IDS` exited successfully before the producer rejection was added.
- RED: reordered portfolio scopes returned two 201 responses before signed-ingest normalization.
- Targeted GREEN: server gate/delivery/ingest 67 tests; shared reporting 50 tests.
- Final shared coverage: 25 files / 457 tests passed.
- Final server coverage: 74 files / 804 tests passed (800 passed, 4 skipped).
- Final `mise run lint`, `mise run typecheck`, `mise run format`, and `mise run traceability`: passed.
- `git diff --check`: passed.
- Gitleaks 8.30.0 equivalent scan: no leaks found (272 commits, ~7.41 MB).
- First independent `codex review --base origin/main`: found portfolio-order idempotency P2; fixed and retested.
- Focused independent `codex review --uncommitted`: no actionable regressions.
- `make require-crit-review`: repository has no such target. The task repository also has no plan-quality validator/local hook/reviewer entrypoint; the plan-quality checklist was applied manually and the external hook completed with exit 0.
- GitHub Actions run `31305015365`: `build-test` SUCCESS (4m04s) and `gitleaks` SUCCESS; CodeRabbit SUCCESS.
- Final head `4e84ae4b197b9d4e0cd3ecebf6fc9a440bdd14dc`, merge state CLEAN, unresolved review threads 0 (both late threads replied to and resolved).
