# ギャップ分析

| ID | 現状 | 目標 | 対応Phase | 証明方法 |
|---|---|---|---|---|
| GAP-001 | direct Anthropic SDK/API key | LiteLLM logical model aliases | P2 | provider contract + canary + no-direct-egress test |
| GAP-002 | server内scheduler | Temporal durable workflows | P3 | worker restart/approval wait/duplicate prevention test |
| GAP-003 | tool接続が個別client | agentgateway MCP/A2A | P4 | registry, allowlist, auth, audit conformance |
| GAP-004 | policyがコードへ分散 | OPA decision contract | P4 | policy unit tests + deny-path E2E |
| GAP-005 | M365 intelligenceがGraphのみ | Work IQ delegated read/ask + Graph system path | P5 | OBO/permission trimming/data boundary test |
| GAP-006 | Teams command UI | OpenTag-derived conversational rich UI | P7 | real tenant mention/thread/card/HITL E2E |
| GAP-007 | Web dashboard中心 | capability-scoped Workbench | P7 | workspace/capability/sandbox boundary test |
| GAP-008 | meeting workflowなし | Wispr→review→SoR publication | P6 | meeting correlation/publication idempotency E2E |
| GAP-009 | Droid disabled | Droid writer/reviewer path | P8 | pinned CLI, isolated runner, PR-only E2E |
| GAP-010 | coding tasks direct provider secret | LiteLLM virtual key | P8 | key scope/expiry/budget/rotation test |
| GAP-011 | audit lacks model/tool/policy receipt | unified correlation ledger | P1/P4 | trace completeness query |
| GAP-012 | Azure ADR but IaC evidence不足 | Bicep + staged apply evidence | P9 | build/what-if/apply/smoke/rollback evidence |
| GAP-013 | branch unprotected | protected main + CODEOWNERS + required checks | P0 | GitHub API evidence + negative push/merge probe |
| GAP-014 | exact provider model IDs in app config | logical aliases + provider binding | P2 | config schema + provider swap test |
| GAP-015 | no protocol compatibility gates | pinned MCP/Work IQ/LLM conformance | P4/P5 | compatibility test matrix |
