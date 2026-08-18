-- 根拠: FinalArch:COD-001 / FinalArch:COD-002 / FinalArch:COD-003 / ADR-0027 / WBS P8-T07
CREATE TABLE IF NOT EXISTS agent_handoffs (
  task_id          TEXT PRIMARY KEY CHECK (task_id ~ '^[A-Z][A-Z0-9._-]{1,127}$'),
  writer           TEXT NOT NULL CHECK (writer ~ '^[a-z][a-z0-9-]{0,63}$'),
  reviewer         TEXT NOT NULL CHECK (reviewer ~ '^[a-z][a-z0-9-]{0,63}$'),
  state            TEXT NOT NULL CHECK (state IN ('writer_assigned', 'in_progress', 'ready_for_review', 'rework_requested', 'approved')),
  base_sha         TEXT NOT NULL CHECK (base_sha ~ '^[a-f0-9]{40}$'),
  head_sha         TEXT NOT NULL CHECK (head_sha ~ '^[a-f0-9]{40}$'),
  review_base_sha  TEXT CHECK (review_base_sha ~ '^[a-f0-9]{40}$'),
  review_head_sha  TEXT CHECK (review_head_sha ~ '^[a-f0-9]{40}$'),
  version          BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  trace_id         UUID NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (writer <> reviewer),
  CHECK ((review_base_sha IS NULL) = (review_head_sha IS NULL)),
  CHECK ((state IN ('ready_for_review', 'rework_requested', 'approved')) = (review_head_sha IS NOT NULL)),
  CHECK (review_head_sha IS NULL OR (review_base_sha = base_sha AND review_head_sha = head_sha))
);

CREATE TABLE IF NOT EXISTS agent_handoff_transitions (
  transition_id    BIGSERIAL PRIMARY KEY,
  task_id          TEXT NOT NULL REFERENCES agent_handoffs(task_id),
  event            TEXT NOT NULL CHECK (event IN ('writer_assigned', 'start_work', 'submit_for_review', 'approve', 'request_rework', 'resume_rework', 'reviewer_takeover')),
  from_state       TEXT CHECK (from_state IN ('writer_assigned', 'in_progress', 'ready_for_review', 'rework_requested', 'approved')),
  to_state         TEXT NOT NULL CHECK (to_state IN ('writer_assigned', 'in_progress', 'ready_for_review', 'rework_requested', 'approved')),
  actor            TEXT NOT NULL CHECK (actor ~ '^[a-z][a-z0-9-]{0,63}$'),
  old_writer       TEXT CHECK (old_writer ~ '^[a-z][a-z0-9-]{0,63}$'),
  new_writer       TEXT CHECK (new_writer ~ '^[a-z][a-z0-9-]{0,63}$'),
  reason           TEXT CHECK (reason IS NULL OR (length(btrim(reason)) BETWEEN 1 AND 2000)),
  base_sha         TEXT NOT NULL CHECK (base_sha ~ '^[a-f0-9]{40}$'),
  head_sha         TEXT NOT NULL CHECK (head_sha ~ '^[a-f0-9]{40}$'),
  expected_version BIGINT NOT NULL CHECK (expected_version >= 0),
  resulting_version BIGINT NOT NULL CHECK (resulting_version = expected_version + 1),
  trace_id         UUID NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, resulting_version),
  CHECK ((event = 'writer_assigned') = (from_state IS NULL)),
  CHECK (
    event <> 'reviewer_takeover'
    OR (old_writer IS NOT NULL AND new_writer IS NOT NULL AND old_writer <> new_writer AND reason IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_agent_handoff_transitions_task ON agent_handoff_transitions (task_id, resulting_version);

CREATE OR REPLACE FUNCTION agent_handoff_transitions_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'agent_handoff_transitions is append-only';
END;
$$;

CREATE OR REPLACE TRIGGER agent_handoff_transitions_block_update_delete
BEFORE UPDATE OR DELETE ON agent_handoff_transitions
FOR EACH STATEMENT EXECUTE FUNCTION agent_handoff_transitions_block_mutation();

CREATE OR REPLACE TRIGGER agent_handoff_transitions_block_truncate
BEFORE TRUNCATE ON agent_handoff_transitions
FOR EACH STATEMENT EXECUTE FUNCTION agent_handoff_transitions_block_mutation();

-- rollback: DROP TABLE agent_handoff_transitions; DROP TABLE agent_handoffs; DROP FUNCTION agent_handoff_transitions_block_mutation();
