# P3-T09 learning

## L-P3T09-01: inventory completeness should bind to the composition source

A hand-maintained task list cannot detect a future scheduler registration or retiming. Parsing the actual `startScheduler` array, task factory defaults, and composition overrides makes additions, removals, duplicates, reordering, and timing drift fail closed.

## L-P3T09-02: compare plans without importing workflow runtime code

Pure schedule builders are safe to execute in a deterministic shadow harness. Workflow modules should instead be source-verified because importing them initializes Temporal workflow proxies. This preserves zero-side-effect evidence while still binding the P3-T07/P3-T08 workflow names.

## L-P3T09-03: absence of a semantic counterpart is evidence

P3-T08 Plane projection is not PM snapshot reconciliation. Recording that non-equivalence in the mapping is safer than manufacturing a false parity claim; the missing dedicated Temporal counterpart stays explicit.

## L-P3T09-04: Temporal-only plans belong in the comparison

P3-T05 emits a reconcile schedule without a separate legacy registration. Reporting it separately prevents a 15-task legacy inventory from hiding additional Temporal behavior.

## L-P3T09-05: zero-write evidence needs capability enforcement

A source denylist can miss alternate write primitives. An allowlisted runtime import graph plus Node's read-only permission model makes the shadow execution mechanically unable to write files or spawn escape processes.

## L-P3T09-06: startup parity does not prove recurring parity

For `runOnStart` tasks, the first planned time is unchanged when cadence drifts. Compare both first-run time and recurring interval, and bind every documented exception to its exact legacy and Temporal values rather than accepting any difference with a reason string.

## L-P3T09-07: completeness and side-effect checks must cover the executable boundary

Classify every top-level scheduler array element instead of only recognized descendants. For safety, scan both source and the final bundle, then execute with explicit network denial as well as file/process permissions; checking one imported source file cannot prove the whole runner is inert.

No project-level learn promotion is proposed until the reviewer validates these rules.
