# P4-T01-REVIEW Validation — PR #228 at `ff91857`

- reviewer: codex-deep-dot
- reviewed_at: 2026-08-14T21:14:23+09:00
- pull_request: https://github.com/mryfmo/ai-ops-platform/pull/228
- base: `da14ca282198e60dd15584597f954f241cbd8648`
- exact head: `ff91857e204dfe56dde94bc2de86d29ec3b60aca`
- result: **revise — 4 high / 1 low findings**

## 1. GitHub exact-head state

`gh pr view 228 --json ...`:

```text
state=OPEN draft=false mergeable=MERGEABLE reviewDecision=REVIEW_REQUIRED
headRefOid=ff91857e204dfe56dde94bc2de86d29ec3b60aca
baseRefOid=da14ca282198e60dd15584597f954f241cbd8648
build-test=SUCCESS run=31795968717 job=94753048270
gitleaks=SUCCESS run=31795968717 job=94753048093
CodeRabbit=SUCCESS
reviews=0 reviewThreads=0
```

The PR has one commit and 12 changed files. No GitHub review, approval, merge,
comment, or branch mutation was performed.

## 2. Baseline focused verification

```text
$ mise run contracts
# tests 37
# pass 37
# fail 0

$ git diff --check origin/main...HEAD
(no output; exit 0)

$ pnpm exec prettier --check <supported changed files>
All matched files use Prettier code style!

$ bash -n deploy/agentgateway/smoke.sh
(no output; exit 0)

$ rg <private-key/token/client-secret patterns> <changed files>
(no matches)
```

An initial Prettier command included `smoke.sh` and failed only because Prettier
has no shell parser. The supported files were rerun successfully and shell
syntax was checked with `bash -n`.

## 3. Repository-contract live mutations

The exact-head checker was imported from an isolated detached worktree. Each
mutation was made in memory against the governed YAML and passed to
`validateGatewayConfig()`:

```text
ACCEPTED: allow-all CEL
ACCEPTED: generic /v1/chat/completions proxy
ACCEPTED: externally attached management UI
ACCEPTED: unreviewed identity provider
```

Mutation shapes:

```yaml
# authorization relaxation
mcp.policies.mcpAuthorization.rules: ["true"]

# LLM-equivalent generic route without an `llm` or `ai` key
routes:
  - name: generic-http-proxy
    gateways: default
    matches:
      - path:
          pathPrefix: /v1/chat/completions
    backends:
      - host: api.openai.com:443

# management UI attached to the gateway despite adminAddr=off
ui:
  gateways: default

# identity drift accepted by the repository checker
issuer: https://attacker.invalid
audiences: [attacker-audience]
jwks:
  url: https://attacker.invalid/jwks.json
```

## 4. Exact vendor binary mutation probe

A combined temporary config used the allow-all CEL, generic HTTP route,
gateway-attached UI, and unreviewed issuer/audience with an ephemeral local
public JWKS. It contained no private key. The exact pinned image accepted it:

```text
$ container run --rm --volume <stage>:/etc/agentgateway:ro \
    ghcr.io/agentgateway/agentgateway:v1.4.1@sha256:efd79355b89094a8225a9db465d9a01dc656b377f0bab458761b935a13231d29 \
    -f /etc/agentgateway/config.yaml --validate-only
Configuration is valid!
```

The same config was booted and probed:

```text
GET  /                         -> 308
GET  /ui                      -> 200 text/html
POST /v1/chat/completions     -> 400 text/html
GET  /healthz/ready (:15021)  -> 200 text/plain
```

The 400 is material because the governed config returns 404 for this path: the
generic backend route exists and intercepted the request. The review container
was removed immediately after the probe.

A JWKS URL at `attacker.invalid` caused vendor validation to attempt the fetch
and fail. Repeating with the same attacker issuer/audience and the ephemeral
local JWKS succeeded. This establishes that vendor validation checks schema and
resource loadability, not the platform's approved trust-domain values.

## 5. Vendor v1.4.1 source verification

The official `v1.4.1` tag resolves to commit
`163ea2146acb7b82082acea30ed691b29079095f`. The source was checked out at that
exact commit.

- `crates/agentgateway/src/mcp/rbac.rs:51-58`: no rules short-circuit to allow;
  configured rules are evaluated.
- `crates/agentgateway/src/mcp/handler.rs:713-727`: `tools/list` results are
  filtered through the MCP authorization set.
- `crates/agentgateway/src/mcp/session.rs:519-609`: list and tool-call paths use
  the merged authorization policy.
- `crates/agentgateway-app/src/commands/run.rs:110-136`: `--validate-only`
  parses configuration, reads local config resources, and normalizes them.
- `crates/agentgateway/src/types/local.rs:357-394,1287-1322`: the vendor schema
  supports reusable backends, route groups, generic HTTP routes/backends, and
  gateway-attached UI independently of the `llm`/`ai` keys.

Conclusion: the report is correct about the current `false` rule's vendor
behavior, but the repository gate and smoke do not preserve or exercise it.

## 6. Supply-chain verification

Official release metadata:

```text
release=https://github.com/agentgateway/agentgateway/releases/tag/v1.4.1
published_at=2026-07-29T21:48:46Z
tag_commit=163ea2146acb7b82082acea30ed691b29079095f
```

Local image inspection of the exact reference:

```text
index_digest=sha256:efd79355b89094a8225a9db465d9a01dc656b377f0bab458761b935a13231d29
media_type=application/vnd.oci.image.index.v1+json
created=2026-07-29T21:46:28Z
oci.version=v1.4.1
oci.revision=163ea2146acb7b82082acea30ed691b29079095f
oci.source=https://github.com/agentgateway/agentgateway
oci.licenses=Apache-2.0
runtime_user=65532
```

The digest exists, provenance is internally consistent, and the release is
more than 24 hours old. These facts do not close the repository's still-open
dependency/SBOM, Apache NOTICE, OPA, registry, and approval gates.

## 7. Canon and scope checks

- ADR-0023 and the component spec assign MCP/A2A to agentgateway and LLM
  routing to LiteLLM. The current exact config follows that split; the contract
  does not preserve it under the proven generic-route mutation.
- MCP-001 is blocking and requires `OPA/gateway tests` plus `unknown tool
  denied`. An unauthenticated 401 is not that evidence.
- P4 entry requires agentgateway/OPA exact pins and the MCP registry. The P0
  baseline decision and license register keep agentgateway/OPA notice and
  dependency approval OPEN before P4 entry.
- `packages/traceability/output/traceability_matrix.md` is outside the task's
  allowed paths and changes only a generated timestamp.

## 8. Review hygiene

- `.ua/knowledge-graph.json` was absent; exact merge-base diff and direct
  schema/consumer tracing were used instead. No `.ua` artifact was written.
- The existing untracked P4-T02/P4-T03 task files, `.pnpm-store/`, and reference
  archive were not modified.
- Only the two review artifacts authorized by P4-T01-REVIEW were added.
- `make require-crit-review` was attempted as required by `AGENTS.md`, but this
  repository has no such Make target (`No rule to make target`).
