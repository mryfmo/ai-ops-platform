-- 根拠: DevOps:SPEC-EXT-010 / DevOps:REQ-028 / AUD-OPM-001。
-- rollback: DROP TABLE IF EXISTS approvals;
CREATE TABLE IF NOT EXISTS approvals (
  approval_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_type       TEXT NOT NULL CHECK (approval_type IN ('change', 'report', 'jit_grant')),
  target_id           TEXT NOT NULL,
  project_id          TEXT,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by        TEXT NOT NULL,
  approver_tenant_id  UUID,
  approver_object_id  UUID,
  decided_at          TIMESTAMPTZ,
  reason              TEXT,
  delivered_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (status = 'pending' AND approver_tenant_id IS NULL AND approver_object_id IS NULL AND decided_at IS NULL AND reason IS NULL)
    OR (status = 'approved' AND approver_tenant_id IS NOT NULL AND approver_object_id IS NOT NULL AND decided_at IS NOT NULL)
    OR (status = 'rejected' AND approver_tenant_id IS NOT NULL AND approver_object_id IS NOT NULL AND decided_at IS NOT NULL
        AND NULLIF(btrim(reason), '') IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_approvals_pending ON approvals (created_at, approval_id) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS idx_approvals_pending_target
  ON approvals (approval_type, target_id) WHERE status = 'pending';
