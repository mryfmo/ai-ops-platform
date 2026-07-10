-- 2026-07-09 ADR-0008 / REQ-037 / SPEC-INT-063: Excelインポート台帳。
CREATE TABLE IF NOT EXISTS import_ledger (
  source_key     TEXT PRIMARY KEY,
  target_kind    TEXT NOT NULL CHECK (target_kind IN ('issue', 'project_item', 'milestone')),
  github_id      TEXT NOT NULL,
  import_run_id  UUID NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('pending', 'imported', 'skipped', 'failed')),
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE import_ledger DROP CONSTRAINT IF EXISTS import_ledger_status_check;
ALTER TABLE import_ledger ADD CONSTRAINT import_ledger_status_check CHECK (status IN ('pending', 'imported', 'skipped', 'failed')) NOT VALID;
ALTER TABLE import_ledger ADD COLUMN IF NOT EXISTS error TEXT;
CREATE INDEX IF NOT EXISTS idx_import_ledger_run ON import_ledger (import_run_id);
-- rollback: DROP TABLE import_ledger;
