-- DevOps:REQ-010 / DevOps:SPEC-INT-020 / AC-010a / D-04:
-- approved change target provenance, CAS consumption, and honest dispatch failure state.
-- rollback: DROP INDEX idx_approvals_approved_undispatched; ALTER TABLE approvals DROP COLUMN dispatched_at, DROP COLUMN target_sha;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS target_sha TEXT;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'approvals_target_sha_check' AND conrelid = 'approvals'::regclass
  ) THEN
    ALTER TABLE approvals
      ADD CONSTRAINT approvals_target_sha_check CHECK (target_sha IS NULL OR target_sha ~ '^[0-9a-f]{40}$');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_approvals_approved_undispatched
  ON approvals (decided_at, approval_id)
  WHERE approval_type = 'change' AND status = 'approved' AND dispatched_at IS NULL;

ALTER TABLE deployments ADD COLUMN IF NOT EXISTS github_owner TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS github_repo TEXT;
ALTER TABLE deployments DROP CONSTRAINT IF EXISTS deployments_state_check;
ALTER TABLE deployments
  ADD CONSTRAINT deployments_state_check CHECK (state IN (
    'pending', 'staging_deployed', 'approval_requested', 'approved',
    'rejected', 'expired', 'prod_deploying', 'monitoring', 'stable',
    'rolling_back', 'rolled_back', 'dispatch_failed'
  ));
