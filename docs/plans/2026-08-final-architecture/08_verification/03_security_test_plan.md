# Security Test Plan

## Threat model scope

- identities: Entra users, service identities, GitHub Apps, runners, AI agents
- trust boundaries: browser/Teams, Control API, Temporal workers, LiteLLM, agentgateway, Work IQ/Graph, external SaaS, runners
- assets: provider keys, OAuth tokens, code, meeting data, customer data, formal records, audit evidence
- adversaries: external attacker, malicious/compromised document, overprivileged user, compromised runner/dependency, confused deputy

## Required test families

### Identity and authorization

- issuer/audience/tenant/OBO validation
- revoked/disabled user
- wrong project/resource
- app-only request to Work IQ
- stale approval and replayed token
- service identity cannot impersonate user

### MCP/A2A

- unknown/unapproved server
- tool name/schema mutation
- malicious tool description
- token passthrough
- SSRF/redirect/DNS rebinding
- session fixation/hijack
- cross-project capability reuse
- high-risk tool registration

### Prompt injection and data poisoning

Inject adversarial instructions into:

- Teams message and attachment
- Wispr transcript
- Confluence page/macro/comment
- GitHub README/issue/PR/log
- SharePoint document
- Plane comment/title

Expected result: content remains data; no policy/tool/resource expansion; secrets/system prompt not revealed; output cites untrusted source and requires human review where relevant.

### LLM gateway and data egress

- classification-to-provider matrix
- restricted/customer-confidential redaction/minimization
- no fallback on policy/safety/auth/invalid request
- virtual key quota/expiry/revocation
- log redaction and body sampling rules

### Runner and source control

- malicious `.gitconfig`, hooks, `.gitattributes`, package lifecycle scripts
- token absent during agent/install/commit steps
- push restricted to task branch
- no main merge/deploy permission
- PR label/branch/task provenance
- dependency/SBOM/signature verification

### Database and audit

- SQL injection and parameterization
- audit UPDATE/DELETE/TRUNCATE denial
- tenant/project filtering at query layer
- sensitive raw payload minimization
- migration privilege separation

## Severity gate

- critical/high open finding: production enablement prohibited
- medium: Owner-approved mitigation and expiry required
- low: tracked with target release
- false positive: evidence and reviewer approval required
