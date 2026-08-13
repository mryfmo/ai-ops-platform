# P3-T01-REVIEW — PR #197 approved at `a3513de`

```yaml
task_id: P3-T01-REVIEW
reviewer: codex-deep-dot
reviewed_at: 2026-08-13T08:48:24+09:00
re_reviewed_at: 2026-08-13T10:02:07+09:00
round_3_reviewed_at: 2026-08-13T10:46:45+09:00
round_4_reviewed_at: 2026-08-13T11:02:13+09:00
round_5_reviewed_at: 2026-08-13T11:13:59+09:00
round_6_reviewed_at: 2026-08-13T11:26:06+09:00
pull_request: https://github.com/mryfmo/ai-ops-platform/pull/197
canonical_amendment_pull_request: https://github.com/mryfmo/ai-ops-platform/pull/198
base_sha: 78c3af519fea6433a86d9eac68446ef571b94b63
initial_head_sha: ea47757aa93ef166ad681c66e41c26d1055c5236
canonical_amendment_head_sha: 03d0a4054e7a67739a88622aacd051dd7a5e74a1
round_2_head_sha: 86eabb5ae08da03e4066ebfe634e09ccfe8c6ba0
head_sha: a3513ded8790d6b7c35026caea5c398fd5ebfbdd
verdict: approve
summary: >-
  PR 198 remains approved. Round 6 explicitly amends the task scope for the
  necessary @swc/core build-script deny entry and restores it without allowing
  script execution. The authoritative clean GitHub build-test is green; all
  findings P3-T01-001 through P3-T01-013 are resolved.
```

## Findings

### P3-T01-001 — high — the worker certificate is environment-wide and retains namespace, task-queue, and admin authority

- Location: `deploy/temporal/certs/gen-certs.sh:9-12,54-56`;
  `packages/control-plane/src/lib/temporalProfile.ts:44-69,117-135`;
  `deploy/temporal/smoke-client.mjs:23-103`
- ENV-DEC-001 requires an individual identity per worker, constrained by a
  Temporal authorizer/claim mapper to environment + namespace + task queue and
  non-admin operations (`docs/decisions/ENV-DEC-001-temporal-production-profile.md:46-58`).
  The canonical WBS correspondingly requires denial outside all three scopes
  and for admin/operator APIs
  (`docs/plans/2026-08-final-architecture/06_implementation/02_wbs.yaml:875-883`).
- The implementation instead issues one generic
  `aiops-temporal-worker.<env>` certificate, gives every profile every task
  queue, and checks only the certificate's environment and generic CN. There is
  no server authorizer/claim mapper. A same-environment holder can bypass the
  factory, as the smoke itself does with `Connection.connect()`, and invoke
  another namespace, any task queue, or administrative APIs. The smoke never
  exercises those canonical denial cases; its successful worker
  `describeNamespace` call actually demonstrates an administrative/read scope
  available to the generic worker.
- The task file's disclosed config-only limitation does not resolve the
  contradiction: the runbook promises an unnumbered future P3 task, while the
  current WBS still marks these denials as P3-T01 verification. Client metadata
  and naming conventions are not an authorization boundary.
- Required correction: implement and test server-side claim enforcement with
  distinct worker identities scoped to one namespace/task queue and denied
  operator APIs. If this is intentionally deferred, first obtain an explicit
  Owner-approved change to ENV-DEC-001/WBS with a concrete tracked task and do
  not claim `worker identity scoped` for P3-T01.

### P3-T01-002 — high — the Fargate task references certificate files that are never provisioned

- Location: `deploy/aws/temporal/main.tf:22-35,81-115`
- Terraform creates empty Secrets Manager resources, but the task definition
  injects only `POSTGRES_PWD`. It defines no volume, init/sidecar, entrypoint, or
  task secret references that can create `/etc/temporal/certs/ca.crt`,
  `server.crt`, and `server.key`. Lines 104-105 explicitly defer that essential
  step to P10. The submitted Fargate service therefore starts with nonexistent
  TLS paths and cannot satisfy the P3-T01 Fargate + Secrets Manager deliverable.
- The working smoke also required the pinned auto-setup image's frontend cert,
  client CA, CLI/operator cert, and internode TLS variables
  (`deploy/temporal/smoke.sh:59-73`); the task definition omits them. Static
  `terraform validate` cannot detect either runtime failure.
- Required correction: make the task definition consume the certificate
  secrets and materialize them before Temporal starts, include the complete
  tested TLS environment, and leave a rendered/task-start check proving all
  referenced paths exist without embedding secret values in Terraform state.

### P3-T01-003 — high — the production service has no worker-resolvable endpoint or RDS network path

- Location: `deploy/aws/temporal/main.tf:38-61,118-132`;
  `deploy/aws/temporal/variables.tf:17-35,50-63`
- An `awsvpc` Fargate task receives a replaceable private IP. The module creates
  no internal load balancer, Cloud Map service, DNS record, service-connect
  endpoint, or output that resolves the certificate name
  `aiops-temporal-frontend.<env>`. Consequently workers have no stable
  `host:7233` address that can both reach the task and pass hostname validation.
- The module accepts only `db_host`; it accepts no RDS security-group identifier
  and creates no RDS ingress from `aws_security_group.temporal`. In a
  security-group-isolated RDS baseline, the task cannot reach PostgreSQL.
- Required correction: provision the smallest internal discovery endpoint that
  matches the server certificate and wire its address to workers; explicitly
  establish the Temporal-SG-to-RDS-SG 5432 path (in this module or a named
  baseline interface) and validate both directions in the integration contract.

### P3-T01-004 — medium — the Temporal task has unrestricted egress despite its stated boundary

- Location: `deploy/aws/temporal/main.tf:54-60`
- The egress rule is described as "RDS and AWS APIs" but permits every protocol
  and port to `0.0.0.0/0`. On a private subnet with NAT, a compromised Temporal
  task can reach arbitrary Internet destinations; this is materially broader
  than the documented RDS/Secrets Manager/CloudWatch dependencies.
- Required correction: restrict database traffic to the RDS security group and
  use scoped VPC endpoints/endpoint security groups for required AWS services,
  or document and approve the broader egress trust boundary before apply.

### P3-T01-005 — medium — Terraform dependency and image pins are not enforced reproducibly

- Location: `deploy/aws/.gitignore:1-2`;
  `deploy/aws/temporal/main.tf:7-15`;
  `deploy/aws/temporal/variables.tf:45-48`
- `.terraform.lock.hcl` is explicitly ignored. Independent `terraform init
  -backend=false` selected AWS provider 5.100.0 from the broad `~> 5.60`
  constraint and warned that the generated lock file should be committed to
  guarantee the selection. Future CI or operators can therefore validate/apply
  a different provider build.
- `temporal_image` only describes an immutable digest; it has no validation that
  rejects a mutable tag. ADR-0029's immutable-image control is therefore
  optional at the production trust boundary.
- Required correction: commit the module lock file/checksums and stop ignoring
  it; validate `temporal_image` as an `@sha256:<64 hex>` reference.

## Re-review at `86eabb5`

### Disposition of original findings

- `P3-T01-001`: partially resolved. Per-env TLS plus the default JWT authorizer
  now proves namespace and admin denial, and PR #198 legitimately moves
  task-queue scope out of the server model. The replacement task-queue client
  guard is not implemented; see `P3-T01-006`.
- `P3-T01-002`: resolved. The Fargate task consumes server TLS material via the
  image's native `*_DATA` variables and supplies the server-side TLS/auth
  configuration exercised by the smoke.
- `P3-T01-003`: resolved for Cloud Map and RDS. A stable private DNS endpoint and
  reciprocal RDS security-group rule now exist. The separate VPC-endpoint path
  remains incomplete; see `P3-T01-008`.
- `P3-T01-004`: partially resolved. The unrestricted `0.0.0.0/0` rule is gone,
  but the endpoint-SG half of the replacement path is absent; see
  `P3-T01-008`.
- `P3-T01-005`: resolved. The AWS provider lock/checksums are committed and both
  container image variables reject non-digest references.

### P3-T01-006 — high — the claimed task-queue client guard stores a queue but never enforces it

- Location: `packages/control-plane/src/lib/temporalProfile.ts:44-88`;
  `packages/control-plane/src/temporal/connection.ts:37-62`;
  `deploy/temporal/smoke-client.mjs:80-98`
- PR #198's amendment explicitly makes task-queue scope the responsibility of
  worker deployment configuration plus a client-side fail-closed guard. The new
  builder validates a canonical queue and stores it in `profile.taskQueue`, but
  that field has no production consumer. Repository-wide symbol inspection at
  the exact head finds it only in the builder and tests. The connection factory
  returns an unrestricted raw `Connection`; it neither creates a Worker nor
  checks Worker options. A caller can build an `incident` profile and poll any
  other canonical or arbitrary queue with the returned connection.
- The same gap exists for the per-worker identity: any nonblank, valid worker
  token can be paired with a profile for another `workerName`, while the
  factory emits the profile's spoofable metadata. It never establishes that the
  JWT `sub` is `aiops-temporal-worker.<env>.<workerName>`.
- The nine-item smoke does not create or poll a Worker, so it cannot prove queue
  configuration or queue mismatch rejection.
- Required correction: expose the smallest Worker-construction/config seam that
  derives namespace, task queue, and identity only from the validated profile
  (callers must not be able to override them), bind the JWT subject to the
  profile before connection, and add a negative check proving a different queue
  or worker token is rejected before polling/connection.

### P3-T01-007 — high — every long-running worker loses authorization after 12 hours

- Location: `deploy/temporal/authz/mint-token.mjs:27-41`;
  `packages/control-plane/src/temporal/connection.ts:17-25,37-50`
- Minted tokens expire after 12 hours, but `TemporalMtlsCredentials` accepts
  only a static string and passes that string to `Connection.connect`. No token
  provider, refresh, reconnect, or rotation path exists in the factory or
  runbook. A continuously running worker therefore starts receiving
  authentication failures at `exp` and remains down until its process is
  restarted with a newly minted token.
- Temporal TypeScript SDK 1.22.0 already supports `apiKey` as a callback and
  evaluates it for each RPC, so no new abstraction/dependency is needed:
  <https://github.com/temporalio/sdk-typescript/blob/v1.22.0/packages/client/src/connection.ts>.
- Required correction: accept an injected token provider/callback, pass the
  callback through to the SDK, document who mints and distributes renewed
  staging/prod tokens without exposing the signing key to workers, and leave a
  test that changes the returned token without rebuilding the connection.

### P3-T01-008 — medium — the VPC-endpoint security-group path is only configured outbound

- Location: `deploy/aws/temporal/main.tf:99-124`;
  `deploy/aws/temporal/variables.tf:68-71`
- The Temporal SG allows TCP 443 egress to
  `vpc_endpoints_security_group_id`, but no reciprocal ingress rule is added to
  that endpoint SG. Unlike the RDS path immediately below it, the module does
  not establish both halves of the SG-to-SG connection. A least-privilege
  endpoint SG therefore rejects Secrets Manager/ECR/CloudWatch traffic, so ECS
  cannot fetch task secrets/images or deliver logs.
- ADR-0029 also requires production images to come from Amazon ECR; the module
  accepts digest-pinned references from any registry even though arbitrary
  registries are unreachable through the declared endpoint-only egress.
- Required correction: add endpoint-SG ingress from the Temporal SG (or make an
  explicit baseline contract that proves it already exists), and require or
  document ECR-mirrored image references consistent with the network path.

### P3-T01-009 — medium — the startup runbook no longer executes its own API

- Location: `deploy/temporal/RUNBOOK.md:47-80`
- The compose instructions generate only certificates, not the required
  `authz/out/dev/public/jwks.json`, so a clean `docker compose up` starts the
  JWKS service without its input. The Worker example still calls the removed
  two-argument `buildConnectionProfile` API and omits the now-required
  `authorizationToken`; it fails TypeScript compilation instead of connecting.
- The staging/prod section also lacks concrete secret-population, JWT issuance/
  renewal, namespace initialization, and ECR image inputs, despite those being
  prerequisites of the submitted Terraform task.
- Required correction: make the dev sequence generate authz material, update
  the example to the exact current profile/credential API, and document the
  minimum staging/prod bootstrap and rotation commands/ownership.

## Round 3 at `56cc322`

### Disposition of round-2 findings

- `P3-T01-006`: resolved. `createScopedWorker()` derives connection,
  namespace, task queue, and identity from the profile, rejects override keys,
  binds the initial JWT subject/permissions, and is exercised against the live
  mTLS/JWT server. The smoke reaches `RUNNING`; because no workflows are
  registered it does not poll workflow tasks, but its registered activity does
  use the single profile queue.
- `P3-T01-007`: partially resolved. Native workers now have a validated
  `refreshWorkerAuthorization()` seam, but the client callback can bypass
  validation after connection and the operational refresh is not invoked or
  documented. See `P3-T01-010` and the still-open `P3-T01-009`.
- `P3-T01-008`: resolved. The endpoint SG now accepts 443 from the Temporal SG,
  and both image inputs require an ECR digest reference.
- `P3-T01-009`: not resolved. The dev/bootstrap additions are useful, but the
  connection example and rotation handoff remain non-executable as described
  below.

### P3-T01-010 — high — rotated client tokens bypass the profile binding guard

- Location: `packages/control-plane/src/temporal/connection.ts:40-64,67-82`;
  `packages/control-plane/tests/temporalProfile.test.ts:250-273`
- `createTemporalConnection()` validates the provider's initial token, then
  passes the original `authorizationTokenProvider` directly as the SDK
  `apiKey` callback. The SDK evaluates that raw callback for every later RPC;
  `validateTokenProvider()` is never called again. After connection, the
  provider can change from the validated `w1 / aiops-dev:write` token to a
  valid `w2` token, an extra-permission token, an expired token, or an empty
  value. The client sends it while retaining `aiops-worker-identity: ...w1`.
- The new rotation test covers only a second valid token for the same subject
  and asserts that it is returned raw, so it codifies the bypass rather than
  testing fail-closed rotation. Server signature/namespace enforcement does not
  restore the promised per-worker subject-to-profile binding or audit identity.
- Required correction: pass a validating wrapper as `apiKey`, for example a
  callback that calls `validateTokenProvider(profile, credentials, now)` for
  every RPC. Add post-connect rotation cases for mismatched subject, foreign or
  admin permissions, expiry, and blank tokens, proving none is returned to the
  SDK.

### P3-T01-009 — medium — the startup/rotation runbook still cannot use the submitted API

- Location: `deploy/temporal/RUNBOOK.md:74-106`
- The Worker example still imports `createTemporalConnection`, calls the
  removed two-argument `buildConnectionProfile("dev", address)`, and omits
  `authorizationTokenProvider`. It does not import or call
  `createScopedWorker()`, so it neither compiles nor demonstrates the amended
  task-queue guard.
- The staging/prod section says a pipeline writes a new token to a
  `worker-token` secret, but Terraform does not create that secret and the
  runbook never explains how a running worker reloads it or calls
  `refreshWorkerAuthorization()` before the 12-hour expiry. Adding the helper
  without an invocation leaves the original long-running-worker outage path.
- Required correction: replace the example with the exact current profile,
  token-provider, and scoped-worker API; name the owner/storage contract for
  the worker token; and show the refresh loop/event that reloads the token and
  calls `refreshWorkerAuthorization()` before expiry without distributing the
  signing key.

### P3-T01-011 — medium — round 3 changes a root file outside the task boundary

- Location: `pnpm-workspace.yaml:33`
- The task file permits `deploy/temporal/**`, `deploy/aws/**`, and
  `packages/control-plane/**`, with an explicit exception for the exact-pinned
  Temporal dependency's package/lock changes. It does not permit the root
  `pnpm-workspace.yaml`. Round 3 adds `@swc/core: false` there without a task
  amendment. The frozen install and live Worker smoke pass, so this is not a
  functional failure, but accepting it would bypass the orchestration edit
  boundary.
- Required correction: obtain an explicit task-file/Owner authorization for
  this root dependency-policy change, or remove it if the exact Worker install
  and CI remain green without it.

### P3-T01-012 — low — the PR description still describes the previous head

- Location: pull-request description
- The description still says head `86eabb5`, 16 tests, a nine-item smoke, and
  lists only findings 001-005. It does not mention `@temporalio/worker`, the
  1,127-line lockfile delta, or findings 006-009. The earlier assertion that the
  lockfile changes only add `@temporalio/client` is now false.
- Required correction: refresh the full PR description for head `56cc322`, 22
  tests, the 11-item matrix, all three review rounds, and the complete current
  dependency/lockfile scope.

## Independent validation

### Initial round at `ea47757`

- Exact diff reviewed: base `78c3af519fea6433a86d9eac68446ef571b94b63`
  through head `ea47757aa93ef166ad681c66e41c26d1055c5236` (16 changed files).
- `pnpm --filter @aiops/control-plane run test`: pass, 3 files / 16 tests.
- `pnpm --filter @aiops/control-plane run typecheck`: pass.
- `pnpm --filter @aiops/control-plane run lint`: pass.
- `terraform init -backend=false`, `terraform fmt -check -diff`, and
  `terraform validate`: pass; init exposed the missing committed lock file.
- `./deploy/temporal/smoke.sh`: pass with the exact pinned image; all four
  implemented environment/no-cert checks pass.
- `mise run ci` against fresh disposable PostgreSQL databases: exit 0.
- `shellcheck deploy/temporal/certs/gen-certs.sh deploy/temporal/smoke.sh`:
  fails SC2034 because `deploy/temporal/smoke.sh:24` assigns unused
  `REPO_ROOT`. This is non-blocking but should be removed.
- `pnpm-lock.yaml` contains the expected Temporal dependency graph plus one
  unrelated Vitest peer snapshot movement from `@opentelemetry/api@1.9.0` to
  `1.9.1`; regenerate from the declared dependency change alone if the drift is
  not intentional.

### Re-review at `86eabb5` and canonical amendment `03d0a40`

- PR #198 exact four-file diff reviewed before PR #197. `shasum -c
  SHA256SUMS`: all entries pass; `validate_pack.py`: 113 WBS tasks / 64 gates /
  101 files; governance and formatting pass. The amendment itself has no
  blocking inconsistency.
- PR #197 exact diff reviewed from base through `86eabb5` (19 changed files),
  including every delta from the initial head.
- `pnpm --filter @aiops/control-plane run test`: pass, 3 files / 16 tests.
- control-plane typecheck and lint: pass.
- ShellCheck for all three changed shell scripts: pass.
- Committed-lock `terraform init -backend=false`, `terraform fmt -check -diff`,
  and `terraform validate`: pass with AWS provider 5.100.0.
- `./deploy/temporal/smoke.sh`: pass with the exact pinned Temporal image; the
  implemented nine-item mTLS/JWT allow/deny matrix passes.
- Fresh-disposable-DB `mise run ci` at exact PR #197 head: exit 0.
- GitHub `build-test` and `gitleaks` checks are green for both PR #198 and
  PR #197 at the reviewed heads.
- Temporal v1.25.2 upstream authorizer, claim mapper, role, and API metadata were
  inspected to verify that the submitted namespace `write` JWT allows worker
  poll/respond APIs while denying admin APIs:
  <https://github.com/temporalio/temporal/blob/v1.25.2/common/authorization/default_authorizer.go>,
  <https://github.com/temporalio/temporal/blob/v1.25.2/common/authorization/default_jwt_claim_mapper.go>,
  <https://github.com/temporalio/temporal/blob/v1.25.2/common/api/metadata.go>.

### Round 3 at `56cc322`

- Exact 12-file delta from `86eabb5` and complete 21-file PR diff reviewed;
  `git diff --check` passes.
- `CI=true pnpm install --frozen-lockfile`: pass; the 1,127-line lock delta is
  attributable to the exact `@temporalio/worker@1.22.0` graph plus workspace
  peer-resolution propagation, although the root allow-build edit needs scope
  authorization.
- Control-plane test/typecheck/lint: pass, 3 files / 22 tests.
- ShellCheck for all three changed scripts: pass.
- Committed-lock Terraform init/fmt/validate: pass with AWS provider 5.100.0.
- Live `./deploy/temporal/smoke.sh`: pass, all 11 reported mTLS/JWT/scoped-worker
  checks green. Cleanup leaves no task containers or generated private keys.
- Fresh-disposable-DB `mise run ci`: exit 0.
- GitHub build-test and gitleaks checks: green at `56cc322`.

## Round 4 at `6d6aad2`

### Disposition of round-3 findings

- `P3-T01-009`: resolved. The runbook now uses the submitted
  `buildConnectionProfile()` / `createScopedWorker()` APIs, invokes
  `refreshWorkerAuthorization()` on a four-hour interval, identifies token
  issuance and custody, and ties per-worker token paths to Terraform-managed
  Secrets Manager resources.
- `P3-T01-010`: resolved. `createTemporalConnection()` passes a validating
  wrapper to the SDK, so every callback evaluation rechecks subject,
  permission, expiry, and blank-token constraints. The captured-callback test
  proves one valid rotation and five fail-closed cases.
- `P3-T01-011`: **not resolved**. Commit `6d6aad2` contains no reversal for
  `pnpm-workspace.yaml`; the complete PR diff from merge-base `78c3af5` still
  adds `"@swc/core": false`, and GitHub still lists that root file among the
  21 changed files. The update's statement that this edit was reverted does
  not match the submitted tree. Restore this file to the merge-base content so
  the P3-T01 task boundary is respected.
- `P3-T01-012`: resolved. The PR description names the exact round-4 head,
  current Worker/token/Terraform behavior, 22/22 and 11/11 matrices, lockfile
  impact, review history, and the PR #198 merge dependency.

### Independent validation

- Used `gh pr view` first and pinned PR #197 to exact head
  `6d6aad2ee5731d998bba85bab4d4a1fd95c759c6`; no web search was used.
- Reviewed the complete merge-base diff and the five-file delta from round 3;
  `git diff --check` passes.
- Control-plane test/typecheck/lint: pass, 3 files / 22 tests.
- Committed-lock Terraform init/fmt/validate: pass with AWS provider 5.100.0.
- Fresh-disposable-DB `mise run ci`: exit 0. The first sandboxed attempt reached
  `pnpm audit` and failed only on blocked DNS; the network-enabled rerun passed
  audit and every remaining CI stage.
- GitHub `build-test`, `gitleaks`, and CodeRabbit contexts: green at `6d6aad2`.
- Round-3 live smoke evidence remains applicable: round 4 did not change the
  smoke, Worker factory, server, or compose paths. The exact-head unit test
  independently exercises the only connection-factory behavior changed here.
- Generated Terraform/cache artifacts and all three round-4 disposable
  databases were removed after validation.

## Round 5 at `e7a85ed`

- `P3-T01-011`: resolved. The round-5 commit contains exactly one deletion:
  the out-of-boundary `"@swc/core": false` line in `pnpm-workspace.yaml`.
- The merge-base and reviewed-head `pnpm-workspace.yaml` blob SHAs are
  identical, `git diff 78c3af5..e7a85ed -- pnpm-workspace.yaml` is empty, and
  GitHub's complete PR file list no longer includes the file.
- `git diff --check` passes; frozen install passes; control-plane tests pass,
  3 files / 22 tests.
- GitHub gitleaks and CodeRabbit contexts are green. `build-test` later failed
  during its clean dependency install; see `P3-T01-013`.

### P3-T01-013 — medium — clean CI install fails after the workspace-policy removal

- Location: `pnpm-workspace.yaml`; `packages/control-plane/package.json`;
  GitHub Actions run `31660134456`, job `94323050186`.
- The new exact `@temporalio/worker@1.22.0` dependency brings
  `@swc/core@1.15.47`. On a clean runner, pnpm 11 exits with
  `ERR_PNPM_IGNORED_BUILDS` because that dependency's build script is neither
  allowed nor explicitly denied. The job stops during install before any
  repository gate runs.
- The local frozen install passed only because the shared worktree already had
  a populated `node_modules`; it did not reproduce clean-runner lifecycle
  policy evaluation. GitHub's clean-runner failure is the authoritative result.
- The removed `allowBuilds` entry set `"@swc/core": false`, preserving the
  security boundary by explicitly denying the script while acknowledging the
  dependency. That root config is necessary for the submitted Worker SDK graph,
  but P3-T01's current `allowed_paths` excludes `pnpm-workspace.yaml`.
- Required correction: obtain an explicit Owner/task-scope amendment permitting
  this necessary `pnpm-workspace.yaml` policy entry and restore
  `"@swc/core": false`, or provide an equally canonical clean-install solution
  within an authorized path. A populated-worktree install is insufficient;
  the next exact head must pass the clean GitHub `build-test` check.

## Round 6 at `a3513de`

- `P3-T01-013`: resolved. The task file now explicitly permits the mechanical
  `pnpm-workspace.yaml` companion required by the exact Worker SDK dependency,
  cites the clean-runner failure, and records why `false` is the safe policy.
- Commit `a3513de` is a direct child of reviewed head `e7a85ed` and changes
  exactly one tracked line: it restores `"@swc/core": false`. This acknowledges
  the transitive lifecycle script while continuing to deny its execution.
- `git diff --check` passes. GitHub PR #197 is pinned to exact head
  `a3513ded8790d6b7c35026caea5c398fd5ebfbdd`.
- Authoritative clean-runner GitHub Actions run `31660464521`: `build-test`
  success in 5m56s; `gitleaks` success; CodeRabbit context success. The clean
  install passes and all subsequent build, typecheck, coverage, traceability,
  and PostgreSQL integration stages complete.
- Prior exact-code validation remains applicable because round 6 changes no
  runtime, Terraform, runbook, test, or lockfile content: control-plane 22/22,
  Terraform init/fmt/validate, fresh-DB full CI, and live smoke 11/11 are green.
- All findings `P3-T01-001` through `P3-T01-013` are resolved. Verdict: approve.

No GitHub review was submitted and no PR branch was edited, pushed, or merged.
