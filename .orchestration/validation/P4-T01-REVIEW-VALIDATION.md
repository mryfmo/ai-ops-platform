# P4-T01-REVIEW Validation — PR #228 at `76b262f`

- reviewer: codex-deep-dot
- initial_reviewed_at: 2026-08-14T21:14:23+09:00
- round_2_reviewed_at: 2026-08-15T00:42:31+09:00
- pull_request: https://github.com/mryfmo/ai-ops-platform/pull/228
- base: `da14ca282198e60dd15584597f954f241cbd8648`
- initial head: `ff91857e204dfe56dde94bc2de86d29ec3b60aca`
- exact head: `76b262f72d10453122dcbf4c0082c11236c60261`
- result: **revise — Round 2 has 1 high / 3 medium / 1 low open findings**

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

---

## 9. Round-2 GitHub exact-head state

GitHub CLI was used before local inspection.

```text
PR=https://github.com/mryfmo/ai-ops-platform/pull/228
base=da14ca282198e60dd15584597f954f241cbd8648
head=76b262f72d10453122dcbf4c0082c11236c60261
commits=ff91857,76b262f
reviewDecision=REVIEW_REQUIRED
reviewThreads=0
build-test=SUCCESS run=31800452150 job=94766942721
gitleaks=SUCCESS run=31800452150 job=94766942663
CodeRabbit=SUCCESS
```

The PR description was not refreshed for Round 2. It still says blocklist
scanning, 6 gateway tests / 37 total tests, the original unauthenticated-only
smoke, “production configuration,” and an unqualified Apache-2.0 single-image
claim. The Round-2 comment does not replace the full PR body required by the
repository's gh-first workflow.

## 10. Round-2 focused and full checks

```text
$ node --test contracts/mcp-gateway/gateway-config.test.mjs
tests=9 pass=9 fail=0

$ mise run contracts
tests=40 pass=40 fail=0

$ git diff --check origin/main...HEAD
(no output; exit 0)

$ bash -n deploy/agentgateway/smoke.sh
(no output; exit 0)

$ pnpm exec prettier --check <Round-2 supported files>
All matched files use Prettier code style!
```

The full contracts count is 40, not the 37 still stated in the PR body and the
initial report section.

## 11. Original mutation replay

The four Round-1 mutations were replayed in memory against exact head:

```text
REJECTED: allow-all CEL — deny-all sentinel mismatch
REJECTED: generic LLM route — routes must contain exactly the A2A marker
REJECTED: external UI — unexpected top-level ui
REJECTED: wrong issuer — canonical platform binding mismatch
```

Result: findings 001-003 are resolved for the governed configuration.

The exact-head normal runtime smoke was independently rerun and exited 0:

```text
Configuration is valid!
OK: /healthz/ready
OK: /metrics
OK: POST /mcp -> 401
OK: GET /a2a -> 401
OK: POST /v1/chat/completions -> 404
OK: GET /v1/models -> 404
OK: GET /ui -> 404
OK: synthetic target exposes synthetic_echo when called directly
OK: authenticated tools/list via gateway is empty (denied tools filtered)
OK: authenticated tools/call synthetic_echo denied by mcpAuthorization
SMOKE PASS: ...@sha256:efd79355...
```

## 12. Authenticated-smoke false-positive probe

An isolated detached worktree changed only
`smoke-fixture.config.yaml` target port from 8931 to 8932. The real synthetic
target remained on 8931. A separate decoy server on 8932 implemented MCP
initialize, returned zero tools for `tools/list`, and returned an unknown-tool
error for `tools/call`.

The repository fixture contract accepted the drift:

```text
$ node -e 'validateSmokeFixture()'
{ syntheticTargetCount: 1 }
```

The full two-phase smoke also exited 0 with the same claimed evidence:

```text
smoke-mcp-target listening on :8931
OK: synthetic target exposes synthetic_echo when called directly
OK: authenticated tools/list via gateway is empty (denied tools filtered)
OK: authenticated tools/call synthetic_echo denied by mcpAuthorization
SMOKE PASS: ...@sha256:efd79355...
```

Actual wiring in this run:

```text
direct probe -> 127.0.0.1:8931 -> real synthetic_echo target
gateway      -> 192.168.64.1:8932 -> decoy with zero tools
```

Therefore the current assertions do not prove that the tool observed directly
is the tool filtered by the gateway. The decoy and temporary worktree were
stopped/removed after the probe; no product file changed.

`SMOKE_HOST_ADDR` is assigned at `smoke.sh:114` but never used. The fixture
hardcodes `192.168.64.1`, so the documented override and generic
docker-compatible claim are not implemented.

## 13. Allowed-shape value mutations

The structural allowlist is substantially improved, but these exact-head
mutations were still accepted:

```text
ACCEPTED: config.tracing.otlpEndpoint=https://attacker.invalid:4317
ACCEPTED: readinessAddr=127.0.0.1:1 and statsAddr=0.0.0.0:80
ACCEPTED: changed A2A directResponse.bodyExpression
ACCEPTED: deployment posture gateway port=9999 and external otlp_endpoint
```

The checker requires non-empty values and known keys but does not pin them or
cross-check `config.yaml` against `deployment.yaml`. The external OTLP case is
the security-relevant counterexample: it changes the telemetry egress boundary
while the check still reports the reviewed posture.

## 14. Governance, scope, and claim checks

- The task, README, deployment metadata, and Round-2 report correctly disclose
  that the configuration is non-enabled and the P4/license gate is OPEN.
- No binding Owner/Security ruling closing or explicitly amending that gate is
  present. The public PR body was not narrowed and still makes the original
  production/license claims. Finding 004 remains open.
- Contrary to the Round-2 commit/report statement, the PR still changes
  `packages/traceability/output/traceability_matrix.md:3` only from the base
  timestamp to `2026-08-14T12:26:10.961Z`. Finding 005 remains open.
- Round-2 commit `76b262f` additionally adds the unrelated future task files
  `.orchestration/tasks/P4-T02-registry-generator.md` and
  `.orchestration/tasks/P4-T03-opa-decision-client.md` (178 lines total). They
  were untracked before this fix commit, are absent from the PR body, and are
  not P4-T01 deliverables.

## 15. Round-2 conclusion

Resolved: P4-T01-001, P4-T01-002, P4-T01-003.

Open: P4-T01-004 (high), P4-T01-005 (low), P4-T01-006 (medium),
P4-T01-007 (medium), P4-T01-008 (medium).

Verdict: **revise**.
