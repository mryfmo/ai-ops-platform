-- FinalArch:CON-003 / FinalArch:FR-CP-001 / ADR-0020 / DELTA-03（P1-T05）:
-- 制御プレーン ledger 8 テーブルの新設と、既存 approvals の expand
-- （payload_hash / expected_version / expires_at）。冪等 DDL のみ。
-- rollback: 各テーブルの rollback コメント参照。approvals は
--   DROP INDEX idx_approvals_pending_expiry;
--   ALTER TABLE approvals DROP COLUMN payload_hash, DROP COLUMN expected_version, DROP COLUMN expires_at;

ALTER TABLE approvals ADD COLUMN IF NOT EXISTS payload_hash TEXT;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS expected_version BIGINT;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_approvals_pending_expiry
  ON approvals (expires_at)
  WHERE status = 'pending' AND expires_at IS NOT NULL;

-- ============================================================
-- P1-T05: 制御プレーン ledger（FinalArch:CON-003 / FR-CP-001 / ADR-0020。
-- 設計正本: docs/plans/2026-08-final-architecture/05_contracts/ledger-migration-design.sql）
-- DELTA-03: 人間承認の正本は既存 approvals、デプロイ 12 状態機械の正本は既存 deployments。
-- 本節は並行正本を作らず、approval 連携は approvals(approval_id) への参照で表す。
-- ============================================================

-- FinalArch:FR-CP-001: workflow の read model。workflow_id は control-plane の
-- buildWorkflowId（"<kind>/<businessKey>"）。真の実行履歴の正本は Temporal（P3-T01）。
CREATE TABLE IF NOT EXISTS workflow_runs (
  workflow_id     TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL,
  workflow_type   TEXT NOT NULL CHECK (workflow_type IN (
                    'meeting', 'coding-task', 'incident', 'report',
                    'plane-sync', 'graph-subscription', 'knowledge-publication'
                  )),
  business_key    TEXT NOT NULL,
  project_id      TEXT,
  status          TEXT NOT NULL CHECK (status IN ('accepted', 'running', 'waiting', 'completed', 'failed', 'cancelled')),
  current_step    TEXT,
  waiting_reason  TEXT,
  version         BIGINT NOT NULL DEFAULT 0,
  trace_id        UUID NOT NULL,
  correlation_id  UUID NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  UNIQUE (workflow_type, business_key)
);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs (status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_project ON workflow_runs (project_id);
-- rollback: DROP TABLE workflow_runs;

-- FinalArch:CON-003: 外部副作用の冪等 ledger。approval を要する操作は approvals を参照する
-- （DELTA-03: 承認の並行正本を作らない。deployments の状態機械はここに写像しない）。
CREATE TABLE IF NOT EXISTS action_ledger (
  operation_id     UUID PRIMARY KEY,
  workflow_id      TEXT NOT NULL REFERENCES workflow_runs(workflow_id),
  system           TEXT NOT NULL,
  operation        TEXT NOT NULL,
  resource_key     TEXT NOT NULL,
  input_hash       TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN (
                     'planned', 'approval_pending', 'approved', 'applying', 'applied',
                     'rejected', 'failed', 'unknown', 'compensated'
                   )),
  approval_id      UUID REFERENCES approvals(approval_id),
  -- DELTA-03: deploy 系操作は既存 deployments 状態機械が正本。action_ledger の行は
  -- 外部呼び出しの冪等性のみを追跡し、必ず正本行へ anchor する（並行正本の禁止を CHECK で強制）
  deployment_id    UUID REFERENCES deployments(deploy_id),
  external_id      TEXT,
  external_version TEXT,
  attempt_count    INT NOT NULL DEFAULT 0,
  last_error_class TEXT,
  trace_id         UUID NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (system, operation, resource_key, input_hash),
  CONSTRAINT action_ledger_deployment_authority CHECK (system <> 'deployments' OR deployment_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_action_ledger_workflow ON action_ledger (workflow_id);
CREATE INDEX IF NOT EXISTS idx_action_ledger_status ON action_ledger (status);
-- rollback: DROP TABLE action_ledger;

-- FinalArch:CON-004: OPA 判定の記録（判定の実体は policy bundle。ここは証跡）。
CREATE TABLE IF NOT EXISTS policy_decisions (
  decision_id           UUID PRIMARY KEY,
  workflow_id           TEXT,
  actor_id              TEXT NOT NULL,
  action                TEXT NOT NULL,
  resource              JSONB NOT NULL,
  input_hash            TEXT NOT NULL,
  policy_bundle_version TEXT NOT NULL,
  decision              TEXT NOT NULL CHECK (decision IN ('allow', 'deny', 'require_approval')),
  reasons               JSONB NOT NULL,
  obligations           JSONB NOT NULL,
  trace_id              UUID NOT NULL,
  decided_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_policy_decisions_workflow ON policy_decisions (workflow_id);
-- rollback: DROP TABLE policy_decisions;

-- FinalArch:PRD-003: モデル呼び出し台帳（コスト・ルーティング証跡。llm_usage は現行経路の
-- 正本のまま維持し、P2 の LiteLLM 経路がこちらへ記録する）。
CREATE TABLE IF NOT EXISTS model_invocations (
  invocation_id           UUID PRIMARY KEY,
  workflow_id             TEXT,
  model_alias             TEXT NOT NULL,
  provider_binding        TEXT NOT NULL,
  provider_model_revision TEXT NOT NULL,
  route_reason            TEXT NOT NULL,
  classification          TEXT NOT NULL,
  input_tokens            BIGINT,
  output_tokens           BIGINT,
  cost_usd                NUMERIC(18, 8),
  latency_ms              BIGINT,
  status                  TEXT NOT NULL,
  error_class             TEXT,
  trace_id                UUID NOT NULL,
  invoked_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_model_invocations_workflow ON model_invocations (workflow_id);
-- rollback: DROP TABLE model_invocations;

-- FinalArch:CON-005: MCP tool 呼び出し台帳。approval 連携は approvals を参照（DELTA-03）。
CREATE TABLE IF NOT EXISTS tool_invocations (
  invocation_id      UUID PRIMARY KEY,
  workflow_id        TEXT,
  server_id          TEXT NOT NULL,
  server_version     TEXT NOT NULL,
  tool_name          TEXT NOT NULL,
  risk_level         TEXT NOT NULL CHECK (risk_level IN ('L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6')),
  resource_scope     JSONB NOT NULL,
  policy_decision_id UUID REFERENCES policy_decisions(decision_id),
  approval_id        UUID REFERENCES approvals(approval_id),
  latency_ms         BIGINT,
  status             TEXT NOT NULL,
  error_class        TEXT,
  trace_id           UUID NOT NULL,
  invoked_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tool_invocations_workflow ON tool_invocations (workflow_id);
-- rollback: DROP TABLE tool_invocations;

-- FinalArch:CON-002: SoR 間 ID 対応の versioned mapping。
-- 現行値の正本は id_mapping_heads（論理キー PK の単一行。単調 version CAS は
-- ON CONFLICT DO UPDATE + WHERE で行い、READ COMMITTED の並行実行でも
-- EvalPlanQual により最新行と比較される）。id_mappings は受理された全版の
-- 追記専用履歴（UPDATE/DELETE しない）。
CREATE TABLE IF NOT EXISTS id_mapping_heads (
  project_id       TEXT NOT NULL,
  source_system    TEXT NOT NULL,
  source_object_id TEXT NOT NULL,
  target_system    TEXT NOT NULL,
  target_object_id TEXT NOT NULL,
  mapping_version  BIGINT NOT NULL,
  provenance       JSONB NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, source_system, source_object_id, target_system)
);
-- rollback: DROP TABLE id_mapping_heads;

CREATE TABLE IF NOT EXISTS id_mappings (
  mapping_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       TEXT NOT NULL,
  source_system    TEXT NOT NULL,
  source_object_id TEXT NOT NULL,
  target_system    TEXT NOT NULL,
  target_object_id TEXT NOT NULL,
  mapping_version  BIGINT NOT NULL,
  provenance       JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, source_system, source_object_id, target_system, mapping_version)
);
CREATE INDEX IF NOT EXISTS idx_id_mappings_project ON id_mappings (project_id);
-- rollback: DROP TABLE id_mappings;

-- FinalArch:PRD-005: 会議成果物（抽出・レビュー・公開状態）。
CREATE TABLE IF NOT EXISTS meeting_artifacts (
  meeting_artifact_id    UUID PRIMARY KEY,
  m365_meeting_id        TEXT NOT NULL,
  wispr_meeting_id       TEXT,
  project_id             TEXT,
  source_version         TEXT NOT NULL,
  correlation_confidence NUMERIC(5, 4),
  extraction             JSONB NOT NULL,
  review_status          TEXT NOT NULL CHECK (review_status IN ('pending', 'approved', 'rejected', 'partial')),
  publication_status     JSONB NOT NULL,
  trace_id               UUID NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (m365_meeting_id, source_version)
);
CREATE INDEX IF NOT EXISTS idx_meeting_artifacts_project ON meeting_artifacts (project_id);
-- rollback: DROP TABLE meeting_artifacts;

-- ADR-0027 / FinalArch:GOV-005: AI コーディングタスクの実行台帳（one-writer 証跡）。
-- 現行経路の coding_tasks は正本のまま維持し、FinalArch 経路（P8 帯）がこちらへ記録する。
CREATE TABLE IF NOT EXISTS agent_runs (
  agent_run_id        UUID PRIMARY KEY,
  workflow_id         TEXT,
  task_id             TEXT NOT NULL UNIQUE,
  writer              TEXT NOT NULL,
  reviewer            TEXT NOT NULL,
  branch              TEXT,
  commit_sha          TEXT,
  pull_request_url    TEXT,
  allowed_paths       JSONB NOT NULL,
  acceptance_gate_ids JSONB NOT NULL,
  execution_evidence  JSONB NOT NULL,
  status              TEXT NOT NULL,
  trace_id            UUID NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (writer <> reviewer)
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs (status);
-- rollback: DROP TABLE agent_runs;

