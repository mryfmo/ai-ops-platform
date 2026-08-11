# A039 learning triage

## Candidates

- A readiness response that must preserve diagnostic state on dependency failure needs a pre-check snapshot, but a successful dependency check that refreshes state also needs a post-check recomputation. Tests should pin both paths.
- Periodically refreshing mutable capability facts through the resident scheduler keeps `/metrics` rendering synchronous and avoids one database query per scrape, while retaining the same query in readiness preserves failure detection.

## Disposition

Not promoted to `.agents/worklog/codex/learn`. Both points are captured by focused regression tests and are specific applications of existing repository patterns; they do not justify a new reusable project-wide worklog entry.

