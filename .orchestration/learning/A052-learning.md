<!-- 根拠: DevOps:REQ-003 / DevOps:REQ-010 / DevOps:REQ-012 / TH-001 / TH-003 / AC-010a -->

# A052 learning triage

## Validated learning

- Runtime evidence must bind a measured value to the immutable event commit; missing evidence remains unavailable rather than becoming a healthy zero.
- Bounded external artifact reads require both streaming byte limits and ZIP central/local-header agreement before JSON parsing.
- An approval consumed marker, its claim audit, and a durable deployment work item belong in one transaction. Downstream target ambiguity can then fail closed, while valid work survives worker loss without enabling duplicate claims.
- A dispatch writer is not enough for scheduled post-deploy monitoring: the matching successful workflow event must advance the durable state to `monitoring`.
- Recurring schedulers need durable side-effect states: unsuccessful deployments terminate `dispatch_failed`, and rollback claims `rolling_back` before dispatch then terminates `rolled_back`.
- agmsg helper scripts are positional CLIs; using flag-shaped arguments can silently misroute a message because the shell treats them as ordinary field values.

## Promotion

These reusable findings are recorded in `.agents/worklog/codex/learn/20260809_142500_learn.md`, indexed in `learn_index.md`, and reflected in the A052 plan/tests.
