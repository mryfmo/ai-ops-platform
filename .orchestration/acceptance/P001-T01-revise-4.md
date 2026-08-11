# P001-T01 Revision 4

## Status

Revision required after independent `gpt-5.6-sol` high review.

## Required corrections

1. Classified legacy rows outside the current/next month must not remain indefinitely in a DEFAULT partition. Create the required historical monthly partitions before copy, or implement an equally safe enforced drain. Add a real-PostgreSQL test proving historical rows route to monthly partitions and become retention candidates.
2. Derive retention cutoff defaults from UTC, not session-local `CURRENT_DATE`. Add a non-UTC (`Asia/Tokyo`) boundary regression.
3. Restrict catalog discovery to the intended schema for both parent and child, and return a safely schema-qualified partition identifier. Add a second-schema adversarial test.
4. Preserve transaction rollback, legacy-data preservation, explicit retention classification, and app-role immutability guarantees.

## Worker validation boundary

Run focused tests, typecheck, shell syntax, formatting, and `git diff --check`. Do not claim orchestrator-only real PostgreSQL or full-CI validation unless actually executed.
