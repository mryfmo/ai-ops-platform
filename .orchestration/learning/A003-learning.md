# A003 Learning

## Candidate reusable learning

When an untracked source document must be imported without semantic edits but repository formatting is mandatory, preserve both constraints by:

1. recording the pristine source hash,
2. applying only authorized substitutions to a scratch copy,
3. normalizing scratch and worktree copies with the same pinned formatter,
4. requiring byte-equal normalized output,
5. recording formatter version and both source/result hashes.

This distinguishes deterministic formatting from unauthorized content edits and avoids either weakening the format gate or silently changing a supplied decision document.

## Triage

- Reusable: yes, for future canonical document imports.
- Validated: yes, by A003 SHA-256 and `cmp` checks.
- Promotion: not performed; A003 only records a candidate.
- Worklog learn update: not performed because the task forbids worklog edits.
