# T10 Learning

## What Was Learned

- `mise` task `depends` does not provide the ordering needed when one task generates a file that another task checks.
- For this repo, `traceability` must run before `format` because it generates `packages/traceability/output/traceability_matrix.md`.
- For clean checkouts, `build` must run before workspace `typecheck` because referenced package declarations may not exist yet.
- Existing secret sanitizer patterns did not catch JSON-stringified keys like `"client_secret":"..."`; raw payload persistence needs that form sanitized.

## Where To Apply

- Keep `.mise.toml` `ci` as an explicit ordered chain unless the traceability generator stops writing tracked markdown.
- Keep sanitizer tests covering JSON-stringified secret keys whenever raw payloads are persisted.

## Validation

- Confirmed by normal `mise run ci` pass.
- Confirmed by targeted shared/server/web tests.
