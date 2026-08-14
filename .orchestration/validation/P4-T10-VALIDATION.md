# P4-T10 Validation

## Test-first Evidence

1. bounded invocation tests を実装前に追加。
   - RED: `../src/lib/invocationProfile.js` が存在せず test module load failure、0 tests。
2. pure profile と governed caller の最小実装後、誤って `result: undefined` property を要求していた test assertion を、実際の安全な契約である result property 不在へ修正。
3. focused / package / full gates を再実行。

## Commands and Results

1. `pnpm --filter @aiops/integrations exec vitest run tests/governedMcpToolCall.test.ts`
   - PASS: 1 file / 21 tests。
   - deterministic bounds、UTF-8 JSON bytes、large payload、fake-timer timeout、late result discard、post-result elapsed check、missing/malformed depth、chain、recursion、OPA min-wins / malformed obligation を検証。
2. `pnpm --filter @aiops/integrations run test:coverage`
   - PASS: 4 files / 37 tests。
   - statements 84.61% (275/325)、branches 77.69% (209/269)、functions 96.07% (49/51)、lines 91.97% (252/274)。
3. `pnpm --filter @aiops/integrations run build`
   - PASS。
4. `pnpm --filter @aiops/integrations run typecheck`
   - PASS。
5. `pnpm --filter @aiops/integrations run lint`
   - PASS。
6. fresh disposable PostgreSQL 16 (`127.0.0.1:55432`) の `aiops_test`, `aiops_load_test`, `aiops_p001` を作成して `env CI=true ... mise run ci`
   - PASS: exit 0。
   - governance, Rego, contracts, audit, actionlint, lint, traceability, format, build, typecheck, all workspace coverage, DB integration が green。
   - final marker: `P001 PostgreSQL integration passed`。
7. `git diff --check`
   - PASS。
8. `make require-crit-review`
   - UNAVAILABLE: repository に `require-crit-review` Make target が存在しない。
   - project policy に従い browser Crit は起動せず、staged diff をローカル review する。

## Boundary Assertions

- oversized / timeout / depth / recursion は executor result を返さず failed receipt を 1 件だけ記録する。
- timeout 後の late result は `applied` へ遷移せず、追加 receipt を作らない。
- receipt は decision ID / policy bundle version と trace / actor / tool / resource / result correlation を保持し、既存 `tool_invocations` record を通す。
- OPA result-size obligation が profile より緩くても profile を維持し、厳しい場合だけ上限を下げる。
- real network、schema / migration、dependency、production flag の変更なし。
