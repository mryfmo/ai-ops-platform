# WBS Task Summary

Total tasks: **113**

## Writer distribution

- `claude-code-fable5-xhigh`: 58
- `codex-gpt56-sol-high`: 55

## Phase summary

| Phase | Name | Tasks |
|---|---|---:|
| P0 | Baseline and governance | 10 |
| P1 | Contracts and scaffolding | 8 |
| P2 | LiteLLM inference plane | 10 |
| P3 | Temporal control plane | 13 |
| P4 | agentgateway and OPA | 12 |
| P5 | Work IQ and Graph | 10 |
| P6 | Meeting and knowledge | 11 |
| P7 | Teams and Web Workbench | 10 |
| P8 | AI coding agents | 10 |
| P9 | AIOps and observability | 9 |
| P10 | Infrastructure and release | 10 |

## Tasks

### P0 — Baseline and governance

| ID | Writer | Reviewer | Risk | Gates | Title |
|---|---|---|---|---|---|
| P0-T01 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | GOV-001 | Revalidate repository baseline |
| P0-T02 | claude-code-fable5-xhigh | codex-gpt56-sol-high | critical | GOV-002 | Enable and prove main branch protection |
| P0-T03 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | GOV-003 | Add final architecture ADR set and spec IDs |
| P0-T04 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | GOV-004, GOV-005 | Implement architecture fitness checks |
| P0-T05 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | GOV-001 | Capture performance and reliability baseline |
| P0-T06 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | GOV-003 | Inventory licenses and external terms |
| P0-T07 | claude-code-fable5-xhigh | codex-gpt56-sol-high | high | GOV-003 | Decide Temporal production profile |
| P0-T08 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | GOV-004, GOV-005 | Define feature-flag and kill-switch contract |
| P0-T09 | codex-gpt56-sol-high | claude-code-fable5-xhigh | high | GOV-003 | Define secret and identity migration plan |
| P0-T10 | claude-code-fable5-xhigh | codex-gpt56-sol-high | critical | GOV-001, GOV-002, GOV-003, GOV-004, GOV-005 | Owner baseline gate |

### P1 — Contracts and scaffolding

| ID | Writer | Reviewer | Risk | Gates | Title |
|---|---|---|---|---|---|
| P1-T01 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | CON-001 | Create control-plane package scaffold |
| P1-T02 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | CON-001, CON-002 | Create integrations package scaffold |
| P1-T03 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | CON-004, CON-005 | Create policy package and OPA bundle scaffold |
| P1-T04 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | CON-001, CON-002, CON-004, CON-005 | Add versioned Control API and event contracts |
| P1-T05 | claude-code-fable5-xhigh | codex-gpt56-sol-high | high | CON-003 | Add ledger migrations and repositories |
| P1-T06 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | CON-001, CON-002 | Implement shared correlation context |
| P1-T07 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | CON-002 | Extend OpenTelemetry conventions |
| P1-T08 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | CON-001, CON-002, CON-003, CON-004, CON-005 | Add contract and architecture gates to CI |

### P2 — LiteLLM inference plane

| ID | Writer | Reviewer | Risk | Gates | Title |
|---|---|---|---|---|---|
| P2-T01 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | LLM-002 | Create platform-owned model alias manifest |
| P2-T02 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | LLM-001, LLM-003 | Deploy LiteLLM private service configuration |
| P2-T03 | claude-code-fable5-xhigh | codex-gpt56-sol-high | high | LLM-002, LLM-003 | Implement Bedrock short-lived identity path |
| P2-T04 | codex-gpt56-sol-high | claude-code-fable5-xhigh | high | LLM-002, LLM-003 | Implement Anthropic controlled credential path |
| P2-T05 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | LLM-001, LLM-004 | Refactor shared Anthropic client to gateway transport |
| P2-T06 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | LLM-001, LLM-004, LLM-006 | Migrate server LLM consumers |
| P2-T07 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | LLM-001, LLM-004 | Migrate Web AI SDK provider |
| P2-T08 | codex-gpt56-sol-high | claude-code-fable5-xhigh | high | LLM-001, LLM-003 | Migrate Claude Code action credentials |
| P2-T09 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | LLM-002, LLM-004, LLM-005 | Run synthetic dual-path conformance |
| P2-T10 | claude-code-fable5-xhigh | codex-gpt56-sol-high | critical | LLM-001, LLM-002, LLM-003, LLM-005, LLM-006 | Cut over and deny direct provider egress |

### P3 — Temporal control plane

| ID | Writer | Reviewer | Risk | Gates | Title |
|---|---|---|---|---|---|
| P3-T01 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | TMP-001 | Provision Temporal namespace and worker connectivity |
| P3-T02 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | TMP-001, TMP-003 | Implement workflow/activity base contracts |
| P3-T03 | claude-code-fable5-xhigh | codex-gpt56-sol-high | high | TMP-002 | Implement approval child workflow |
| P3-T04 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | TMP-003, TMP-004 | Implement CodingTaskWorkflow |
| P3-T05 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | TMP-003 | Implement Graph subscription workflow |
| P3-T06 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | TMP-003 | Implement JIT expiry and health workflows |
| P3-T07 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | TMP-003 | Implement report delivery workflow |
| P3-T08 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | TMP-003 | Implement Plane reconcile/promotion workflows |
| P3-T09 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | TMP-003 | Shadow existing scheduler against Temporal |
| P3-T10 | claude-code-fable5-xhigh | codex-gpt56-sol-high | high | TMP-005 | Cut over scheduler functions incrementally |
| P3-T11 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | TMP-001, TMP-004 | Run durable execution chaos suite |
| P3-T12 | claude-code-fable5-xhigh | codex-gpt56-sol-high | high | TMP-001, TMP-002, TMP-003, TMP-004, TMP-005, TMP-006 | Retire migrated in-process loops |
| P3-T13 | claude-code-fable5-xhigh | codex-gpt56-sol-high | high | TMP-003, TMP-005 | Migrate approved-deploy and prod-monitor loops to Temporal workflows |

### P4 — agentgateway and OPA

| ID | Writer | Reviewer | Risk | Gates | Title |
|---|---|---|---|---|---|
| P4-T01 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | MCP-001 | Deploy agentgateway in MCP/A2A-only mode |
| P4-T02 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | MCP-001, MCP-004 | Implement registry generator and schema hash gate |
| P4-T03 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | MCP-002 | Implement OPA decision client and bundle |
| P4-T04 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | MCP-001 | Integrate gateway with OPA and action ledger |
| P4-T05 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | MCP-004 | Onboard GitHub read-only MCP |
| P4-T06 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | MCP-001, MCP-006 | Onboard Plane read/draft MCP |
| P4-T07 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | MCP-002 | Onboard Confluence read/draft MCP |
| P4-T08 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | MCP-003 | Onboard Wispr read-only MCP |
| P4-T09 | codex-gpt56-sol-high | claude-code-fable5-xhigh | critical | MCP-005 | Implement prompt-injection/tool-confusion defenses |
| P4-T10 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | MCP-006 | Implement tool result size/time/depth limits |
| P4-T11 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | MCP-001, MCP-003, MCP-004 | Create MCP operations dashboard and audit queries |
| P4-T12 | claude-code-fable5-xhigh | codex-gpt56-sol-high | critical | MCP-001, MCP-002, MCP-003, MCP-004, MCP-005, MCP-006 | Complete MCP production gate |

### P5 — Work IQ and Graph

| ID | Writer | Reviewer | Risk | Gates | Title |
|---|---|---|---|---|---|
| P5-T01 | claude-code-fable5-xhigh | codex-gpt56-sol-high | high | WIQ-001, WIQ-005 | Define Work IQ Entra/OBO application contract |
| P5-T02 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | WIQ-001, WIQ-005 | Implement Work IQ REST read/ask client |
| P5-T03 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | WIQ-002 | Implement Control API delegated M365 endpoint |
| P5-T04 | codex-gpt56-sol-high | claude-code-fable5-xhigh | high | WIQ-002 | Validate Work IQ MCP through agentgateway |
| P5-T05 | claude-code-fable5-xhigh | codex-gpt56-sol-high | high | WIQ-003 | Choose direct or gateway Work IQ production path |
| P5-T06 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | WIQ-003 | Separate Graph system integration interfaces |
| P5-T07 | codex-gpt56-sol-high | claude-code-fable5-xhigh | critical | WIQ-004 | Implement M365 data routing policy |
| P5-T08 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | WIQ-001, WIQ-002, WIQ-005 | Implement source reference and permission-trim evidence |
| P5-T09 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | WIQ-003 | Enable read/ask feature flags for pilot users |
| P5-T10 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | WIQ-001, WIQ-002, WIQ-003, WIQ-004, WIQ-005 | Document CRUD/A2A deferred gate |

### P6 — Meeting and knowledge

| ID | Writer | Reviewer | Risk | Gates | Title |
|---|---|---|---|---|---|
| P6-T01 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | MTG-001 | Implement Wispr meeting adapter |
| P6-T02 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | MTG-001 | Implement meeting correlation engine |
| P6-T03 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | MTG-002 | Implement structured meeting extraction |
| P6-T04 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | MTG-003 | Implement meeting review UI |
| P6-T05 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | MTG-003 | Implement Plane publication activity |
| P6-T06 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | MTG-004 | Implement GitHub publication activity |
| P6-T07 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | MTG-003 | Implement Confluence publication activity |
| P6-T08 | claude-code-fable5-xhigh | codex-gpt56-sol-high | high | MTG-002, MTG-004 | Implement SharePoint formal publication activity |
| P6-T09 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | MTG-005 | Implement MeetingWorkflow and partial-failure handling |
| P6-T10 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | MTG-001, MTG-002, MTG-003, MTG-004, MTG-005 | Plan and execute Notion meeting-note retirement |
| P6-T11 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | ING-001 | Implement PrjOps status ingest pipeline (A054, REQ-004/005, PrjOps:SPEC-INT-030) |

### P7 — Teams and Web Workbench

| ID | Writer | Reviewer | Risk | Gates | Title |
|---|---|---|---|---|---|
| P7-T01 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | UX-001 | Scaffold channel-teams package |
| P7-T02 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | UX-001 | Implement identity/thread/workflow mapping |
| P7-T03 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | UX-001 | Implement mention and subscribed-thread flow |
| P7-T04 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | UX-002 | Implement rich result components |
| P7-T05 | claude-code-fable5-xhigh | codex-gpt56-sol-high | high | UX-003 | Implement approval cards and Temporal signal |
| P7-T06 | codex-gpt56-sol-high | claude-code-fable5-xhigh | critical | UX-003, UX-005 | Complete CopilotKit Intelligence security gate |
| P7-T07 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | UX-003 | Add Workbench workspace data model |
| P7-T08 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | UX-004 | Add capability grants to Workbench |
| P7-T09 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | UX-005 | Add Teams-to-Workbench handoff |
| P7-T10 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | UX-001, UX-002, UX-003, UX-004, UX-005 | Implement typed Gadget/ViewSpec phase |

### P8 — AI coding agents

| ID | Writer | Reviewer | Risk | Gates | Title |
|---|---|---|---|---|---|
| P8-T01 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | COD-003 | Define machine-readable agent task manifest |
| P8-T02 | codex-gpt56-sol-high | claude-code-fable5-xhigh | critical | COD-001, COD-004 | Implement pre/post path boundary guard |
| P8-T03 | claude-code-fable5-xhigh | codex-gpt56-sol-high | high | COD-002, COD-004 | Issue scoped LiteLLM runner credentials |
| P8-T04 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | COD-003 | Harden Claude Code execution profile |
| P8-T05 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | COD-005 | Enable Droid execution profile |
| P8-T06 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | COD-006 | Implement Codex independent review job |
| P8-T07 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | COD-001, COD-002 | Implement writer-reviewer handoff state |
| P8-T08 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | COD-004, COD-005 | Add agent execution evidence callback |
| P8-T09 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | COD-001, COD-002, COD-003, COD-004, COD-005, COD-006 | Add budget/concurrency/kill switch |
| P8-T10 | claude-code-fable5-xhigh | codex-gpt56-sol-high | critical | COD-001, COD-002, COD-003, COD-004, COD-005, COD-006 | Run full two-model PR lifecycle |

### P9 — AIOps and observability

| ID | Writer | Reviewer | Risk | Gates | Title |
|---|---|---|---|---|---|
| P9-T01 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | AIO-001 | Propagate OTel across new components |
| P9-T02 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | AIO-002 | Implement policy/model/tool decision receipts |
| P9-T03 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | AIO-003 | Implement IncidentWorkflow |
| P9-T04 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | AIO-004 | Implement incident context collectors |
| P9-T05 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | AIO-005 | Implement RCA and repair PR generation |
| P9-T06 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | AIO-001 | Implement SLO recovery gate |
| P9-T07 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | AIO-003, AIO-004 | Publish Runbook and postmortem outputs |
| P9-T08 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | AIO-001, AIO-002, AIO-003, AIO-004, AIO-005 | Create operations dashboards and alerts |
| P9-T09 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | AIO-006 | Implement incident similarity datastore (A053, DevOps:SPEC-INT-030) |

### P10 — Infrastructure and release

| ID | Writer | Reviewer | Risk | Gates | Title |
|---|---|---|---|---|---|
| P10-T01 | claude-code-fable5-xhigh | codex-gpt56-sol-high | medium | REL-001 | Implement AWS Terraform module structure |
| P10-T02 | claude-code-fable5-xhigh | codex-gpt56-sol-high | critical | REL-001, REL-002 | Implement private networking and egress policy |
| P10-T03 | claude-code-fable5-xhigh | codex-gpt56-sol-high | critical | REL-001 | Implement identity and secret provisioning |
| P10-T04 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | REL-001 | Implement database roles/schemas/backups |
| P10-T05 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | REL-003 | Implement deployment pipelines and provenance |
| P10-T06 | codex-gpt56-sol-high | claude-code-fable5-xhigh | critical | REL-004 | Execute end-to-end security verification |
| P10-T07 | codex-gpt56-sol-high | claude-code-fable5-xhigh | medium | REL-005 | Execute performance and load verification |
| P10-T08 | claude-code-fable5-xhigh | codex-gpt56-sol-high | critical | REL-006 | Execute backup/restore/DR rehearsal |
| P10-T09 | claude-code-fable5-xhigh | codex-gpt56-sol-high | critical | REL-007 | Run staged pilot and rollback drill |
| P10-T10 | claude-code-fable5-xhigh | codex-gpt56-sol-high | critical | REL-001, REL-002, REL-003, REL-004, REL-005, REL-006, REL-007, REL-008 | Go-live and close migration paths |

