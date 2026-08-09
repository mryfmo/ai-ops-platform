# Test Strategy

## 1. 目的

「型が通る」「mockが返る」だけでなく、既存要件、durable execution、認可、外部副作用、AI worker isolation、復旧可能性を証明する。

## 2. Test layers

| Layer | Scope | Network | Gate |
|---|---|---:|---|
| Static | lint/type/actionlint/schema/traceability/fitness | no | every PR |
| Unit | pure lib、policy helper、state machine、sanitizer | no | every PR |
| Contract | OpenAPI/AsyncAPI/MCP/tool/model/schema | local/fake | every contract change |
| Integration | PostgreSQL、Temporal test env、OPA、gateway containers | local containers | component PR |
| Replay | Temporal histories and worker upgrade | local/staging | every workflow change |
| Security negative | auth/OBO/prompt injection/tool poisoning/secrets | mixed | security-relevant PR |
| External sandbox E2E | M365/Work IQ/Bedrock/Anthropic/Plane/GitHub/Confluence/Wispr | yes | before enablement |
| Load/resilience | 100PJ/2,000 recipients, gateways, DB, failover | staging | release |
| DR/restore | DB, config, policy, workflows, object mapping | staging/DR | release/quarterly |

## 3. Golden paths

1. Meeting: event → Wispr note → Claude structure → human review → Plane/GitHub/Confluence/SharePoint.
2. Coding task: Teams/Web → approval → Temporal → runner → branch/PR → CI → human merge.
3. Incident: telemetry → correlation → RCA → repair PR → human deployment → SLO recovery → postmortem.
4. Report: scheduled workflow → deterministic metrics → LLM text slot → validation → approval → delivery.
5. M365 query: delegated user → OBO → Work IQ → permission-trimmed sources → policy-minimized LLM handoff.

## 4. Required negative paths

- duplicate event, stale signal, timeout after successful write
- revoked user/token, cross-tenant issuer, wrong audience
- policy unavailable, gateway unavailable, provider 429/5xx
- prompt injection in every external source
- MCP schema/tool mutation
- branch protection bypass attempt
- secret in prompt/log/PR
- side-effect retry and exactly-once illusion
- workflow replay after code/version change

## 5. Evidence rules

- A test name includes spec/AC/gate ID.
- External E2E records time, actor, environment, input hash, expected/actual, trace ID, result URL.
- Sensitive content is hashed/redacted; never store bearer tokens or meeting full text in test artifacts.
- Skipped tests are failures for production gate unless Owner-approved ENV defer exists.

## 6. Definition of Done

`mise run ci` remains mandatory. Additional commands are added as packages mature:

```bash
mise run contracts
mise run temporal:replay
mise run policy:test
mise run gateway:conformance
mise run e2e:sandbox
mise run security:negative
mise run release:readiness
```
