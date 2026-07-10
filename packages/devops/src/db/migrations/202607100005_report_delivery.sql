-- 2026-07-09 ADR-0014 / REQ-042 / SPEC-INT-069: 統合配信の標準report受領・配信ログ。
ALTER TABLE recipients DROP CONSTRAINT IF EXISTS recipients_profile_check;
ALTER TABLE recipients ADD CONSTRAINT recipients_profile_check CHECK (profile IN ('PRF-M', 'PRF-L', 'PRF-G', 'PRF-01', 'PRF-02', 'PRF-03', 'PRF-04', 'PRF-05')) NOT VALID;
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS persona TEXT CHECK (persona IN ('member', 'leader', 'global-manager', 'manager', 'executive', 'investor'));
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS teams_team_id TEXT;
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS teams_channel_id TEXT;
CREATE TABLE IF NOT EXISTS standard_reports (
  report_id      TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  report_type    TEXT NOT NULL CHECK (report_type IN ('weekly-summary', 'manager-weekly', 'investor-quarterly')),
  period_label   TEXT NOT NULL,
  generated_at   TEXT NOT NULL,
  payload        JSONB NOT NULL,
  trace_id       UUID NOT NULL,
  received_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_standard_reports_received ON standard_reports (received_at);
CREATE TABLE IF NOT EXISTS report_delivery_log (
  report_id    TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  delivered_at TIMESTAMPTZ NOT NULL,
  status       TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('pending', 'sent')),
  PRIMARY KEY (report_id, recipient_id)
);
ALTER TABLE report_delivery_log ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'sent';
ALTER TABLE report_delivery_log DROP CONSTRAINT IF EXISTS report_delivery_log_status_check;
ALTER TABLE report_delivery_log ADD CONSTRAINT report_delivery_log_status_check CHECK (status IN ('pending', 'sent')) NOT VALID;
-- rollback: DROP TABLE report_delivery_log; DROP TABLE standard_reports;
