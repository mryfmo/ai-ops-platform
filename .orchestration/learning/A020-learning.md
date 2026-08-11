# A020 Learning Triage

## Reusable Observations

1. When an orchestration instruction says every canonical-form identifier
   present in fixtures, negative-case values such as `PJ-404` must be included
   unless the contract explicitly narrows the set to accepted entities.
2. A JSON object keyed by canonical project ID makes duplicate mappings
   structurally impossible and is smaller than an array plus duplicate
   validation.
3. A DEV-DEFAULT fixture should carry its approval basis, unsigned status, and
   replacement boundary inside the artifact rather than relying only on a
   nearby decision document.

## Promotion Decision

No repository learn file or new skill was promoted. These observations are
recorded as orchestration evidence; A020 is a bounded contract-fixture task and
does not require a worklog change.
