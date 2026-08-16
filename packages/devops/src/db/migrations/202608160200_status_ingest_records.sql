-- 根拠: PrjOps:REQ-004/005 / PrjOps:SPEC-INT-030 / FinalArch:ING-001
-- Operational authority only: source dedupe, thread clarification count, and effect/terminal receipts.
-- Original channel content and canonical status-update data are intentionally absent.
CREATE TABLE IF NOT EXISTS status_ingest_records (
  source_key             TEXT PRIMARY KEY,
  thread_key             TEXT NOT NULL CHECK (btrim(thread_key) <> ''),
  channel                TEXT NOT NULL CHECK (channel IN ('email', 'teams', 'github')),
  source_message_id      TEXT NOT NULL CHECK (source_message_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$'),
  prior_clarify_count    SMALLINT NOT NULL CHECK (prior_clarify_count BETWEEN 0 AND 3),
  clarify_count          SMALLINT NOT NULL CHECK (clarify_count BETWEEN 0 AND 3),
  action                 TEXT NOT NULL CHECK (action IN ('accept', 'clarify', 'escalate_incomplete')),
  state                  TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'complete')),
  revision               BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  side_effects           JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(side_effects) = 'object'),
  canonical_reference    TEXT,
  notification_reference TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT status_ingest_source_identity UNIQUE (channel, source_message_id),
  CONSTRAINT status_ingest_source_key_check CHECK (
    source_key = 'status-ingest:' || channel || ':' || source_message_id
  ),
  CONSTRAINT status_ingest_clarification_transition_check CHECK (
    (action = 'clarify' AND prior_clarify_count < 3 AND clarify_count = prior_clarify_count + 1) OR
    (action = 'accept' AND clarify_count = prior_clarify_count) OR
    (action = 'escalate_incomplete' AND prior_clarify_count = 3 AND clarify_count = 3)
  ),
  CONSTRAINT status_ingest_terminal_receipt_check CHECK (
    (state = 'pending' AND canonical_reference IS NULL AND notification_reference IS NULL) OR
    (
      state = 'complete' AND btrim(notification_reference) <> '' AND
      (
        (action = 'accept' AND btrim(canonical_reference) <> '') OR
        (action <> 'accept' AND canonical_reference IS NULL)
      )
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_status_ingest_records_thread
  ON status_ingest_records (thread_key, created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_role') THEN
    REVOKE DELETE, TRUNCATE ON status_ingest_records FROM app_role;
    GRANT SELECT, INSERT, UPDATE ON status_ingest_records TO app_role;
  END IF;
END;
$$;

-- rollback: DROP TABLE status_ingest_records;
