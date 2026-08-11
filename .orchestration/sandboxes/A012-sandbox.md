# A012 Sandbox

- Reused the linked Git worktree and created
  `agent/p010-f02-t02-snapshot-validator` from `origin/main` commit
  `709879789234a32e4caae90f8d09b5e81bdefe36`.
- The linked worktree isolated A012 from the dirty primary checkout.
- The primary checkout was used only for exact A012 orchestration artifacts.
- CI's traceability timestamp output was restored after validation.
- No dependency installation, contract/fixture modification, product code beyond
  PrjOps lib/exports/tests, worklog edit, `docs/audit` edit, LLM API call,
  browser Crit, user review request, force push, direct `main` push, or merge was
  performed.
