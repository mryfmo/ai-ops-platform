# Owner Decision Register

| ID | Decision | Options | Default proposal | Required approvers | Deadline/Phase |
|---|---|---|---|---|---|
| ENV-DEC-001 | Temporal production profile | Cloud / AKS OSS | Cloud + Azure workers | Owner, Security, Ops, Procurement | P0 |
| ENV-DEC-002 | CopilotKit Intelligence | managed / self-managed adapter | managed pilot | M365, Security, Legal | P0/P7 |
| ENV-DEC-003 | Work IQ scope | read-only / draft / CRUD | read/ask/fetch | M365 Admin, Security, Data Owner | P5 |
| ENV-DEC-004 | Wispr meeting classes | deny/all/allowlist | allowlisted internal technical | Security, Legal, Data Owner | P6 |
| ENV-DEC-005 | Anthropic direct egress | none/internal/expanded | public+internal only | Security, Legal, AI Platform | P2 |
| ENV-DEC-006 | Confluence | adopt / no adopt | technical pilot | Knowledge Owner, Procurement | P6 |
| ENV-DEC-007 | Droid production | disabled / enabled | disabled until E2E | GitHub Owner, Security | P8 |
| ENV-DEC-008 | Work IQ via agentgateway | through gateway / direct adapter exception | gateway if OBO conformant | Security, M365 | P5 |
| ENV-DEC-009 | OpenTag fork scope | full / channel-only | channel/UI only | Product, Security | P7 |
| ENV-DEC-010 | Temporal/ledger retention | per workflow class | proposed in NFR | Records Owner, Ops | P3/P10 |

| ENV-DEC-011 | GitHub plan upgrade for branch protection | upgrade / alternative controls | upgrade (P0-T02 hard prerequisite; current plan returned 403 — audit T-P0-08 / D-06) | Owner, Procurement | P0 |
| ENV-DEC-012 | 内部用語リスト（V-B）内容確定（旧 D-14） | populate / defer | operator-owned; empty-seed + startup warn until populated | Owner, Security | P6 |
| ENV-DEC-013 | プロファイル別報告のプロダクト範囲（旧 D-15） | keep contracts / standardize to 3-slot | contracts preserved-unwired in shared/reporting | Owner, Product | P6 |
| ENV-DEC-014 | GitHub code scanning 有効化（旧 D-16、TH-001 critical 入力） | enable / defer | fail-closed skip until enabled | Owner, Security | P8 |

### 記録済み Owner 裁定（2026-08-10）

- baseline-delta（`.orchestration/plan/2026-08-10-pack-adversarial-review/02-baseline-delta.md`）
  A〜E 承認。PROC-01 は**案A**: Claude-writer タスクは Claude 自身が専用 worktree + PR で実装し、
  Codex が独立レビューする（one-writer/two-model 維持）。

未決定項目をLLMが推測して実装してはならない。default proposalは意思決定を促すための提案であり、承認済み値ではない。
