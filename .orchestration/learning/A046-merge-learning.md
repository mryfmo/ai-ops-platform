# A046 merge learning

An acceptance message does not implicitly waive actionable review threads that already existed. After an explicit fix-before-merge ruling, treat the corrected commit as the final head: re-run local full CI, reply to and resolve every ruled thread, then repeat identity/check/thread/workflow gates before merging. For non-idempotent delivery followed by persistence failure, a process-local per-day marker prevents a same-day storm while preserving next-day recovery; escalation completion must likewise follow the irreversible delivery or an audited degraded decision.
