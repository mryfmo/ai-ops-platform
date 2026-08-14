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
