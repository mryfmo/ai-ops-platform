# P1-T07 learning

- Derive `service.version` from package metadata so telemetry cannot drift from the deployed package.
- Apply the platform bound only to controlled service resource fields; preserve unrelated valid deployment metadata while still validating encoding and rejecting known secrets.
- Reconstruct `OTEL_RESOURCE_ATTRIBUTES` deterministically so malformed input fails closed instead of silently discarding all existing resource metadata.
- No separate project worklog learn was added because regression tests encode these validated decisions.
