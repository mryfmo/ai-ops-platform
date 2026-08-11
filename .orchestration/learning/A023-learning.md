# A023 Learning Triage

## Reusable Observations

1. A Plane workspace may validly contain multiple projects, so workspace UUID
   reuse is allowed only when the routing slug is identical; project UUIDs
   remain globally unique in the mapping.
2. Development mapping safety needs both a visible unsigned provenance marker
   and a non-routable URL. A boolean replacement flag alone is too easy to
   overlook.
3. JSON Schema provides the reviewable machine contract, while a small stdlib
   semantic validator is still needed for duplicate UUID and cross-row
   consistency checks.

## Promotion Decision

No repository learn file or new skill was promoted. These observations are
captured as orchestration evidence for the bounded FA-T02 contract task.
