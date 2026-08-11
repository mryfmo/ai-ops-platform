# T30-V1 Learning Triage

## Reusable Observations

1. Process-local scheduler overlap guards do not provide replica-level single execution; production scheduler reviews must trace coordination across processes.
2. Calendar data needs an explicit validity horizon. Missing dates cannot safely mean ordinary business days outside that horizon.
3. Authorization filters are ineffective when provenance is synthesized from the recipient instead of carried by the source record.
4. Deletion synchronization and retention purge are different controls; a project-close purge does not satisfy user-centric correction/erasure handling.
5. Workflow pinning checks must cover distributable templates, not only active `.github/workflows`.
6. Writing `pending` before an external send is not a claim unless the write atomically tells exactly one contender it owns delivery.
7. Audit actors need immutable subject identity; a persona is authorization context, not attribution.
8. Sink-family review matters: proving one HTML renderer safe does not prove sibling `htmlBody` construction safe.
9. Multi-stage containers still need selective runtime copies and an explicit non-root user.

## Promotion

No rule or skill was promoted. These observations should be considered by the orchestrator after acceptance.
