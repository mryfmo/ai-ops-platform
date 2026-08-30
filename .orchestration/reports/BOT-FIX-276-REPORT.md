# BOT-FIX-276 Report

- status: accepted
- branch: `dependabot/npm_and_yarn/typescript-6.0.3`
- base: `80d5eac58447cfd88e4107ec43c3000af615ca70`
- commit: `bcf36b0127bb2271810d25083ba4408da9feda48`
- push / PR / Dependabot command: not performed
- cost: n/a

## Result

- `tsconfig.base.json` に既存の `@types/node` を明示する `types: ["node"]` を1行追加した。
- base を継承する Node 22 package の `RequestInit`、`Response`、`URL`、`fetch`、`AbortController`、timer globals が TypeScript 6.0.3 で解決されるようになった。
- `packages/web` は base を継承せず、既存の DOM-enabled tsconfig を維持する。source、API、runtime behavior、dependency、lockfile、mise、test/coverage 変更はない。
- focused typecheck と、fresh PostgreSQL 16 を使った最終 `mise run ci` は green。

## Durable facts

- [memory:decision] TypeScript 6 の Node-runtime package は共有 `tsconfig.base.json` で `types: ["node"]` を明示し、Web package は独立した DOM-enabled tsconfig を維持する。
- [memory:failure] TypeScript 6 では従来暗黙に得られていた Node 22 global types が policy build で解決されず、TS2304/TS2552 になった。source shim ではなく runtime に一致する既存 `@types/node` を共有 config から参照する。
- [memory:failure] Codex Seatbelt 内では Next.js Turbopack の内部 loopback port 作成だけが拒否された。repository を変えず、一時 launchd job で同じ `mise run ci` を実行して検証し、job と disposable DB を回収した。

## Validation

- RED: `packages/policy` build で既知の Node global type failure を再現。
- Focused: `CI=true mise run typecheck` は全10 package green。
- Final: fresh PostgreSQL 16（port 55489）+ `mise run ci` は exit 0。policy build、Next.js build、coverage、P001 PostgreSQL integration を完走。
- `git diff --check`: clean。dependency/lock/mise diff: empty。
- Crit: 1-line diff を自己レビューし、finding-free approval record 1件を resolved。`make require-crit-review` はこの branch に target がなく実行不能。
- plan-quality-gate: validator、Make target、hook、subagent definition、CI entry がこの branch に存在しないため、worklog plan の必須節・具体 command・adversarial checks・STOP 条件を手動監査した。

Full evidence: `.orchestration/validation/BOT-FIX-276-validation.md`

## CompactionDB

Decision command:

```bash
python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'BOT-FIX-276: TypeScript 6 Node-runtime packages use the shared tsconfig types:["node"]; packages/web keeps its independent DOM-enabled tsconfig; no source or dependency changes are required.'
```

Decision ID: `cb6deb94-ba66-4d39-aca7-59e6ad6b6a8b`

作業完了後に `main` へ復帰し、開始時に退避した local CompactionDB ledger を復元して decision を追加した。push / PR / Dependabot command は実施していない。

## Acceptance

`AGMSG-ACCEPTANCE v1 task_id=BOT-FIX-276 status=accepted reason=one-line-tsconfig-fix;no-dep-or-source-changes;red-reproduced;ci-green;decision-cb6deb94-verified next_action=none cost: n/a`
