# Page Agent Tools

The page agent exposes tools in [`packages/web/src/server/chat/tools.ts`](../../packages/web/src/server/chat/tools.ts). Tools return `ViewSpec` only; they do not return metrics or table rows. `DashboardClient` fetches real data from `/app/api/data/*` for implemented views.

## ViewSpec Kinds

| ViewSpec                                             | DashboardClient behavior                         |
| ---------------------------------------------------- | ------------------------------------------------ |
| `{ kind: "executiveSummary" }`                       | Fetches `/app/api/data/executive-summary`.       |
| `{ kind: "managerSummary", periodDays? }`            | Fetches `/app/api/data/manager-summary`.         |
| `{ kind: "investorSummary" }`                        | Fetches `/app/api/data/investor-summary`.        |
| `{ kind: "timeseries", period }`                     | Fetches `/app/api/data/timeseries`.              |
| `{ kind: "projectList" }`                            | Fetches `/app/api/data/projects`.                |
| `{ kind: "agentActivity" }`                          | Fetches `/app/api/data/agent-activity`.          |
| `{ kind: "projectBoard", projectId: "PJ-<digits>" }` | No data endpoint is implemented; see limitation. |

## Tools

| Tool names                                         | Input                                                            | Returned ViewSpec                         | Visibility                            |
| -------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------- | ------------------------------------- |
| `listProjects`, `show_projects_table`              | `{}`                                                             | `{ kind: "projectList" }`                 | All resolved personas.                |
| `show_project_board`                               | `{ projectId: "PJ-<at least 3 digits>" }`                        | `{ kind: "projectBoard", projectId }`     | All resolved personas; scope-checked. |
| `show_timeseries`                                  | `{ period: "week" \| "month" \| "quarter" \| "half" \| "year" }` | `{ kind: "timeseries", period }`          | All resolved personas.                |
| `showExecutiveSummary`, `show_seven_keys`          | `{}`                                                             | `{ kind: "executiveSummary" }`            | PrjOps `PRF-04` only.                 |
| `showManagerSummary`, `show_burndown`, `show_dora` | `{ periodDays?: 7 \| 14 \| 28 }`                                 | `{ kind: "managerSummary", periodDays? }` | PrjOps `PRF-03` and DevOps `PRF-G`.   |
| `showAgentActivity`                                | `{}`                                                             | `{ kind: "agentActivity" }`               | DevOps `PRF-G` only.                  |
| `showInvestorSummary`, `show_investor_kpis`        | `{}`                                                             | `{ kind: "investorSummary" }`             | Investor persona only.                |

## Persona Matrix

| Persona                    | Projects | Project Board | Timeseries | Seven Keys | Manager/Burndown/DORA | Agent Activity | Investor KPI |
| -------------------------- | -------- | ------------- | ---------- | ---------- | --------------------- | -------------- | ------------ |
| PrjOps `PRF-01` / `PRF-02` | yes      | yes           | yes        | no         | no                    | no             | no           |
| PrjOps `PRF-03`            | yes      | yes           | yes        | no         | yes                   | no             | no           |
| PrjOps `PRF-04`            | yes      | yes           | yes        | yes        | no                    | no             | no           |
| DevOps `PRF-M` / `PRF-L`   | yes      | yes           | yes        | no         | no                    | no             | no           |
| DevOps `PRF-G`             | yes      | yes           | yes        | no         | yes                   | yes            | no           |
| Investor                   | yes      | yes           | yes        | no         | no                    | no             | yes          |

## Current Project Board Limitation

`show_project_board` validates a canonical `PJ-###` identifier and the current persona's project scope before returning a `projectBoard` ViewSpec. The tool is currently exposed, but `DashboardClient` has no project-board data endpoint and returns `E-VIEW02: project board data endpoint is not available`. ADR-0018 requires the tool to be hidden until the read-only board path is implemented.

## Chat Runtime

- Auth and persona resolution happen before tool construction.
- If `ANTHROPIC_API_KEY` is unset, `/app/api/chat` returns 503.
- The model is called with step cap `PAGE_AGENT_MAX_STEPS` or 5 and Anthropic thinking budget `PAGE_AGENT_THINKING_BUDGET_TOKENS` or 12000. `temperature` is intentionally omitted because Anthropic extended thinking is not compatible with non-default temperature settings.
- Chat refusal is surfaced by AI SDK as `finishReason: "content-filter"` after the streaming response has started, so it becomes an `E-LLM-REFUSAL` UI stream error event rather than a pre-stream HTTP status.
- The system prompt forbids the assistant from inventing numeric values in prose.
