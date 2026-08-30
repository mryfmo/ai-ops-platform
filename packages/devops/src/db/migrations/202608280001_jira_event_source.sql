-- JIRA-GH-GOV-001: authenticated, normalized Jira webhook metadata queue.
-- Existing rows are compatible; this only extends the source allowlist.
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_source_check;
ALTER TABLE events
  ADD CONSTRAINT events_source_check CHECK (source IN ('github', 'jira', 'monitor', 'inbound'));
