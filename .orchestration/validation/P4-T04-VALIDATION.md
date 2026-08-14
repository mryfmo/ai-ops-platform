# P4-T04 Validation

## Test-first Evidence

1. governed MCP integration tests を実装前に追加。
   - RED: `../src/lib/mcpPolicy.js` が存在せず test module load failure。
2. OPA baseUrl pathname test を guard 実装前に追加。
   - RED: `/tenant-a` が reject されず期待した throw が発生しない。
3. 最小実装後に focused / package / full gates を再実行。

## Commands and Results

1. `pnpm --filter @aiops/integrations exec vitest run tests/governedMcpToolCall.test.ts`
   - PASS: 1 file / 11 tests。
   - allow、deny、tool failure、OPA failure/malformed identity、require_approval approved/rejected/expired/mismatch、L2 allow、unknown caller/L4 防御を検証。
   - executor は decision record・action plan・claim 後にのみ呼ばれる。
2. `pnpm --filter @aiops/integrations run test:coverage`
   - PASS: 4 files / 27 tests。
   - statements 83.27%、branches 76.08%、functions 95.34%、lines 91.70%。
3. `pnpm --filter @aiops/integrations run typecheck`
   - PASS。
4. `pnpm --filter @aiops/integrations run lint`
   - PASS。
5. `pnpm --filter @aiops/policy run test`
   - PASS: 2 files / 12 tests。
6. disposable PostgreSQL 16 (`127.0.0.1:55432`) の `aiops_test`, `aiops_load_test`, `aiops_p001` を drop/create してから `mise run ci`
   - PASS: exit 0。
   - governance, Rego, contracts, audit, actionlint, lint, traceability, format, build, typecheck, all workspace coverage, DB integration が green。
   - final marker: `P001 PostgreSQL integration passed`。
7. `git diff --check`
   - PASS。
8. `make require-crit-review`
   - UNAVAILABLE: repository に `require-crit-review` Make target が存在しない。
   - project policy に従い browser Crit は起動せず、staged diff をローカル review する。

## Boundary Assertions

- real gateway / OPA endpoint / external network は使用していない。
- approval は既存 approvals repo と injected P3 workflow port のみ。新規 authority / auto-approval なし。
- schema / migration / dependency / production flag の変更なし。
- receipt は success / failed / blocked の全 return path で policy bundle version・decision・decision ID を保持する。
