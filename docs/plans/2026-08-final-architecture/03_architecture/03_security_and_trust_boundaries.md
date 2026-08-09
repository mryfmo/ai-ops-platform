# Security / Trust Boundary Architecture

## Trust boundaries

1. User device / Teams / browser
2. Entra-authenticated Control API
3. Temporal workflow and workers
4. LiteLLM inference boundary
5. agentgateway tool boundary
6. External SaaS / Microsoft 365 / model providers
7. GitHub Runner execution boundary
8. Systems of Record

## Identity

- Human requests: Entra stable subject + tenant + project/persona scope。
- Work IQ: delegated/OBO only。
- Graph background: dedicated app identity + selected/scoped permissions。
- Temporal worker: workload identity。
- LiteLLM client: short-lived/scoped virtual key。
- Bedrock: STS role。
- GitHub: GitHub App installation token。
- AI Runner: job-scoped token and virtual key。

## Authorization order

```text
Platform source permission
  AND project/resource mapping
  AND OPA policy
  AND agentgateway tool/resource policy
  AND operation-specific approval
```

どれか一つがdeny/unknownならfail closed。

## Data handling

- Contentには`classification`, `source_trust`, `prompt_injection_status`, `retention_class`, `allowed_destinations`を付ける。
- 外部コンテンツ内の「命令」はtool権限を変更しない。
- Work IQからの情報をLLMへ渡す前にpurpose-limited extractionを行う。
- Prompt、document、transcript本文をOTel span attributeへ入れない。

## MCP threat controls

- Remote Streamable HTTPを原則。
- server discovery結果をallowlistとhashで検証。
- tool schema変化はCI/registry approvalを要求。
- OAuth audience/resource binding、PKCE、state、nonce、token exchangeを検証。
- SSRF防止: DNS/IP/redirect/URL allowlist。
- token passthrough禁止。
- response size/time/tool call depthを制限。
- high-risk toolは存在させない。

## AI Runner controls

- `persist-credentials: false`
- ephemeral filesystem/worktree
- no provider master key
- path allowlist enforcement before and after agent run
- `.git`, workflow, CODEOWNERS, security policy等の変更は別承認taskだけ許可
- agent outputをcommit前にsecret scan、dependency diff、policy check
- reviewerはwriterと異なるmodel/session
