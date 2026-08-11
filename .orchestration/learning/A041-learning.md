# A041 merge wave 1 learning triage

## Candidate

GitHub may transiently report `mergeable=UNKNOWN` immediately after a preceding PR updates the base branch. A short read-only retry can distinguish asynchronous recomputation from a real conflict before deciding whether update-branch is necessary.

## Disposition

Not promoted. This is standard GitHub merge-queue behavior already handled by the task's prescribed serial gate and does not require a new repository rule.

