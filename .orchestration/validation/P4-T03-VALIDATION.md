# P4-T03 Validation

## Test-first Evidence

1. client unit test を実装前に追加して実行。
   - RED: 既存 Rego 3 tests は green、client 7 tests は `OpaDecisionClient is not a constructor` で失敗。
2. client と bundle 実装後に focused gates を再実行。
   - GREEN: `pnpm --filter @aiops/policy run test` — 2 files / 11 tests。
   - GREEN: `mise run policy:rego` — 16/16。

## Commands and Results

1. `mise run policy:rego`
   - PASS: 16/16。
   - missing input、未登録 tool、catalog 外 risk を deny。
   - allow / require_approval / deny 全経路で bundle version `0.1.0`。
   - `system.log.mask` は `/input` を除去。
2. `pnpm --filter @aiops/policy run test`
   - PASS: 2 test files / 11 tests。
   - allow / deny / require_approval、malformed/unknown/version drift、timeout、5xx、network、4xx no-retry を検証。
   - request は固定 content-type のみで Authorization header なし。
3. `pnpm --filter @aiops/policy run build`
   - PASS。
4. `pnpm --filter @aiops/policy run typecheck`
   - PASS。
5. `pnpm --filter @aiops/policy run lint`
   - PASS。
6. `pnpm exec prettier --check packages/policy deploy/opa`
   - PASS。
7. `bash -n deploy/opa/build-bundle.sh deploy/opa/smoke.sh`
   - PASS。
8. `./deploy/opa/build-bundle.sh`
   - PASS: revision `0.1.0`、Rego v1。
   - `opa inspect`: namespace は production `policy.rego` / `log_mask.rego` / data のみ。test module と workstation absolute path なし。
9. `./deploy/opa/smoke.sh`
   - workspace sandbox: diagnostic listener bind が `operation not permitted`。config/image/bundle defectではないことを local OPA と最小 container probes で切り分けた。
   - scoped approved runtime execution: PASS。
   - exact pinned digest で bundle health ready、unknown MCP tool は `deny` / `default_deny` / `policyBundleVersion=0.1.0`。
   - stdout decision log は存在し、caller input `github.unknown.read` は非出力。
10. disposable PostgreSQL 16 (`127.0.0.1:55432`) の `aiops_test`, `aiops_load_test`, `aiops_p001` を drop/create してから `mise run ci`
    - PASS: exit 0。
    - governance, policy, contracts, audit, actionlint, lint, traceability, format, build, typecheck, all workspace coverage, DB integration が green。
    - final marker: `P001 PostgreSQL integration passed`。
11. `git diff --check`
    - PASS。
12. `make require-crit-review`
    - UNAVAILABLE: repository に `require-crit-review` Make target が存在しない。ブラウザ Crit は repository policy により起動していない。
13. `gh api repos/mryfmo/ai-ops-platform/rulesets/20678089`
    - PASS: active `main-protection` ruleset は `dismiss_stale_reviews_on_push=true`、CODEOWNERS review、thread resolution、strict `build-test` / `gitleaks` を要求（L-OPS-PR222）。
14. staged credential material pattern scan
    - PASS: GitHub/PAT/AWS/OpenAI/private-key/Bearer credential material pattern なし。

## Provenance

- Local OPA CLI: `1.19.0`, Rego v1。
- Image release: `https://github.com/open-policy-agent/opa/releases/tag/v1.19.0`。
- OCI index digest: `sha256:2f42ca765bb739b40fc23ee625b3287012acdf8120ad4fcbdab68433a17be144`。
- License/notice disposition remains OPEN and deployment remains disabled.
