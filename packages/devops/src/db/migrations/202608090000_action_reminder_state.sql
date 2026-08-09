-- PrjOps:REQ-009 / SPEC-INT-025: resident AGT-06 operational reminder state。
CREATE TABLE IF NOT EXISTS action_reminder_state (
  action_id             TEXT PRIMARY KEY CHECK (action_id ~ '^ACT-[0-9]+$'),
  reminders_sent_count  INT NOT NULL DEFAULT 0 CHECK (reminders_sent_count BETWEEN 0 AND 3),
  last_notified_at      TIMESTAMPTZ,
  escalated_at          TIMESTAMPTZ,
  CHECK (reminders_sent_count = 0 OR last_notified_at IS NOT NULL),
  CHECK (escalated_at IS NULL OR last_notified_at IS NOT NULL)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_role') THEN
    GRANT SELECT, INSERT, UPDATE ON action_reminder_state TO app_role;
  END IF;
END;
$$;

-- rollback: DROP TABLE action_reminder_state;
