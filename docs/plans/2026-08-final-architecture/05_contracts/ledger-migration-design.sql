-- DESIGN ONLY.
-- DELTA-02/PACK-08 correction (2026-08-10): the repository ALREADY has an `approvals`
-- table (approval_type change|report|jit_grant, project_id, target_sha, dispatched_at CAS,
-- PRF-L/PRF-G request-time authorization; PR #144/#149/#151). approval_requests below is
-- NOT to be created alongside it: evolve `approvals` via expand migrations to add
-- payload_hash / expected_version / expires_at semantics, preserving project-scope
-- authorization columns. The same applies to deployments (12-state machine already live). Implement as numbered migrations under packages/devops/src/db/migrations/.
-- Do not run this file directly against production.

CREATE TABLE workflow_runs (
  workflow_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  workflow_type TEXT NOT NULL,
  business_key TEXT NOT NULL,
  project_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('accepted','running','waiting','completed','failed','cancelled')),
  current_step TEXT,
  waiting_reason TEXT,
  version BIGINT NOT NULL DEFAULT 0,
  trace_id UUID NOT NULL,
  correlation_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  UNIQUE (workflow_type, business_key)
);

CREATE TABLE approval_requests (
  approval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id TEXT NOT NULL REFERENCES workflow_runs(workflow_id),
  action_type TEXT NOT NULL,
  resource_ref JSONB NOT NULL,
  payload_hash TEXT NOT NULL,
  expected_version BIGINT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','expired','stale')),
  requested_by TEXT NOT NULL,
  decided_by TEXT,
  reason TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX approval_one_active_per_action
  ON approval_requests(workflow_id, action_type, payload_hash)
  WHERE status = 'pending';

CREATE TABLE action_ledger (
  operation_id UUID PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflow_runs(workflow_id),
  system TEXT NOT NULL,
  operation TEXT NOT NULL,
  resource_key TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planned','approval_pending','approved','applying','applied','rejected','failed','unknown','compensated')),
  external_id TEXT,
  external_version TEXT,
  attempt_count INT NOT NULL DEFAULT 0,
  last_error_class TEXT,
  trace_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(system, operation, resource_key, input_hash)
);

CREATE TABLE policy_decisions (
  decision_id UUID PRIMARY KEY,
  workflow_id TEXT,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource JSONB NOT NULL,
  input_hash TEXT NOT NULL,
  policy_bundle_version TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('allow','deny','require_approval')),
  reasons JSONB NOT NULL,
  obligations JSONB NOT NULL,
  trace_id UUID NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE model_invocations (
  invocation_id UUID PRIMARY KEY,
  workflow_id TEXT,
  model_alias TEXT NOT NULL,
  provider_binding TEXT NOT NULL,
  provider_model_revision TEXT NOT NULL,
  route_reason TEXT NOT NULL,
  classification TEXT NOT NULL,
  input_tokens BIGINT,
  output_tokens BIGINT,
  cost_usd NUMERIC(18,8),
  latency_ms BIGINT,
  status TEXT NOT NULL,
  error_class TEXT,
  trace_id UUID NOT NULL,
  invoked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tool_invocations (
  invocation_id UUID PRIMARY KEY,
  workflow_id TEXT,
  server_id TEXT NOT NULL,
  server_version TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  resource_scope JSONB NOT NULL,
  policy_decision_id UUID REFERENCES policy_decisions(decision_id),
  approval_id UUID REFERENCES approval_requests(approval_id),
  latency_ms BIGINT,
  status TEXT NOT NULL,
  error_class TEXT,
  trace_id UUID NOT NULL,
  invoked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE id_mappings (
  mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  source_system TEXT NOT NULL,
  source_object_id TEXT NOT NULL,
  target_system TEXT NOT NULL,
  target_object_id TEXT NOT NULL,
  mapping_version BIGINT NOT NULL,
  provenance JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_system, source_object_id, target_system, target_object_id, mapping_version)
);

CREATE TABLE meeting_artifacts (
  meeting_artifact_id UUID PRIMARY KEY,
  m365_meeting_id TEXT NOT NULL,
  wispr_meeting_id TEXT,
  project_id TEXT,
  source_version TEXT NOT NULL,
  correlation_confidence NUMERIC(5,4),
  extraction JSONB NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('pending','approved','rejected','partial')),
  publication_status JSONB NOT NULL,
  trace_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(m365_meeting_id, source_version)
);

CREATE TABLE agent_runs (
  agent_run_id UUID PRIMARY KEY,
  workflow_id TEXT,
  task_id TEXT NOT NULL UNIQUE,
  writer TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  branch TEXT,
  commit_sha TEXT,
  pull_request_url TEXT,
  allowed_paths JSONB NOT NULL,
  acceptance_gate_ids JSONB NOT NULL,
  execution_evidence JSONB NOT NULL,
  status TEXT NOT NULL,
  trace_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
