-- ADR-0024 / WIQ-001 / WIQ-002 / WIQ-005 / DELTA-03 (P5-T08)
-- delegated `/m365/query` の metadata-only receipt。question/response 原文は保存しない。
-- 将来 gateway 経由に移行する場合は policy_decision_id / trace_id で
-- tool_invocations と相関し、同一呼出を両テーブルへ二重記録しない。

CREATE TABLE IF NOT EXISTS work_iq_query_receipts (
  receipt_id          UUID PRIMARY KEY,
  subject_id          TEXT NOT NULL CHECK (btrim(subject_id) <> ''),
  tenant_id           UUID NOT NULL,
  tool_name           TEXT NOT NULL CHECK (tool_name IN ('ask', 'fetch')),
  question_hash       TEXT,
  source_references   JSONB NOT NULL CHECK (jsonb_typeof(source_references) = 'array'),
  permission_context  JSONB CHECK (permission_context IS NULL OR jsonb_typeof(permission_context) = 'object'),
  provenance_complete BOOLEAN NOT NULL,
  policy_decision_id  UUID REFERENCES policy_decisions(decision_id),
  result_status       TEXT NOT NULL CHECK (result_status IN ('succeeded', 'failed', 'blocked')),
  error_code          TEXT,
  trace_id            UUID NOT NULL,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT work_iq_query_receipts_question_hash_check CHECK (
    (tool_name = 'ask' AND question_hash ~ '^[0-9a-f]{64}$') OR
    (tool_name = 'fetch' AND question_hash IS NULL)
  ),
  CONSTRAINT work_iq_query_receipts_result_check CHECK (
    (result_status = 'succeeded' AND error_code IS NULL) OR
    (result_status IN ('failed', 'blocked') AND error_code ~ '^E-[A-Z0-9-]+$')
  ),
  CONSTRAINT work_iq_query_receipts_provenance_check CHECK (
    NOT provenance_complete OR (
      jsonb_array_length(source_references) > 0 AND
      permission_context IS NOT NULL AND
      permission_context <> '{}'::jsonb
    )
  )
);
CREATE INDEX IF NOT EXISTS idx_work_iq_query_receipts_trace ON work_iq_query_receipts (trace_id);
CREATE INDEX IF NOT EXISTS idx_work_iq_query_receipts_decision ON work_iq_query_receipts (policy_decision_id);

CREATE OR REPLACE FUNCTION work_iq_query_receipts_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'E-WIQ-RECEIPT-IMMUTABLE: Work IQ query receipts are append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE TRIGGER work_iq_query_receipts_block_update_delete
BEFORE UPDATE OR DELETE ON work_iq_query_receipts
FOR EACH STATEMENT EXECUTE FUNCTION work_iq_query_receipts_block_mutation();

CREATE OR REPLACE TRIGGER work_iq_query_receipts_block_truncate
BEFORE TRUNCATE ON work_iq_query_receipts
FOR EACH STATEMENT EXECUTE FUNCTION work_iq_query_receipts_block_mutation();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_role') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON work_iq_query_receipts FROM app_role;
    GRANT SELECT, INSERT ON work_iq_query_receipts TO app_role;
  END IF;
END;
$$;

-- rollback: DROP TABLE work_iq_query_receipts; DROP FUNCTION work_iq_query_receipts_block_mutation();
