<!-- 根拠: FinalArch:NFR-SEC-001 / FinalArch:NFR-SEC-003 / FinalArch:GOV-003 / ADR-0022 / ADR-0023 -->

# P0-T09 Learning

## Validated learning

- Credential completeness requires distinguishing durable credentials from
  workflow-local aliases and disposable test-only values; otherwise one value
  is counted twice or a production credential is silently omitted.
- A no-master-key rule needs a residue table by runtime location, not only a
  target architecture statement. The table makes runner, client, broker, and
  provider boundaries independently reviewable.
- Break-glass is safe only when it preserves classification, provider, policy,
  audit, and human-approval gates. An availability exception must not become a
  generic MCP, OPA, or authorization bypass.
- Rotation order must preserve overlap for ordinary changes while explicitly
  forbidding reuse of a credential suspected of compromise.

## Apply to

- P1/P2 identity contracts and CI residue checks.
- P2 LiteLLM virtual-key issuance and direct-provider egress removal.
- P4 agentgateway/OPA conformance tests and P5 Work IQ OBO partitioning.
- P8 runner token mint/revoke cleanup and P10 Key Vault/RBAC provisioning.

