# Package Reference

## `@aiops/shared`

- `src/clients/*`: Graph, GitHub, Anthropic, Claude Agent SDK, and PostgreSQL cost guard clients. Clients accept injected fetch/db dependencies where tests need it.
- `src/periodBuckets.ts`: period range resolution and PM event/snapshot aggregation.
- `src/reporting/*`: standard report schema, slots-only prompt/schema, validation, metrics finalization, and truncation.
- `src/xlsxImport/*`: Excel template, parser, import engine, and CLI template generator.
- `src/secretSanitizer.ts`: shared sanitizer for DB/log/LLM-bound content.

## `@aiops/prjops`

- `src/lib/*`: deterministic PrjOps logic, including status judgment, reminders, permission filtering, Seven Keys, investor metrics, and issue/action burndown.
- `src/agents/*`: AGT-01 through AGT-07 orchestration wrappers.
- `src/templates/*`: profile report and weekly summary HTML generation.
- `src/data/*`: sample YAML data used by tests/examples; production Web route wiring does not yet load a prjops-data repository.

## `@aiops/devops`

- `src/lib/*`: build classification, deploy state machine, DORA metrics, risk score, false-positive rules, incident burndown, JIT expiry, and report permission filtering.
- `src/agents/*`: AGT-ORCH/BLD/DEP/INC/CHG/RPT/SEC.
- `src/db/schema.sql`: PostgreSQL schema source of truth.
- `src/workflows/*`: workflow definitions such as deployment and workflow-failure triage.

## `@aiops/server`

- `src/http/app.ts`: Hono route composition.
- `src/http/routes/*`: health, Graph/GitHub webhooks, coding task confirmation/callback, xlsx import, and WebUI proxy.
- `src/db/*Repo.ts`: PostgreSQL repositories for events, channel messages, Graph subscriptions, coding tasks, import ledger, PM time series, and audit log.
- `src/scheduler/tasks/*`: polling, subscription renewal, JIT revocation, health check, and PM snapshot reconcile tasks.
- `src/index.ts`: composition root. It creates clients/repos/tasks and starts the server.

## `@aiops/web`

- `src/app/api/*`: Next.js route handlers for health, chat, and data APIs.
- `src/server/reportData/*`: persona-aware data handlers and deterministic dashboard data builders.
- `src/server/chat/*`: AI SDK page-agent handler, system prompt, and persona-scoped tools.
- `src/components/views/*`: Executive Seven Keys, manager summary, investor report, and agent activity views.
- `src/components/DashboardClient.tsx`: client-side view switching, period selection, timeseries fetch, and PageAgentPanel integration.

## `@aiops/traceability`

- `src/verifyTraceability.ts`: validates spec ID references in implementation/tests, report header guards, and ADR reference existence.
- `spec-ids/*.json`: ID indexes by system namespace.
- `output/traceability_matrix.md`: generated verification output tracked in the repository.
