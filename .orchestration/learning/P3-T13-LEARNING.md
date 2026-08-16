<!-- 根拠: TMP-003 / TMP-005 / ADR-0021 -->

# P3-T13 Learning

## Reusable Findings

1. A Temporal migration can coexist safely with a resident loop only when both
   contend on the same database CAS. Schedule overlap policy alone cannot stop
   a cross-runtime duplicate external write.
2. For deployment effects, the state CAS and external action ledger solve
   different races: `created | stale` chooses the state-transition winner, while
   `absent | pending | sent` prevents ambiguous retries and response-loss resend.
3. Temporal workflow tests execute the workflow inside a webpack sandbox, so V8
   does not measure that source normally. Keep pure contracts directly covered,
   replay the recorded history, and use the repository's explicit workflow-only
   exclusion rather than lowering global thresholds.
4. A stale approval claim during cutover must re-read the authoritative
   deployment row because the legacy winner may already have inserted the
   `approved` work item.

## Apply To

- Future resident-loop to Temporal cutovers.
- Any external side effect guarded by database state plus an action ledger.
- Control-plane coverage and recorded-history review.
