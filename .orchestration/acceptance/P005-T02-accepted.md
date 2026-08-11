# P005-T02 Acceptance

Accepted after red-first focused tests, full `mise run ci`, and independent `gpt-5.6-sol` high review.

- Exact notification ID/version redelivery is deduplicated.
- Created, updated, and deleted changes no longer collide by message ID.
- Missing optional identity disables dedupe to prevent notification loss.
- Persisted keys and audit details do not contain `clientState` or notification bodies.
