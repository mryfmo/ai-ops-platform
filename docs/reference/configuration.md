# Configuration Reference

## Server (`packages/server/src/config.ts`)

| Variable                                    | Required | Default                  | Behavior                                                                                                                                                              |
| ------------------------------------------- | -------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                                      | No       | `8080`                   | Hono listen port.                                                                                                                                                     |
| `WEBUI_INTERNAL_PORT`                       | No       | `3100`                   | Internal Next.js upstream for `/app/*` proxy.                                                                                                                         |
| `DATABASE_URL`                              | Yes      | None                     | PostgreSQL connection string.                                                                                                                                         |
| `DB_POOL_MAX`                               | No       | `10`                     | Maximum PostgreSQL pool connections.                                                                                                                                  |
| `DB_POOL_CONNECTION_TIMEOUT_MS`             | No       | `5000`                   | Milliseconds to wait for a PostgreSQL connection before failing.                                                                                                      |
| `DB_STATEMENT_TIMEOUT_MS`                   | No       | `30000`                  | PostgreSQL `statement_timeout` in milliseconds.                                                                                                                       |
| `DB_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS` | No       | `30000`                  | PostgreSQL `idle_in_transaction_session_timeout` in milliseconds.                                                                                                     |
| `LOG_LEVEL`                                 | No       | `info`                   | pino structured log level.                                                                                                                                            |
| `OTEL_SERVICE_NAME`                         | No       | `ai-ops-platform-server` | OpenTelemetry service name.                                                                                                                                           |
| `OTEL_EXPORTER_OTLP_ENDPOINT`               | No       | unset                    | OTLP base endpoint. When unset, telemetry is disabled with one explicit structured log entry.                                                                         |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`        | No       | unset                    | OTLP traces endpoint. Overrides the base endpoint for traces.                                                                                                         |
| `METRICS_TOKEN`                             | No       | unset                    | Bearer token required by `GET /metrics`; minimum length 32. When unset, startup logs one warning and the endpoint stays unauthenticated.                              |
| `GRAPH_CLIENT_STATE`                        | Yes      | None                     | Explicit Microsoft Graph notification `clientState`; minimum length 32. The subscription CLI rejects blank values and has no fixed fallback.                          |
| `GITHUB_WEBHOOK_SECRET`                     | Yes      | None                     | GitHub webhook HMAC secret; minimum length 32.                                                                                                                        |
| `GRAPH_CLIENT_ID`                           | Yes      | None                     | Microsoft Graph client credentials.                                                                                                                                   |
| `GRAPH_CLIENT_SECRET`                       | Yes      | None                     | Microsoft Graph client credentials.                                                                                                                                   |
| `GRAPH_TENANT_ID`                           | Yes      | None                     | Microsoft Graph tenant.                                                                                                                                               |
| `GRAPH_ALLOWED_TEAM_IDS`                    | Yes      | None                     | Comma-separated exact team IDs permitted for Graph Teams operations. Values are trimmed/deduplicated; empty lists and `*` fail startup.                               |
| `GRAPH_ALLOWED_FROM_MAILBOXES`              | Yes      | None                     | Comma-separated sender mailboxes permitted for Graph `sendMail`. Values are trimmed, lowercased, deduplicated, and email-validated; empty lists and `*` fail startup. |
| `PUBLIC_BASE_URL`                           | Yes      | None                     | Public URL used for Graph notification URL and WebUI deep links.                                                                                                      |
| `ANTHROPIC_API_KEY`                         | No       | unset                    | Enables LLM fallback paths that receive a configured client.                                                                                                          |
| `ANTHROPIC_DEFAULT_MODEL`                   | No       | `claude-sonnet-4-6`      | Model ID for standard calls. Accepts `[A-Za-z0-9][A-Za-z0-9._:-]*` up to `MAX_MODEL_ID_LENGTH`.                                                                       |
| `ANTHROPIC_ESCALATION_MODEL`                | No       | `claude-opus-4-8`        | Model ID for escalated calls; same format constraint as the default model.                                                                                            |
| `ANTHROPIC_PRICING_USD_PER_MTOK`            | No       | unset                    | JSON object mapping model IDs to input/output USD per million tokens. Parsed by `parseModelPricingUsdPerMtokJson`; malformed JSON fails startup with `E-CFG01`.       |
| `STAKEHOLDERS_DIR`                          | No       | unset                    | Absolute path to the stakeholder YAML master. Relative paths fail startup. When unset, Teams persona resolution is disabled and audited.                              |
| `GITHUB_APP_ID`                             | No       | unset                    | GitHub App authentication. All three App variables are all-or-none; configuring a subset fails startup.                                                               |
| `GITHUB_APP_PRIVATE_KEY`                    | No       | unset                    | GitHub App private key. Required together with the App ID and installation ID.                                                                                        |
| `GITHUB_APP_INSTALLATION_ID`                | No       | unset                    | GitHub App installation ID. Required together with the App ID and private key.                                                                                        |
| `GITHUB_TOKEN`                              | No       | unset                    | Transitional PAT fallback used only when the App triplet is absent. With neither configured, GitHub auth is disabled and audited.                                     |
| `GITHUB_PROJECT_NODE_ID`                    | No       | unset                    | When set, PM snapshot reconcile reads GitHub Projects v2. When unset, reconcile writes `pm_snapshot_reconcile_disabled` audit records and returns no snapshots.       |
| `FROM_MAILBOX`                              | No       | unset                    | Outlook mailbox used by report delivery. With delivery enabled it is required and must be in `GRAPH_ALLOWED_FROM_MAILBOXES`; otherwise startup fails.                 |
| `REPORT_DELIVERY_ENABLED`                   | No       | `false`                  | Must be `true` or `1` before standard reports are sent. When false, ingest can store reports but delivery is disabled and audited.                                    |
| `HEARTBEAT_URL`                             | No       | unset                    | Dead man's switch notified after a successful delivery cycle. URLs carrying userinfo credentials are rejected at startup. Unset means no-op.                          |
| `REPORT_INGEST_SECRET`                      | No       | unset                    | HMAC key for `POST /reports/ingest`; minimum length 32. Missing value disables the ingest route with a 503 response and audit record.                                 |
| `XLSX_IMPORT_SECRET`                        | No       | unset                    | HMAC key for `/xlsx-import/*`; minimum length 32. Missing value disables XLSX import and writes an audit record.                                                      |
| `XLSX_IMPORT_ALLOWED_REPOS`                 | No       | unset                    | Comma-separated `owner/repo` allowlist for XLSX execute operations. Unset means no repository is allowed.                                                             |
| `DEFAULT_TEAMS_TEAM_ID`                     | No       | unset                    | Default Teams team for cards. With delivery enabled, team/channel defaults are both-or-neither and the team must be allowlisted.                                      |
| `DEFAULT_TEAMS_CHANNEL_ID`                  | No       | unset                    | Default Teams channel for cards. With delivery enabled, team/channel defaults are both-or-neither.                                                                    |
| `CODING_TASK_CALLBACK_SECRET`               | Yes      | None                     | HMAC key for confirmation tokens and bearer secret for coding task callback; minimum length 32.                                                                       |

`loadConfig()` fails fast with `E-CFG01` when required values are missing or invalid. Recipient rows do not extend these allowlists: `GraphClient` checks the normalized team or sender again before requesting a token or calling Graph.

Database migrations are manual: apply `packages/devops/src/db/schema.sql` for a new database, then run `pnpm --filter @aiops/devops db:migrate` with `DATABASE_URL` set. Existing databases should run the migration command only; applied versions are recorded in `schema_migrations`.

Telemetry is pull-based for custom metrics: scrape `GET /metrics`. OpenTelemetry auto-instrumentation exports traces only when an OTLP endpoint is configured.

## Web (`packages/web/src/server/config.ts`, `packages/web/src/auth.ts`)

| Variable                            | Required | Default                 | Behavior                                                                              |
| ----------------------------------- | -------- | ----------------------- | ------------------------------------------------------------------------------------- |
| `AUTH_SECRET`                       | Yes      | None                    | Auth.js session secret.                                                               |
| `AUTH_MICROSOFT_ENTRA_ID_ID`        | Yes      | None                    | Microsoft Entra ID client ID.                                                         |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET`    | Yes      | None                    | Microsoft Entra ID client secret.                                                     |
| `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` | Yes      | None                    | Tenant ID; also builds the issuer URL in `auth.ts`.                                   |
| `DATABASE_URL`                      | Yes      | None                    | Used by persona resolver and dashboard data handlers.                                 |
| `PUBLIC_BASE_URL`                   | Yes      | None                    | Allowed origin for authenticated Excel import state changes.                          |
| `AIOPS_SERVER_INTERNAL_URL`         | No       | `http://127.0.0.1:8080` | Internal Hono endpoint used only by the server-side Excel import proxy.               |
| `XLSX_IMPORT_SECRET`                | No       | unset                   | HMAC key retained by server-side routes; if unset, Excel import returns 503.          |
| `ANTHROPIC_API_KEY`                 | No       | unset                   | If unset, `/app/api/chat` returns 503 and does not call a model.                      |
| `ANTHROPIC_DEFAULT_MODEL`           | No       | `claude-sonnet-4-6`     | Model ID for chat calls; same format constraint as the server variable.               |
| `ANTHROPIC_PRICING_USD_PER_MTOK`    | No       | unset                   | Model pricing JSON for `PgCostGuard`; malformed JSON fails with `E-CFG02`.            |
| `PRJOPS_DATA_DIR`                   | No       | unset                   | Absolute path to the immutable PrjOps snapshot checkout. Relative paths fail startup. |
| `PRJOPS_DATA_COMMIT_SHA`            | No       | unset                   | Owner-accepted 40-hex commit the pinned provider serves.                              |
| `PRJOPS_DATA_SOURCE_COMMIT_SHA`     | No       | unset                   | 40-hex provenance commit of the actual checkout.                                      |
| `PRJOPS_DATA_CONTENT_SHA256`        | No       | unset                   | 64-hex canonical manifest checksum verified before data is served.                    |
| `PAGE_AGENT_MAX_STEPS`              | No       | `5` in handler          | Max AI SDK tool steps; config accepts 1-10.                                           |
| `PAGE_AGENT_THINKING_BUDGET_TOKENS` | No       | `12000` in handler      | Anthropic extended thinking budget; config accepts 1024-64000.                        |

The four `PRJOPS_DATA_*` variables are all-or-none: configuring a subset fails startup, and leaving all four unset makes `createPinnedPrjopsReportDataProvider()` throw `PrjopsDataUnavailableError` rather than serving unpinned data.

`loadWebConfig()` fails fast with `E-CFG02` when required values are missing or invalid. The module does not validate at import time, so `next build` does not need secrets.

The server and web tables above list every key in the two Zod schemas, and the repository-root `.env.example` carries the same union. `DATABASE_URL`, `PUBLIC_BASE_URL`, `XLSX_IMPORT_SECRET`, `ANTHROPIC_API_KEY`, `ANTHROPIC_DEFAULT_MODEL`, and `ANTHROPIC_PRICING_USD_PER_MTOK` appear in both schemas and so appear once in `.env.example`. This is enforced, not asserted: `configInventoryFailures()` in `packages/traceability/src/verifyTraceability.ts` diffs the schemas against both tables and `.env.example` in either direction, and `mise run traceability` — and therefore `mise run ci` — fails on any divergence, listing the offending keys under `Traceability Guards` in the generated matrix. Adding a key to either schema without adding it here and to `.env.example` breaks the build. Variables below are used by separate report-generation jobs and are not part of those two schemas.

## Report Generation Environment

| Variable               | Required | Default                   | Used By                                                                                                                             |
| ---------------------- | -------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `REPORT_COMPLETED`     | No       | `0`                       | `calculateReportMetrics.ts`                                                                                                         |
| `REPORT_BLOCKED`       | No       | `0`                       | `calculateReportMetrics.ts`                                                                                                         |
| `REPORT_EVIDENCE_IDS`  | No       | `REQ-040`                 | `finalizeReportJson.ts`                                                                                                             |
| `PERIOD_LABEL`         | No       | `scheduled weekly period` | `finalizeReportJson.ts`                                                                                                             |
| `REPORT_TYPE`          | No       | `weekly-summary`          | `finalizeReportJson.ts`; allowed values are `weekly-summary`, `manager-weekly`, `investor-quarterly`.                               |
| `REPORT_INGEST_URL`    | No       | unset                     | GitHub Actions variable. If unset, `report-generation.yml` uploads `report.json` as an artifact and skips server ingest explicitly. |
| `REPORT_INGEST_SECRET` | No       | unset                     | GitHub Actions secret. HMAC key for posting `report.json` to `/reports/ingest`; must match the server value.                        |

## Runtime Notes

- Web chat records cost through `PgCostGuard` as agent `WEB-CHAT` with route-code daily and per-request limits. The resident server uses the same guard for Teams free-text fallback as agent `SERVER`.
- `.github/workflows/release-image.yml` is absent. ADR-0016 (Accepted, 2026-07-13) selects Azure Container Registry with immutable digests, SBOM, and provenance, so the registry and provenance model are no longer open questions; the workflow itself is not implemented yet. This note records the current state and is not a delivery commitment.
