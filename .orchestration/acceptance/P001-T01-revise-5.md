# P001-T01 Revision 5

## Status

Revision required after orchestrator PostgreSQL 16 validation.

## Observed failure

The historical partition implementation created partitions, but the integration fixture inserted bare date strings into `TIMESTAMPTZ`. With the database/session timezone set to `Asia/Tokyo`, `2024-01-01` became a December 2023 UTC instant, so assertions for January/February/March relation names were invalid.

## Required correction

1. Make all historical migration fixture timestamps explicit UTC instants (`...T00:00:00Z`).
2. Keep UTC-month partition derivation unchanged.
3. Re-run focused checks and update artifacts. The orchestrator will recreate the disposable schema and run the real PostgreSQL suite again.
