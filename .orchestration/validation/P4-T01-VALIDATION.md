# P4-T01 Validation — agentgateway MCP/A2A-only deploy

- date: 2026-08-14
- writer: claude-code-fable5-xhigh
- branch: agent/P4-T01-agentgateway-deploy

## 1. Container smoke（Apple container CLI 1.2.2、実行日 2026-08-14）

`./deploy/agentgateway/smoke.sh` — pinned digest
`ghcr.io/agentgateway/agentgateway:v1.4.1@sha256:efd79355b89094a8225a9db465d9a01dc656b377f0bab458761b935a13231d29`

```text
Configuration is valid!
OK: --validate-only accepts the governed config
ready
OK: /healthz/ready answered on 192.168.64.124:15021
OK: /metrics answered on 192.168.64.124:15020
OK: POST /mcp -> 401
OK: GET /a2a -> 401
OK: POST /v1/chat/completions -> 404
OK: GET /v1/models -> 404
SMOKE PASS: ghcr.io/agentgateway/agentgateway:v1.4.1@sha256:efd79355b89094a8225a9db465d9a01dc656b377f0bab458761b935a13231d29
```

判定根拠:

- `--validate-only` exit 0 = vendor schema での config 妥当性（v1.4.1 実バイナリ検証）
- `/mcp`・`/a2a` の 401 = jwtAuth strict の fail-closed（MCP-001 runtime 面。
  smoke は公開鍵のみの使い捨て JWKS を焼くため、正しい token は存在し得ない）
- `/v1/chat/completions`・`/v1/models` の 404 = LLM serving path 不在
  （ADR-0023: LLM routes disabled）
- readiness / metrics 応答 = health・OTel/Prometheus 面の起動

## 2. contracts gate（MCP-001 config-level evidence）

`mise run contracts` → **37 tests pass / 0 fail**（新規 6 test 含む）。

新規 `contracts/mcp-gateway/gateway-config.test.mjs` の負 fixture:

- top-level `llm` 混入 → reject（forbidden key）
- `ai` backend 混入 → reject（forbidden key）
- `stdio` target 混入 → reject（production stdio disabled）
- `mcpAuthorization` 欠落 / rules 空 → reject（default deny 崩し）
- jwtAuth permissive 化 / A2A 側 jwtAuth 欠落 / A2A route 削除 → reject
- image tag 浮動 / digest 差替え / adminAddr 有効化 / ingress public 化 → reject

## 3. mise run ci（Definition of Done、fresh DB aiops_p001@55432）

- 2026-08-14 fresh DB（aiops_test / aiops_load_test / aiops_p001 を dropdb→createdb）
  で `mise run ci` **exit 0**（単独判定、`ERROR task failed` 0 件）。
  末尾: `P001 PostgreSQL integration passed`

## 4. スコープ検分

- 変更ファイル: `deploy/agentgateway/**`（新規 5 files）+
  `contracts/mcp-gateway/**`（新規 2 files）+ `contracts/package.json`（test 1 行）+
  `.orchestration/**`（証跡）
- `deploy/aws/**` 未使用（IaC 本体 P10-T01、AWS env Owner 待ち — task file に記録）

---

# Round 2（P4-T01-REVIEW findings 001/002/003/005 是正後、2026-08-14）

## 是正内容

- 001: check を恒偽 sentinel `["false"]` との完全一致 pin に変更（`["true"]`
  等 broad rule 化は fail）。smoke に Phase 2（認証済み probe）を追加
- 002: check を許可形 allowlist（レビュー済み構成形との完全一致）へ全面書換。
  top-level `ui`/`routeGroups`/`backends`/`services`/`workloads`/`binds`/
  `policies` reject、route は backend-free A2A marker 1 本固定、
  レビューの実変異（generic host backend proxy / ui attach）を負 fixture 化。
  smoke に `/ui` 404 probe 追加
- 003: jwtAuth を canonical 定数（strict/issuer/audience/file-only JWKS）との
  完全一致 pin に変更、MCP/A2A 同一 binding 必須。issuer/audience/URL-JWKS/
  cross-surface drift の負 fixture 追加
- 004: 主張 narrowing（README/deployment.yaml/task file に P4 entry gate OPEN と
  non-enabled preparatory configuration 分類を明記）。Owner 裁定事項として登録
- 005: traceability_matrix.md の timestamp-only diff を revert

## contracts（round 2）

`node --test mcp-gateway/gateway-config.test.mjs` → **9 tests / 9 pass**
（負 fixture 20 種: sentinel 置換・rule 追加・rules 空/欠落・early target・
top-level llm/ui/routeGroups/backends/services/workloads/binds/policies・
generic host-backend route・ai backend route・A2A backend 付与・match 拡大・
directResponse 欠落・issuer/audience/JWKS-URL/cross-surface/mode drift・
image 浮動/digest 差替え/public ingress、および fixture 側の rules/auth 緩和・
複数 target・stdio target）

## container smoke（round 2、Phase 1+2 全 OK）

```text
Configuration is valid!
OK: --validate-only accepts the governed config
ready
OK: /healthz/ready answered on 192.168.64.130:15021
OK: /metrics answered on 192.168.64.130:15020
OK: POST /mcp -> 401
OK: GET /a2a -> 401
OK: POST /v1/chat/completions -> 404
OK: GET /v1/models -> 404
OK: GET /ui -> 404
smoke-mcp-target listening on :8931
OK: synthetic target exposes synthetic_echo when called directly
OK: authenticated tools/list via gateway is empty (denied tools filtered)
OK: authenticated tools/call synthetic_echo denied by mcpAuthorization
SMOKE PASS: ghcr.io/agentgateway/agentgateway:v1.4.1@sha256:efd79355…
```

MCP-001 runtime evidence: 認証済み session（短命 JWT を in-process 発行、
秘密鍵ディスク非接触）で、synthetic target が直叩きでは 1 tool を公開するのに
対し、gateway 経由 tools/list は空（denied tool filter）、tools/call は deny。
fixture と governed config の同値性（差分 = synthetic target 1 本のみ）は
`validateSmokeFixture` が CI で機械検分。

## mise run ci（round 2）

- 2026-08-14 fresh DB（3 DB dropdb→createdb）で `mise run ci` **exit 0**
  （単独判定、`ERROR task failed` 0 件、末尾 `P001 PostgreSQL integration passed`）。
  初回は新規 .mjs 3 files の Prettier 未整形で format gate が fail →
  `pnpm exec prettier --write` 適用後 green（コード意味変更なし）

---

# Round 3（P4-T01-REVIEW round 2 findings 004-008 対応、2026-08-15）

## 是正内容

- 006: fixture の target endpoint（192.168.64.1:8931/mcp）を contracts で
  完全一致 pin（decoy host/port/path 変異 3 種の負 fixture 追加）。smoke は
  per-run nonce（randomUUID）を target の tool description に刻印し、
  probe が (a) 直叩き tools/list の nonce 一致、(b) gateway tools/list 後の
  target 側 tools/list counter 増加（= gateway が同一 process から取得）、
  (c) denied call 後も target 側 tools/call counter 0（= call 未到達）を検分。
  denial は vendor 厳密形（HTTP 400 / JSON-RPC -32602 /
  message "Unknown tool: synthetic_echo" — 実測で確定）との完全一致要求。
  非機能だった SMOKE_HOST_ADDR オプションと docker-compat 主張は削除
  （Phase 2 は Apple container の host gateway 前提と明記）
- 007: 運用値の完全一致 pin（readinessAddr :15021 / statsAddr :15020 /
  OTLP internal collector + grpc / gateway :3000 / A2A 503 body）+
  deployment.yaml の posture.ports / otlp_endpoint と runtime config の
  整合検分。外部 OTLP sink・port drift・deployment 不整合の負 fixture 8 種追加
- 008: P4-T02 / P4-T03 タスクファイルを PR から除外（git rm --cached、
  worktree には未追跡のまま保持。commit は各タスクの orchestration sync で）
- 005: 最終 CI 実行**後**に traceability_matrix.md を main 版へ復元してから
  commit（前回は ci 再生成後の一括 add で revert が打ち消されていた）
- 004: PR body を round 3 実態（allowlist 方式・non-enabled preparatory
  configuration・license register OPEN・Owner 裁定待ち）へ全面更新。
  binding ruling 自体は Owner 権限のため pending のまま明記

## contracts（round 3）

`node --test mcp-gateway/gateway-config.test.mjs` → **11 tests / 11 pass**

## container smoke（round 3、Phase 1+2 全 OK）

```text
OK: /healthz/ready answered on 192.168.64.140:15021
OK: /metrics answered on 192.168.64.140:15020
OK: POST /mcp -> 401
OK: GET /a2a -> 401
OK: POST /v1/chat/completions -> 404
OK: GET /v1/models -> 404
OK: GET /ui -> 404
OK: synthetic target exposes nonce-stamped synthetic_echo when called directly
OK: authenticated tools/list via gateway is empty while this target served the merge (counter advanced)
OK: authenticated tools/call denied as unknown tool (400/-32602) without reaching the target
SMOKE PASS: ghcr.io/agentgateway/agentgateway:v1.4.1@sha256:efd79355…
```

## mise run ci（round 3）

- 2026-08-15 fresh DB（3 DB dropdb→createdb。55432 の disposable Postgres が
  停止していたため postgres:16-alpine を pinned tag で再起動）で
  `mise run ci` **exit 0**（単独判定、`ERROR task failed` 0 件、
  末尾 `P001 PostgreSQL integration passed`）
- traceability_matrix.md は本 CI 実行**後**に main 版へ復元して commit
  （merge-base diff で net 変更なしを push 後に検証）
