-- DevOps REQ-031 / SPEC-INT-055 / SPEC-INT-081: report snapshot exact identity.
-- Existing rows predate source identity; preserve them as explicitly non-canonical legacy data.
ALTER TABLE report_snapshots ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE report_snapshots ADD COLUMN IF NOT EXISTS source TEXT;

UPDATE report_snapshots
SET source = 'legacy:unknown'
WHERE source IS NULL;

ALTER TABLE report_snapshots ALTER COLUMN source SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_report_snapshots_metric_lookup
  ON report_snapshots (scope, project_id, source, period_start);
