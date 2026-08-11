# A004 Learning

## Candidate reusable learning

For an authorized stacked PR merge, treat each retarget as a fresh gate:

1. merge the lower PR only after its actual hosted check set is green,
2. retarget and undraft the next PR,
3. re-read mergeability and the hosted check set instead of assuming inherited checks,
4. merge strictly in order,
5. fetch the final base and prove every PR head is an ancestor,
6. run the repository-wide CI at a commit exactly equal to that fetched base.

Recording the actual hosted check set matters: a green PR may expose fewer checks than an earlier stack layer, and absent checks must not be reported as if they ran.

## Triage

- Reusable: yes, for future stacked PR merge operations.
- Validated: yes, by A004's three sequential merges, ancestry checks, and final `mise run ci`.
- Promotion: not performed; A004 only records a candidate.
- Worklog learn update: not performed because the task forbids worklog edits.

