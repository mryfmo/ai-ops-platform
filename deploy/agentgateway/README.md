<!-- 根拠: FinalArch:PRD-003 / FinalArch:FR-MCP-001..007 / ADR-0023 / WBS P4-T01 -->

# agentgateway（MCP/A2A-only mode）

MCP tool federation / A2A の専用 gateway。ADR-0023 のとおり LLM routing は
一切担当しない（LLM は `deploy/litellm/` の管轄）。

## 構成

| ファイル          | 役割                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------- |
| `config.yaml`     | vendor schema 準拠の本番形（adminAddr off / jwtAuth strict / allowlist 認可）         |
| `deployment.yaml` | platform 側 provenance / posture 台帳（pinned digest・internal-only・port 台帳）      |
| `smoke.sh`        | Apple `container` CLI での container smoke（validate-only + 起動 + fail-closed 検分） |

## 不変条件（contracts/mcp-gateway が CI で機械検分・gate MCP-001）

- **LLM routes disabled**: top-level `llm`・`ai` backend/policy は config 全域で禁止
- **production stdio disabled**: `stdio` target は config 全域で禁止
- **default deny**: `mcpAuthorization.rules` は allowlist CEL。rules 非一致の
  tool 呼び出しは deny され tools/list からも filter される（unknown tool denied）。
  rules の追記は P4-T02 の registry generator 経由のみ（手書き追加禁止）
- **fail-closed auth**: MCP/A2A とも `jwtAuth: strict`（トークン欠落 = 401）
- **private ingress**: internal-only。public 露出禁止。管理 UI（adminAddr）常時 off
- **immutable digest**: image は `deployment.yaml` の digest 固定参照のみ

## 運用

- target / tool の onboarding: P4-T05..T08（registry generator P4-T02 を経由）
- health: `:15021/healthz/ready` / metrics: `:15020/metrics` / OTel: config の
  `tracing.otlpEndpoint`
- rollback: 本タスク PR の revert（gateway は現時点で他系の必須経路ではない）
