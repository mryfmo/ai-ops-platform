# P4-T01 Report — Deploy agentgateway in MCP/A2A-only mode

- task_id: P4-T01 / writer: claude-code-fable5-xhigh / date: 2026-08-14
- branch: agent/P4-T01-agentgateway-deploy
- gates: MCP-001（default deny tool policy / unknown tool denied）
- refs: PRD-003 / PRD-005 / FR-MCP-001..007 / ADR-0023

## 成果物

1. `deploy/agentgateway/config.yaml` — agentgateway v1.4.1 の推奨（非 deprecated）
   config 形（`gateways` + top-level `mcp` + `routes`）による本番形:
   - `config`: adminAddr `"off"` / readinessAddr :15021 / statsAddr :15020 /
     tracing OTLP(grpc) → VPC 内 collector
   - `mcp`: jwtAuth **strict**（issuer/audience/JWKS file 固定、fail-closed）+
     `mcpAuthorization.rules` = allowlist CEL。初期は恒偽 sentinel `"false"` のみ
     = 全 tool deny。vendor 仕様上 rules 非一致 tool は deny + tools/list から
     filter（= unknown tool denied）。targets は空集合（onboarding は P4-T05..T08、
     rules/targets の生成は P4-T02 registry generator の管轄と明記）
   - `routes`: A2A marker route（`policies.a2a` + 同 jwtAuth + 503 directResponse）
   - LLM 面（top-level `llm` / `ai` backend）は一切構成しない（ADR-0023）
2. `deploy/agentgateway/deployment.yaml` — provenance/posture 台帳:
   pinned digest（v1.4.1, 2026-07-29 release, ghcr manifest index
   `sha256:efd79355…`）、Apache-2.0 単一 OSS image、internal-only ingress、
   port 台帳、secret は runtime mount のみ
3. `deploy/agentgateway/smoke.sh` — Apple container CLI で
   `--validate-only` → 起動 → readiness/metrics → 401 fail-closed → LLM path 404
   を検分（使い捨て公開鍵 JWKS を in-process 生成、秘密鍵はディスク非接触）
4. `contracts/mcp-gateway/` — check-gateway-config.mjs + 6 tests（負 fixture 10 種）
   を既存 contracts gate（`mise run ci` 経由）に結線。MCP-001 の config-level
   evidence: LLM/stdio 禁止キーの config 全域走査、allowlist 非空、strict auth、
   digest 完全一致 pin、posture 検分
5. `deploy/agentgateway/README.md` — 不変条件と運用（rollback = PR revert）

## 設計判断

- **binds 形ではなく推奨形**: v1.4.1 で `binds` は deprecated。将来の generator
  出力（P4-T02）も推奨形を前提にできる
- **deny-all sentinel**: `mcpAuthorization.rules: ["false"]`。空 rules の vendor
  semantics に依存せず、「allowlist が存在し、何も許可しない」を明示。
  contracts 側は rules 空/欠落を reject するため、緩め方向の drift は CI で落ちる
- **deployment.yaml 分離**: vendor schema に platform metadata を混ぜない
  （LiteLLM は vendor config が追加キー許容だったが agentgateway は strict validate）
- **deploy/aws/** 未使用\*\*: IaC 本体は P10-T01 管轄・AWS env は Owner 待ち。
  検証は WBS の verification（config/container smoke）を実 binary で充足

## 検証

`.orchestration/validation/P4-T01-VALIDATION.md`（smoke 全 OK / contracts 37 pass /
fresh-DB `mise run ci`）。

## 残課題（後続タスクへ）

- P4-T02: registry generator が `mcp.targets` と `mcpAuthorization.rules` を
  contracts/tools の manifest から生成（手書き追加禁止の運用を機械化）
- P4-T05..T08: 各 MCP server の onboarding
- 実 issuer（auth.aiops.internal）の JWKS 配布は AWS env 到達後（Owner 待ち backlog）

---

## Round 2（P4-T01-REVIEW verdict=revise への対応、2026-08-14）

findings 5 件すべて妥当と裁定し、001/002/003/005 をコード是正、004 を
主張 narrowing + Owner 裁定事項化した。

1. **001**: contracts check を deny-all sentinel `["false"]` との完全一致 pin へ
   （broad rule 化は CI fail）。smoke に Phase 2 を追加し、認証済み session で
   「synthetic target の tool が gateway 経由 tools/list から filter され、
   tools/call が deny される」を実測（MCP-001 の unknown tool denied を
   認証の先で証明）。fixture の governed-config 同値性も CI 検分
2. **002**: check を禁止キー blocklist から**許可形 allowlist**（レビュー済み
   構成形との完全一致）へ全面書換。generic host-backend route / top-level `ui` /
   routeGroups / 再利用 backends / binds 等、禁止キーなしの迂回を全て reject。
   レビューの実変異 2 種を負 fixture 化、smoke に `/ui` 404 probe 追加
3. **003**: jwtAuth を canonical 定数（strict / issuer / audience / file-only
   JWKS）との完全一致 pin へ。MCP/A2A 同一 binding 必須、URL JWKS reject
4. **004**: 本成果物は **non-enabled preparatory configuration**（license
   register の agentgateway review = OPEN、P4 entry gate 未クローズ、
   どの runtime からも未参照）。README / deployment.yaml / task file に明記し、
   register クローズ（または分類追認）を Owner 裁定事項として backlog 登録。
   license 表記は「upstream OCI label の申告値」へ narrowing
5. **005**: traceability_matrix.md の timestamp-only diff を revert

検証: `.orchestration/validation/P4-T01-VALIDATION.md` Round 2 節
（contracts 9/9、smoke Phase 1+2 全 OK、fresh DB ci）。
