<!-- 根拠: FinalArch:CON-001 / FinalArch:CON-002 / FinalArch:CON-004 / FinalArch:CON-005 / FinalArch:PRD-003 / FinalArch:FR-CP-001 / ADR-0020 -->

# Versioned contracts

`contracts/` is the repository contract surface for Control API, platform events,
domain data, and policy input/decision payloads. The architecture-pack files remain
untouched; [`provenance.json`](./provenance.json) pins each imported source by path
and SHA-256.

## Contract map

| Runtime contract                         | Version       | Architecture-pack source                   | Stored compatibility baseline                        |
| ---------------------------------------- | ------------- | ------------------------------------------ | ---------------------------------------------------- |
| `openapi/control-api.v1.yaml`            | `1.0.0-draft` | `05_contracts/control-api.openapi.yaml`    | `baseline/v1/openapi/control-api.v1.yaml`            |
| `asyncapi/events.v1.yaml`                | `1.0.0-draft` | `05_contracts/events.asyncapi.yaml`        | `baseline/v1/asyncapi/events.v1.yaml`                |
| `schemas/domain.v1.schema.json`          | `v1`          | `05_contracts/domain-schemas.json`         | `baseline/v1/schemas/domain.v1.schema.json`          |
| `schemas/policy-input.v1.schema.json`    | `v1`          | `05_contracts/policy-input.schema.json`    | `baseline/v1/schemas/policy-input.v1.schema.json`    |
| `schemas/policy-decision.v1.schema.json` | `v1`          | `05_contracts/policy-decision.schema.json` | `baseline/v1/schemas/policy-decision.v1.schema.json` |

All source paths in the table are relative to
`docs/plans/2026-08-final-architecture/05_contracts/`.

## Deliberate repository deltas

- OpenAPI adds a reusable `VersionedPayload` schema with numeric
  `schemaVersion: 1`, matching `@aiops/control-plane`.
- The domain schema adds the same versioned envelope and the seven canonical
  `WORKFLOW_KINDS`. The checker compares both lists directly with the TypeScript
  source so either side drifting fails.
- Policy input nested objects and policy-decision obligations set
  `additionalProperties: false`, making the CON-004 unknown-field rejection
  explicit rather than relying only on the top-level rule.
- AsyncAPI keeps its pack-defined string event-contract version (`vN`). This is
  the event envelope protocol version; it is distinct from the numeric activity
  `VersionedPayload.schemaVersion` and is checked independently.

## Validation and compatibility

Run the contract gate from the repository root:

```bash
SCARF_ANALYTICS=false pnpm --dir contracts install --frozen-lockfile
pnpm --dir contracts run check
```

Spectral applies its OpenAPI and AsyncAPI rulesets. The checker rejects malformed documents, unresolved internal `$ref` values,
canonical-source hash drift, runtime enum/schema-version drift, and backward
incompatibilities against the stored v1 copies. Breaking changes include removed
paths, operations, parameters, responses, channels, messages, schemas, definitions,
or properties; newly required fields; removed enum values; changed type/ref/const;
and tightened bounds, formats, patterns, or `additionalProperties`. Optional
additions remain compatible.

Spectral is the only newly introduced contract-local linter. Its JSON Schema
function compiles all three schemas against Draft 2020-12 and exercises valid,
unknown-field, and oversized policy-input fixtures. The checker also generates and
loads a minimal OpenAPI client, and tests the current event producer schema against
the stored N-1 consumer baseline.
Scarf analytics are disabled during installation; the nested workspace records the
transitive build allowlist explicitly. The declared `yaml` version matches the
existing root development dependency so the nested package works in isolation.

The `baseline/v1/` copies are immutable evidence for v1. A deliberate breaking
change requires a new versioned file and baseline directory; do not overwrite v1.
