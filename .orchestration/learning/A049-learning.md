# A049 learning triage

## Observation

Dependabot may complete a requested rebase while a permitted local mechanical conflict resolution is being prepared. A normal push then fails non-fast-forward, which safely prevents overwriting the bot's newer head. Refetching the bot head and repeating the workflow-path, thread, mergeability, and fresh-check gates is sufficient; force push is neither needed nor allowed.

## Decision

Not promoted. The existing protocol already requires normal pushes, prohibits force pushes, and requires a fresh gate after branch updates. No new repository rule or skill is needed.

