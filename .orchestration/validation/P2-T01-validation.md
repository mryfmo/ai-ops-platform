# P2-T01 validation

Validated revise head `e85f34c462609ce5fabb88890b2484c93e346cc9` on 2026-08-12 JST.

| Gate | Result |
| --- | --- |
| `node --test contracts/model-routing/model-aliases.test.mjs` | PASS — 6/6 |
| `pnpm --dir contracts run test` | PASS — 16/16; model-routing suite executes in the standard contracts gate |
| `node contracts/model-routing/check-model-aliases.mjs` | PASS — 5 application aliases, 8 bindings, 3 controlled fallback policies |
| positive Draft 2020-12 schema validation | PASS |
| raw provider model ID negative fixture | PASS — rejected |
| missing fallback classification negative fixture | PASS — rejected |
| unknown error / unguarded native fallback negatives | PASS — rejected |
| classification drift semantic negative | PASS — rejected |
| final fresh-DB `mise run ci` | PASS — exit 0 |
| `git diff --cached --check` before commit | PASS |
| lockfile and canonical-contract diff | PASS — no changes |
| staged secret-shape scan | PASS — no AWS/GitHub/Anthropic/private-key/static credential shape |
| `make require-crit-review` | NOT AVAILABLE — repository has no such Make target |
| Crit data review fallback | PASS — revise resolved approval record `r_a235ed` |
| PR #182 exact head | PASS — `e85f34c462609ce5fabb88890b2484c93e346cc9` |
| PR author / label | PASS — `app/aiops-pr-bot` / `ai-generated` |
| GitHub checks | PASS — `build-test` 5m15s, `gitleaks` 10s, `CodeRabbit` pass |

The definitive CI run used three empty databases (`aiops_test`, `aiops_load_test`, `aiops_p001`) in a disposable PostgreSQL 16.14 cluster bound only to `127.0.0.1:55446`. It completed governance, OPA 12/12, contracts, audit, actionlint, lint, traceability, format, build, typecheck, all coverage suites, and real PostgreSQL integration. The server was stopped and the entire temporary cluster was deleted; `pg_isready` returned no response afterward.

The revise explicitly authorized the one-file companion change in `contracts/package.json`, outside the original allowed paths. The root `mise run ci` contracts task now executes both existing and model-routing tests (16/16); no dependency or lockfile change was made.
