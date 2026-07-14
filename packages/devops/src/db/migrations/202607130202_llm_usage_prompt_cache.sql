-- 2026-07-13 ADR-0005 / DevOps:SPEC-INT-060 / AUD-REL-004: prompt cache usageをLLM台帳へ保存する。
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS cache_creation_input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (cache_creation_input_tokens >= 0);
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS cache_read_input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (cache_read_input_tokens >= 0);
-- rollback: ALTER TABLE llm_usage DROP COLUMN IF EXISTS cache_read_input_tokens; ALTER TABLE llm_usage DROP COLUMN IF EXISTS cache_creation_input_tokens;
