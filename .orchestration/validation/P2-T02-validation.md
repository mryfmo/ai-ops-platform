# P2-T02 validation

実行者: claude-code-fable5-xhigh（writer、orchestrator セッション）。日付: 2026-08-12。
（§1〜5 は初回 head `748eb3a` 時点、§6 はレビュー是正後 head `d1a24f2` 時点）

## 1. contracts gate（config validation）

- `mise run contracts` → **24/24 pass**（既存 16 + service-config 8）。
  新規 `contracts/model-routing/service-config.test.mjs` が正 config の受理と
  負 fixture（telemetry on / enterprise env 参照 / mcp_servers 追加 / 生 master key /
  digest 逸脱 / native fallback 再有効化 / public endpoint 宣言）の拒否を検証。

## 2. container smoke（Apple `container` CLI 1.2.2、pinned digest）

- `SMOKE_DATABASE_URL=postgresql://postgres:***@192.168.64.2:5432/litellm ./deploy/litellm/smoke.sh`
  → `OK: /health/liveliness answered on 192.168.64.10:4000` / `"I'm alive!"` /
  `OK: no enterprise enablement or long-lived AWS credential in runtime env` /
  `SMOKE PASS: ghcr.io/berriai/litellm:v1.96.2@sha256:154e23bb…ce3c63`
- 追加検分（同 config・使い捨て postgres:16-alpine sidecar）:
  - `GET /health/readiness` → `{"status": "healthy", "db": "connected"}`
  - `GET /v1/models`（master key 認証）→ 8 alias 全一致:
    `['claude-code','claude-code-fallback','claude-fast','claude-fast-fallback','claude-governed','claude-native','claude-standard','claude-standard-fallback']`
    → `include: model-aliases.yaml` が実機で解決されることを実証
- 実測知見: 既定メモリ 1GiB では proxy が boot 中に OOM Kill（ログ無し停止）。
  4g で正常起動 → `smoke.sh` に `SMOKE_MEMORY`（既定 4g）を追加

## 3. enterprise-disable / telemetry-off 検分（binding proofs）

- config 検分は `check-service-config.mjs` が機械実行:
  telemetry===false、enterprise 名称群（cloudformation_stack / enterprise_hooks /
  enterprise_ui / litellm_enterprise / LITELLM_LICENSE）の不在、MCP/A2A/passthrough
  キー面の不在、callbacks が OSS allowlist（otel）内、master key / DB URL の
  os.environ 限定、store_model_in_db=false、native fallbacks 空
- runtime 検分は smoke.sh が実行: コンテナ env に
  LITELLM_LICENSE / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY が無いことを確認
- image の `/app/enterprise` 物理同梱は register の Owner 裁定どおり存在
  （shell 検分で `ls /app` に enterprise を確認）— packaged-but-disabled が成立

## 4. fresh 使い捨て DB での `mise run ci`

- port 55432 クラスタで `dropdb --if-exists aiops_p001 && createdb aiops_p001`
- `db:require` の指示する env（AIOPS_TEST_DATABASE_*、AIOPS_LOAD_TEST_*、
  TEST_DATABASE_URL、P001_ALLOW_DISPOSABLE_DB=1）を設定し
  `mise run ci` を**単独実行** → **exit 0**（`ERROR task failed` 0 件、
  "P001 PostgreSQL integration passed"）
- format / traceability も同 run に含まれ green

## 5. lockfile

- `git status` で pnpm-lock.yaml / contracts/pnpm-lock.yaml に変更なし（依存追加なし）

## 6. レビュー是正後の再検証（P2-T02-001/002/003、head `d1a24f2`）

- 上流 v1.96.2 ソースを直接取得し finding を独立確認:
  `_should_load_db_object` は `supported_db_objects` 未設定で全ロード
  （proxy_server.py:6100-6130）、passthrough router 常時 mount（:16449-16450）、
  enterprise 無条件 import（:656-675、pyproject.toml:67 `litellm-enterprise==0.1.53`、
  Dockerfile:121-124）— reviewer 引用と全一致
- contracts gate: **29/29 pass**（追加 negative: supported_db_objects 未設定/非空、
  agents/agent_list キー、enterprise 6 marker、ANTHROPIC_API_KEY env 混入、
  base image 直デプロイ、register 外 image 参照）
- OSS-only 派生 image `ghcr.io/mryfmo/aiops-litellm-oss:v1.96.2-oss.1@sha256:c11bd714…f36ba`
  （build: deploy/litellm/Dockerfile、push 済み・digest pull で実在確認）に対する SMOKE PASS:
  - `"I'm alive!"` / readiness healthy + db connected / 8 alias 配信
  - **enterprise runtime 不在**: `find_spec('litellm_enterprise') is None` かつ
    `/app/enterprise` 不在（container exec で実測）
  - negative probe: `/anthropic/v1/messages` 401（資格枯渇 — ANTHROPIC_API_KEY 廃止、
    LITELLM_ANTHROPIC_API_KEY を litellm_params.api_key で束縛）、
    `/bedrock/...invoke` 400、`/mcp/tools` 406、`/v1/agents` == `[]`
  - virtual key での実測: `/key/generate` 401、`/anthropic` 401（管理・passthrough とも遮断）
- register 改訂（PR #186）を含めた状態で validator が image/base_image の register
  帰属を強制することを確認（#186 merge まで PR #185 CI は意図的 fail-closed）

## 7. runtime route boundary（P2-T02-001 再指摘対応、head `cad6a1d` / image oss.2）

- 再指摘の独立確認: 上流 v1.96.2 で POST /v1/agents（agent_endpoints/endpoints.py:333-437）
  と POST /v1/mcp/server（mcp_management_endpoints.py:1415-1504）は
  `supported_db_objects` を参照せず live 登録し、/bedrock passthrough は ambient AWS
  資格で SigV4 署名（llm_passthrough_endpoints.py:988-1075）— reviewer 引用と一致
- 対応: 派生 image v1.96.2-oss.2（@sha256:e5f5ed02…）に sitecustomize import hook +
  default-deny ASGI middleware を内蔵（認証・資格解決前、全 interpreter に適用）。
  allowlist は `deploy/litellm/route-allowlist.json`（validator と共有の単一ソース）
- 実測（SMOKE PASS、oss.2）:
  - deny（403 + `x-aiops-route-boundary` marker で source を特定）:
    POST /anthropic/v1/messages、POST /bedrock/...invoke、GET /mcp/tools、
    POST /v1/mcp/server、GET/POST /v1/agents、GET /docs
  - allow（marker なしで通過）: /health/liveliness 200、/health/readiness 200、
    /v1/models 200、/key/generate 200
  - **credentialed instance**（dummy ECS task-role env: AWS_ACCESS_KEY_ID 等を注入した
    使い捨て別 instance）でも /bedrock passthrough は boundary 由来 403 —
    遮断が資格の有無に依存しないことを実証
- contracts gate: **31/31 pass**（route allowlist 健全性: 禁止 prefix
  /anthropic /bedrock /vertex /mcp /v1/agents 等の負 fixture、/health 必須、
  Dockerfile FROM = provenance.base_image 一致、boundary 宣言の強制を追加）
