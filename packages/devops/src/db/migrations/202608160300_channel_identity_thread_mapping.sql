-- FinalArch:PRD-001 / FinalArch:FR-UI-001 / FinalArch:FR-UI-003 / ADR-0025 / UX-001
-- Source-message dedupe stays on the existing channel message authority.
ALTER TABLE channel_messages ADD COLUMN IF NOT EXISTS source TEXT;
UPDATE channel_messages SET source = 'teams' WHERE source IS NULL;
ALTER TABLE channel_messages ALTER COLUMN source SET DEFAULT 'teams';
ALTER TABLE channel_messages ALTER COLUMN source SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'channel_messages'::regclass
       AND conname = 'channel_messages_source_nonempty'
  ) THEN
    ALTER TABLE channel_messages
      ADD CONSTRAINT channel_messages_source_nonempty CHECK (btrim(source) <> '');
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_messages_source_message
  ON channel_messages (source, message_id);

-- Address mapping is distinct from the Graph message content mirror and SoR ID mappings.
-- Its immutable address row binds exactly one initiating identity and workflow.
CREATE TABLE IF NOT EXISTS channel_conversation_mappings (
  source                   TEXT NOT NULL CHECK (btrim(source) <> ''),
  platform_conversation_id TEXT NOT NULL CHECK (btrim(platform_conversation_id) <> ''),
  platform_thread_id       TEXT CHECK (platform_thread_id IS NULL OR btrim(platform_thread_id) <> ''),
  identity_provider        TEXT NOT NULL CHECK (btrim(identity_provider) <> ''),
  tenant_id                TEXT NOT NULL CHECK (btrim(tenant_id) <> ''),
  subject_id               TEXT NOT NULL CHECK (btrim(subject_id) <> ''),
  conversation_id          TEXT NOT NULL CHECK (btrim(conversation_id) <> ''),
  thread_id                TEXT NOT NULL CHECK (btrim(thread_id) <> ''),
  workflow_id              TEXT NOT NULL REFERENCES workflow_runs(workflow_id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT channel_conversation_mappings_address_unique
    UNIQUE NULLS NOT DISTINCT (source, platform_conversation_id, platform_thread_id)
);

-- rollback: DROP TABLE channel_conversation_mappings; DROP INDEX idx_channel_messages_source_message;
-- ALTER TABLE channel_messages DROP CONSTRAINT channel_messages_source_nonempty; ALTER TABLE channel_messages DROP COLUMN source;
