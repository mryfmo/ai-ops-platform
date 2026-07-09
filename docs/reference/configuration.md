# Configuration Reference

## Server (`packages/server/src/config.ts`)

| Variable                      | Required | Default | Behavior                                                                                                                                                        |
| ----------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                        | No       | `8080`  | Hono listen port.                                                                                                                                               |
| `WEBUI_INTERNAL_PORT`         | No       | `3100`  | Internal Next.js upstream for `/app/*` proxy.                                                                                                                   |
| `DATABASE_URL`                | Yes      | None    | PostgreSQL connection string.                                                                                                                                   |
| `GRAPH_CLIENT_STATE`          | Yes      | None    | Microsoft Graph notification `clientState`; minimum length 32.                                                                                                  |
| `GITHUB_WEBHOOK_SECRET`       | Yes      | None    | GitHub webhook HMAC secret; minimum length 32.                                                                                                                  |
| `GRAPH_CLIENT_ID`             | Yes      | None    | Microsoft Graph client credentials.                                                                                                                             |
| `GRAPH_CLIENT_SECRET`         | Yes      | None    | Microsoft Graph client credentials.                                                                                                                             |
| `GRAPH_TENANT_ID`             | Yes      | None    | Microsoft Graph tenant.                                                                                                                                         |
| `PUBLIC_BASE_URL`             | Yes      | None    | Public URL used for Graph notification URL and WebUI deep links.                                                                                                |
| `ANTHROPIC_API_KEY`           | No       | unset   | Enables LLM fallback paths that receive a configured client.                                                                                                    |
| `GITHUB_PROJECT_NODE_ID`      | No       | unset   | When set, PM snapshot reconcile reads GitHub Projects v2. When unset, reconcile writes `pm_snapshot_reconcile_disabled` audit records and returns no snapshots. |
| `CODING_TASK_CALLBACK_SECRET` | Yes      | None    | HMAC key for confirmation tokens and bearer secret for coding task callback; minimum length 32.                                                                 |

`loadConfig()` fails fast with `E-CFG01` when required values are missing or invalid.

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

| Variable              | Required | Default                   | Used By                                                                                               |
| --------------------- | -------- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `REPORT_COMPLETED`    | No       | `0`                       | `calculateReportMetrics.ts`                                                                           |
| `REPORT_BLOCKED`      | No       | `0`                       | `calculateReportMetrics.ts`                                                                           |
| `REPORT_EVIDENCE_IDS` | No       | `REQ-040`                 | `finalizeReportJson.ts`                                                                               |
| `PERIOD_LABEL`        | No       | `scheduled weekly period` | `finalizeReportJson.ts`                                                                               |
| `REPORT_TYPE`         | No       | `weekly-summary`          | `finalizeReportJson.ts`; allowed values are `weekly-summary`, `manager-weekly`, `investor-quarterly`. |

## Runtime Notes

- `GITHUB_TOKEN` is read directly in `packages/server/src/index.ts` for the GitHub token provider fallback.
- Web chat records cost through `PgCostGuard` as agent `WEB-CHAT` with a daily limit configured in route code.
