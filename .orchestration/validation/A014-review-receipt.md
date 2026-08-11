review_surface: crit-data
reviewer: codex
review_source: .orchestration/validation/A014-crit-comments.json
review_outcome: one scope-broadening P1 fixed with regression coverage; all records resolved
reviewed_scope:
  - packages/devops/src/db/schema.sql
  - packages/devops/src/db/migrations/202607180000_recipients_stable_subject.sql
  - packages/devops/tests/recipientsStableSubjectSchema.test.ts
  - packages/server/src/db/recipientsRepo.ts
  - packages/server/tests/recipientsRepo.test.ts
make_gate: unavailable (repository has no require-crit-review target)
