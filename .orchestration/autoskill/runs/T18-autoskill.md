# T18 Autoskill

## Assessment

No new autoskill was promoted.

## Reason

The useful reusable pattern is a small repository-local rule: for business-day scheduler jobs, inject data providers and calendars, and keep the scheduler task pure enough to test without real APIs.

## Candidate Notes

- Potential future rule candidate: "Repository-wide format checks include untracked orchestration artifacts; format coordination artifacts before final CI."
