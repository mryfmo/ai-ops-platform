# Page Agent Tools

The page agent exposes tools in [`packages/web/src/server/chat/tools.ts`](../../packages/web/src/server/chat/tools.ts). Tools return `ViewSpec` only; they do not return metrics or table rows. `DashboardClient` fetches real data from `/app/api/data/*`.

## ViewSpec Kinds

| ViewSpec                                  | Fetch path used by DashboardClient |
| ----------------------------------------- | ---------------------------------- |
| `{ kind: "executiveSummary" }`            | `/app/api/data/executive-summary`  |
| `{ kind: "managerSummary", periodDays? }` | `/app/api/data/manager-summary`    |
| `{ kind: "investorSummary" }`             | `/app/api/data/investor-summary`   |
| `{ kind: "timeseries", period? }`         | `/app/api/data/timeseries`         |
| `{ kind: "projectList" }`                 | `/app/api/data/projects`           |
| `{ kind: "agentActivity" }`               | `/app/api/data/agent-activity`     |

## Tools

| Tool names                                         | Input                                                             | Returned ViewSpec                         | Visibility                          |
| -------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------- | ----------------------------------- |
| `listProjects`, `show_projects_table`              | `{}`                                                              | `{ kind: "projectList" }`                 | All resolved personas.              |
| `show_timeseries`                                  | `{ period?: "week" \| "month" \| "quarter" \| "half" \| "year" }` | `{ kind: "timeseries", period? }`         | All resolved personas.              |
| `showExecutiveSummary`, `show_seven_keys`          | `{}`                                                              | `{ kind: "executiveSummary" }`            | PrjOps `PRF-04` only.               |
| `showManagerSummary`, `show_burndown`, `show_dora` | `{ periodDays?: 7 \| 14 \| 28 }`                                  | `{ kind: "managerSummary", periodDays? }` | PrjOps `PRF-03` and DevOps `PRF-G`. |
| `showAgentActivity`                                | `{}`                                                              | `{ kind: "agentActivity" }`               | DevOps `PRF-G` only.                |
| `showInvestorSummary`, `show_investor_kpis`        | `{}`                                                              | `{ kind: "investorSummary" }`             | Investor persona only.              |

## Persona Matrix

| Persona         | Projects | Timeseries | Seven Keys | Manager/Burndown/DORA | Agent Activity | Investor KPI |
| --------------- | -------- | ---------- | ---------- | --------------------- | -------------- | ------------ |
| PrjOps `PRF-04` | yes      | yes        | yes        | no                    | no             | no           |
| PrjOps `PRF-03` | yes      | yes        | no         | yes                   | no             | no           |
| DevOps `PRF-G`  | yes      | yes        | no         | yes                   | yes            | no           |
| Investor        | yes      | yes        | no         | no                    | no             | yes          |

## Chat Runtime

- Auth and persona resolution happen before tool construction.
- If `ANTHROPIC_API_KEY` is unset, `/app/api/chat` returns 503.
- The model is called with step cap `PAGE_AGENT_MAX_STEPS` or 5 and Anthropic thinking budget `PAGE_AGENT_THINKING_BUDGET_TOKENS` or 12000. `temperature` is intentionally omitted because Anthropic extended thinking is not compatible with non-default temperature settings.
- Chat refusal is detected after the streaming response has started, so it is surfaced as an `E-LLM-REFUSAL` UI stream error event rather than a pre-stream HTTP status.
- The system prompt forbids the assistant from inventing numeric values in prose.
