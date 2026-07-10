# Configuration Reference

## Server (`packages/server/src/config.ts`)

| Variable                                    | Required | Default                  | Behavior                                                                                                                                                        |
| ------------------------------------------- | -------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                                      | No       | `8080`                   | Hono listen port.                                                                                                                                               |
| `WEBUI_INTERNAL_PORT`                       | No       | `3100`                   | Internal Next.js upstream for `/app/*` proxy.                                                                                                                   |
| `DATABASE_URL`                              | Yes      | None                     | PostgreSQL connection string.                                                                                                                                   |
| `DB_POOL_MAX`                               | No       | `10`                     | Maximum PostgreSQL pool connections.                                                                                                                            |
| `DB_POOL_CONNECTION_TIMEOUT_MS`             | No       | `5000`                   | Milliseconds to wait for a PostgreSQL connection before failing.                                                                                                |
| `DB_STATEMENT_TIMEOUT_MS`                   | No       | `30000`                  | PostgreSQL `statement_timeout` in milliseconds.                                                                                                                 |
| `DB_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS` | No       | `30000`                  | PostgreSQL `idle_in_transaction_session_timeout` in milliseconds.                                                                                               |
| `LOG_LEVEL`                                 | No       | `info`                   | pino structured log level.                                                                                                                                      |
| `OTEL_SERVICE_NAME`                         | No       | `ai-ops-platform-server` | OpenTelemetry service name.                                                                                                                                     |
| `OTEL_EXPORTER_OTLP_ENDPOINT`               | No       | unset                    | OTLP base endpoint. When unset, telemetry is disabled with one explicit structured log entry.                                                                   |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`        | No       | unset                    | OTLP traces endpoint. Overrides the base endpoint for traces.                                                                                                   |
| `GRAPH_CLIENT_STATE`                        | Yes      | None                     | Microsoft Graph notification `clientState`; minimum length 32.                                                                                                  |
| `GITHUB_WEBHOOK_SECRET`                     | Yes      | None                     | GitHub webhook HMAC secret; minimum length 32.                                                                                                                  |
| `GRAPH_CLIENT_ID`                           | Yes      | None                     | Microsoft Graph client credentials.                                                                                                                             |
| `GRAPH_CLIENT_SECRET`                       | Yes      | None                     | Microsoft Graph client credentials.                                                                                                                             |
| `GRAPH_TENANT_ID`                           | Yes      | None                     | Microsoft Graph tenant.                                                                                                                                         |
| `PUBLIC_BASE_URL`                           | Yes      | None                     | Public URL used for Graph notification URL and WebUI deep links.                                                                                                |
| `ANTHROPIC_API_KEY`                         | No       | unset                    | Enables LLM fallback paths that receive a configured client.                                                                                                    |
| `GITHUB_PROJECT_NODE_ID`                    | No       | unset                    | When set, PM snapshot reconcile reads GitHub Projects v2. When unset, reconcile writes `pm_snapshot_reconcile_disabled` audit records and returns no snapshots. |
| `FROM_MAILBOX`                              | No       | unset                    | Outlook mailbox used by report delivery. Missing value disables `reportDeliveryTask` with `report_delivery_disabled` audit records.                             |
| `REPORT_DELIVERY_ENABLED`                   | No       | `false`                  | Must be `true` or `1` before standard reports are sent. When false, ingest can store reports but delivery is disabled and audited.                              |
| `REPORT_INGEST_SECRET`                      | No       | unset                    | HMAC key for `POST /reports/ingest`; minimum length 32. Missing value disables the ingest route with a 503 response and audit record.                           |
| `DEFAULT_TEAMS_TEAM_ID`                     | No       | unset                    | Default Teams team reference for report delivery setup/runbooks.                                                                                                |
| `DEFAULT_TEAMS_CHANNEL_ID`                  | No       | unset                    | Default Teams channel for report adaptive cards. Missing value means email-only delivery unless a recipient row has `teams_channel_id`.                         |
| `CODING_TASK_CALLBACK_SECRET`               | Yes      | None                     | HMAC key for confirmation tokens and bearer secret for coding task callback; minimum length 32.                                                                 |

`loadConfig()` fails fast with `E-CFG01` when required values are missing or invalid.

Database migrations are manual: apply `packages/devops/src/db/schema.sql` for a new database, then run `pnpm --filter @aiops/devops db:migrate` with `DATABASE_URL` set. Existing databases should run the migration command only; applied versions are recorded in `schema_migrations`.

Telemetry is pull-based for custom metrics: scrape `GET /metrics`. OpenTelemetry auto-instrumentation exports traces only when an OTLP endpoint is configured.

## Web (`packages/web/src/server/config.ts`, `packages/web/src/auth.ts`)

| Variable                            | Required | Default            | Behavior                                                         |
| ----------------------------------- | -------- | ------------------ | ---------------------------------------------------------------- |
| `AUTH_SECRET`                       | Yes      | None               | Auth.js session secret.                                          |
| `AUTH_MICROSOFT_ENTRA_ID_ID`        | Yes      | None               | Microsoft Entra ID client ID.                                    |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET`    | Yes      | None               | Microsoft Entra ID client secret.                                |
| `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` | Yes      | None               | Tenant ID; also builds the issuer URL in `auth.ts`.              |
| `DATABASE_URL`                      | Yes      | None               | Used by persona resolver and dashboard data handlers.            |
| `ANTHROPIC_API_KEY`                 | No       | unset              | If unset, `/app/api/chat` returns 503 and does not call a model. |
| `PAGE_AGENT_MAX_STEPS`              | No       | `5` in handler     | Max AI SDK tool steps; config accepts 1-10.                      |
| `PAGE_AGENT_THINKING_BUDGET_TOKENS` | No       | `12000` in handler | Anthropic extended thinking budget; config accepts 1024-64000.   |

`loadWebConfig()` fails fast with `E-CFG02` when required values are missing or invalid. The module does not validate at import time, so `next build` does not need secrets.

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

- `GITHUB_TOKEN` is read directly in `packages/server/src/index.ts` for the GitHub token provider fallback.
- Web chat records cost through `PgCostGuard` as agent `WEB-CHAT` with a daily limit configured in route code.
