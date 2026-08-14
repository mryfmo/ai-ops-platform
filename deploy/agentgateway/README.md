<!-- 根拠: FinalArch:PRD-003 / FinalArch:FR-MCP-001..007 / ADR-0023 / WBS P4-T01 -->

# agentgateway（MCP/A2A-only mode）

MCP tool federation / A2A の専用 gateway。ADR-0023 のとおり LLM routing は
一切担当しない（LLM は `deploy/litellm/` の管轄）。

> **P4 entry gate（P4-T01-004）**: 本構成は license register（agentgateway の
> SBOM/依存 license/NOTICE review）と P4 entry 条件が Owner/Security 裁定で
> クローズするまで **non-enabled preparatory configuration** であり、
> どの runtime からも参照・起動されない。runtime 有効化はその裁定後。

## 構成

| ファイル                    | 役割                                                                             |
| --------------------------- | -------------------------------------------------------------------------------- |
| `config.yaml`               | vendor schema 準拠の本番形（adminAddr off / jwtAuth strict / deny-all sentinel） |
| `deployment.yaml`           | platform 側 provenance / posture 台帳（pinned digest・internal-only・port 台帳） |
| `smoke.sh`                  | Apple `container` CLI での container smoke（2 phase、下記）                      |
| `smoke-fixture.config.yaml` | Phase 2 用 fixture（governed config + synthetic target 1 本。同値性は CI 検分）  |
| `smoke-mcp-target.mjs`      | smoke 専用 synthetic MCP server（tools/list に 1 tool 公開）                     |
| `smoke-mcp-probe.mjs`       | 認証済み session で authorization を実測する probe                               |

## 不変条件（contracts/mcp-gateway が CI で機械検分）

check は禁止キーの blocklist ではなく**許可形の allowlist**（レビュー済み構成形
との完全一致）。generic route / routeGroups / top-level `ui` 等、禁止キーを
使わない迂回もすべて reject される。

- **LLM routes disabled**: top-level は `config`/`gateways`/`mcp`/`routes` のみ。
  route は backend-free の A2A marker 1 本に固定（generic host backend 不可）
- **production stdio disabled**: target 型は `mcp` のみ許可
- **default deny**: `mcpAuthorization.rules` は恒偽 sentinel `["false"]` に
  完全一致で固定（`["true"]` 等の broad rule 化は CI で fail）。rules の変更は
  P4-T02 の registry generator 導入レビューを経てのみ
- **pinned identity**: jwtAuth は canonical 定数（strict / issuer / audience /
  file-only JWKS）と完全一致。MCP/A2A 両面で同一 binding。URL JWKS は不可
- **private ingress**: internal-only。管理 UI は adminAddr off + top-level `ui`
  禁止の両面で不在
- **immutable digest**: image は check 内 pin と `deployment.yaml` の完全一致

## smoke（runtime evidence）

- Phase 1（governed config・秘密鍵なし JWKS）: validate-only / readiness /
  metrics / `/mcp`・`/a2a` 401 / `/v1/*` 404 / `/ui` 404
- Phase 2（fixture・使い捨て鍵 + 短命 JWT を in-process 発行）: synthetic target
  直叩きでは tool が見えるのに対し、**認証済み** gateway 経由の tools/list は
  空（denied tool の filter）、tools/call は deny — MCP-001 の
  「unknown tool denied」を認証の先で実測

## 運用

- target / tool の onboarding: P4-T05..T08（registry generator P4-T02 を経由）
- health: `:15021/healthz/ready` / metrics: `:15020/metrics` / OTel: config の
  `tracing.otlpEndpoint`
- rollback: 本タスク PR の revert（gateway は現時点で他系の必須経路ではない）
