-- 2026-07-10 ADR-0005 / SPEC-INT-010: eventsキューのretry/DLQ/lease回収とwebhook冪等キー。
-- attempts/next_attempt_atは失敗イベントの指数backoff再試行、claimed_atはdispatched lease回収、
-- dedupe_keyはGitHub X-GitHub-Delivery / Graph message id の重複投入防止に使う。
ALTER TABLE events ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE events ADD CONSTRAINT events_status_check CHECK (status IN ('queued', 'dispatched', 'delayed', 'done', 'dead')) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_events_next_attempt ON events (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_events_claimed_at ON events (claimed_at) WHERE status = 'dispatched';
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedupe_key ON events (dedupe_key) WHERE dedupe_key IS NOT NULL;
-- rollback: DROP INDEX IF EXISTS idx_events_dedupe_key; DROP INDEX IF EXISTS idx_events_claimed_at; DROP INDEX IF EXISTS idx_events_next_attempt; ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check; ALTER TABLE events ADD CONSTRAINT events_status_check CHECK (status IN ('queued', 'dispatched', 'delayed', 'done')) NOT VALID; ALTER TABLE events DROP COLUMN IF EXISTS dedupe_key; ALTER TABLE events DROP COLUMN IF EXISTS claimed_at; ALTER TABLE events DROP COLUMN IF EXISTS next_attempt_at; ALTER TABLE events DROP COLUMN IF EXISTS attempts;
