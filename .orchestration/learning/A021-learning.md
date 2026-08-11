# A021 Learning Triage

## Reusable Observations

1. Workflow authority is clearer when assigned by governance weight rather
   than by product: record-grade facts belong in reviewed Git, high-frequency
   operating flux belongs in the workbench, and the platform remains an
   observer/auditor/promoter.
2. A Git-to-workbench projection plan is incomplete unless it names both the
   exact-SHA content read port and the existing event-dispatch route that
   invokes the projector.
3. A multi-row snapshot needs an explicit atomic visibility oracle. A single
   transaction plus one capture identifier and complete marker is sufficient
   without adding another timeseries table.
4. Secret sanitization is not ordinary-PII governance. Field allowlisting,
   retention, erasure, and backup purge must be approved before webhook
   ingestion.
5. A signed mapping is not an authorization boundary until runtime verifies
   the signature and injects only a verified object into callers.

## Promotion Decision

No repository learn file or new skill was promoted. The findings are captured
as orchestration evidence because A021 is a proposal-only task and worklog
editing was explicitly prohibited.
