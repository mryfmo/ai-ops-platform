# 非機能要求

## Reliability

| ID | 要求 |
|---|---|
| NFR-REL-001 | Worker/API再起動後もin-flight workflowを再開する。 |
| NFR-REL-002 | 外部writeはidempotency/dedupe/CASまたはsingle-attempt publisherを持つ。 |
| NFR-REL-003 | MCP/LLM gateway停止時もworkflow stateとapproval stateを失わない。 |
| NFR-REL-004 | 同一meeting/action/PRを二重作成しない。 |
| NFR-REL-005 | 既存Azure availability target 99.9%、RPO/RTOはAccepted ADRを維持する。 |

## Security

| ID | 要求 |
|---|---|
| NFR-SEC-001 | Default deny、least privilege、short-lived credential、resource-scoped access。 |
| NFR-SEC-002 | productionはremote HTTP MCPのみ。stdioは署名済み・sandbox内の例外だけ。 |
| NFR-SEC-003 | provider/MCP secretsをuser device、prompt、repo、logへ保存しない。 |
| NFR-SEC-004 | Prompt Injection、confused deputy、SSRF、token passthrough、session hijackをtestする。 |
| NFR-SEC-005 | M365 label/permissionを外部送信時にもOPAで再評価する。 |
| NFR-SEC-006 | main branch protection、CODEOWNERS、required checksをgo-live前に強制する。 |

## Performance / Scale

以下は初期SLO案であり、Phase 0で実測baselineを採取して確定する。

| ID | 目標 |
|---|---|
| NFR-PERF-001 | Control API自身のp95 < 300ms（外部処理時間を除く）。 |
| NFR-PERF-002 | agentgateway追加overhead p95 < 100ms。 |
| NFR-PERF-003 | LiteLLM追加overhead p95 < 100ms。 |
| NFR-PERF-004 | Workflow start p95 < 1s。 |
| NFR-PERF-005 | 100 project、2,000 recipientsの既存性能要件を退行させない。 |
| NFR-PERF-006 | Coding agent concurrencyは初期8以下、budget/runner capacityで制御。 |

## Maintainability

- vendor configurationはversion-pinned、GitOps、schema validated。
- public contractsはSemVerとcompatibility testを持つ。
- package-local pure logic / orchestration分離を維持。
- direct vendor SDK usageをadapter外へ漏らさない。
- migrationはexpand → dual-write/read → cutover → contractの順序。

## Observability

- OTel trace/metric/logを共通correlation contextで出力。
- audit evidenceとdebug telemetryを分離。
- content本文をdefaultでtraceへ入れない。
- model/tool/policy/workflow versionを全runに付与。

## Compliance / Data

- data classification、retention、residency、source termsをmetadata化。
- Work IQ/Wispr/Confluence/Plane/GitHubの利用規約・ライセンス境界をsource registerで管理。
- Plane CEは標準API境界を維持し、AGPL改変を無断vendorしない。
