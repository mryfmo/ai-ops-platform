-- 2026-07-10 ADR-0006: coding_tasksに確認フロー用の列を追加。
ALTER TABLE coding_tasks ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE coding_tasks ADD COLUMN IF NOT EXISTS confirm_token_hash TEXT;
-- rollback: ALTER TABLE coding_tasks DROP COLUMN IF EXISTS confirmed_at; ALTER TABLE coding_tasks DROP COLUMN IF EXISTS confirm_token_hash;
