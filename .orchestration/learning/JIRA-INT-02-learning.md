# JIRA-INT-02 Learning

## Reusable lessons

- Recorded-history fixtures should be formatted inside the recorder, not after generation; this preserves both script-output provenance and the repository's Prettier gate.
- A recorder that regenerates all histories must be followed by restoring tracked unrelated fixtures, leaving only the task-specific untracked histories.
- Parent histories prove child-workflow topology and outcomes; child histories separately prove activity order, reconcile reads, one-shot retry policy, and no-write boundaries.
- Temporal time-skipping tests and full CI need sandbox-external execution on this host; database validation should use a fresh disposable PostgreSQL cluster.

## Outcome

No production Jira workflow defect or nondeterminism was exposed, so the task completed without any forbidden `src/**` change.

## Promotion

No new Codex learn file was promoted; the task-specific findings are recorded here and in the CompactionDB decision.
