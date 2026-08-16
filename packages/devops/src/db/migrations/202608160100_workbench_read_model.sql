-- FinalArch:PRD-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-004 /
-- FinalArch:FR-UI-005 / FinalArch:FR-UI-006 / ADR-0025 / UX-003 (P7-T07)
-- Workbench は metadata/reference read model。SoR content と workflow/action/approval state は複製しない。

CREATE UNIQUE INDEX IF NOT EXISTS idx_action_ledger_operation_approval
  ON action_ledger (operation_id, approval_id);

CREATE TABLE IF NOT EXISTS workbench_workspaces (
  workspace_id  UUID PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('project', 'repository', 'meeting', 'incident')),
  project_id    TEXT NOT NULL CHECK (btrim(project_id) <> ''),
  owner_user_id TEXT NOT NULL REFERENCES recipients(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workbench_workspaces_project ON workbench_workspaces (project_id);

CREATE TABLE IF NOT EXISTS workbench_workspace_sources (
  source_ref_id UUID PRIMARY KEY,
  workspace_id  UUID NOT NULL REFERENCES workbench_workspaces(workspace_id) ON DELETE CASCADE,
  source_system TEXT NOT NULL CHECK (source_system IN ('github', 'sharepoint', 'confluence', 'temporal')),
  source_type   TEXT NOT NULL CHECK (source_type ~ '^[a-z][a-z0-9_-]{0,63}$'),
  external_id   TEXT NOT NULL CHECK (btrim(external_id) <> '' AND length(external_id) <= 512),
  canonical_url TEXT NOT NULL CHECK (
    canonical_url ~ '^https://[^?#[:space:]]+$' AND canonical_url !~ '^https://[^/]*@'
  ),
  linked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, source_system, external_id)
);

CREATE TABLE IF NOT EXISTS workbench_workspace_runs (
  workspace_id UUID NOT NULL REFERENCES workbench_workspaces(workspace_id) ON DELETE CASCADE,
  workflow_id  TEXT NOT NULL REFERENCES workflow_runs(workflow_id),
  linked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, workflow_id)
);

CREATE TABLE IF NOT EXISTS workbench_pending_actions (
  workspace_id UUID NOT NULL REFERENCES workbench_workspaces(workspace_id) ON DELETE CASCADE,
  operation_id UUID NOT NULL,
  approval_id  UUID NOT NULL REFERENCES approvals(approval_id),
  linked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, operation_id),
  FOREIGN KEY (operation_id, approval_id)
    REFERENCES action_ledger(operation_id, approval_id)
);

-- rollback: DROP TABLE workbench_pending_actions, workbench_workspace_runs,
--   workbench_workspace_sources, workbench_workspaces;
-- rollback: DROP INDEX idx_action_ledger_operation_approval;
