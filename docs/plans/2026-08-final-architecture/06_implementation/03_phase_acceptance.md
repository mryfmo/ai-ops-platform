# Phase Acceptance Gates

各Phaseは、コードの存在ではなく、下表の証跡が揃ったときだけexitする。

| Phase | Entry criteria | Exit evidence | STOP / fail criteria |
|---|---|---|---|
| P0 | baseline commitのcheckout、disposable DB、Owner/Security参加 | branch protection証跡、ADR-0020..0028、ENV decision、現行CI baseline | main保護なし、baseline failure未分類、法務/データ境界未決 |
| P1 | P0承認 | versioned contracts、new packages skeleton、ledger migration、fitness checks | 契約が実装より後、spec IDなし、migration rollbackなし |
| P2 | LiteLLM exact pin、Bedrock/Anthropic test tenants | 全LLM consumerがlogical alias/virtual key、shadow equivalence、cost/OTel | direct provider key残存、unknown fallback、classification bypass |
| P3 | Temporal profile決定、namespace/worker setup | workflow history/replay、approval signals、scheduler shadow一致、crash recovery | nondeterministic workflow、double side effect、replay failure |
| P4 | agentgateway/OPA exact pin、MCP registry | default deny、read-only pilot、tool risk enforcement、prompt-injection tests | high-risk tool公開、token passthrough、policy fail-open |
| P5 | Work IQ tenant/license/OBO承認 | delegated query with source refs、Graph app-only separation、classification egress gate | app-only Work IQ、tenant issuer mismatch、restricted egress |
| P6 | Wispr/Confluence/SharePoint contracts承認 | meeting matching/review/publication、no duplicate SoR、retention evidence | 会議同意不明、全文の無制限複製、未承認formal publish |
| P7 | Control API stable、Teams environment | Teams thread continuity、HITL、Workbench capability isolation、mobile/Japanese E2E | UIがSoR化、tenant-wide ambient access、stale approval |
| P8 | branch protection、runner isolation、gateway credentials | Claude and Droid PR-only、one writer lock、Codex independent review、negative secret tests | main push/auto merge、shared provider key、Droid unpinned |
| P9 | OTel semantic conventions/correlation contract | incident workflow、RCA evidence links、repair PR、no auto production mutation | telemetry gaps、AI-only severity、unapproved remediation |
| P10 | all prior exits | Azure IaC、canary、restore/DR、load/security、release board approval | mock-only evidence、rollback untested、unowned alerts/budget |


## 証跡の保存規則

- 自動テスト: CI run URL、commit SHA、command、result、artifact checksum。
- 外部E2E: tenant/subscription/resource IDはsecretを除き記録。実行日時、actor、対象、expected/actualを残す。
- 設定画面: screenshotだけでなくAPI/CLI出力も保存する。
- negative test: 「拒否された」ことを成功証跡として残す。
- 手動承認: approver、basis、version、timestamp、decision、commentをappend-only ledgerへ記録する。
- ENV-blocked項目はgreen扱いにせず、`blocked`と責任者・期限を明記する。
