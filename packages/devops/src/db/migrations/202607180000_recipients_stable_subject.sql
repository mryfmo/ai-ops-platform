-- P010-F02-T03 / DEC-SPEC-002: recipientsをemail主体からEntra stable subjectへ移行可能にする。
-- Mapping artifactはP010-F02-T04で適用するため、既存行は偽UUIDを補わずinactive/pendingへ隔離する。

ALTER TABLE recipients ADD COLUMN IF NOT EXISTS entra_tenant_id UUID;
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS entra_object_id UUID;
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS scope_mode TEXT;
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS backfill_disposition TEXT;
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS backfill_state TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM recipients
    WHERE (entra_tenant_id IS NULL) <> (entra_object_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'partial stable subject requires reviewed mapping';
  END IF;
END;
$$;

UPDATE recipients
SET scope_mode = CASE
  WHEN profile IN ('PRF-04', 'PRF-G') AND cardinality(projects) = 0 THEN 'global'
  ELSE 'project'
END
WHERE scope_mode IS NULL;

UPDATE recipients
SET active = false,
    backfill_state = 'pending',
    backfill_disposition = NULL
WHERE backfill_state IS NULL
  AND entra_tenant_id IS NULL
  AND entra_object_id IS NULL;

UPDATE recipients
SET backfill_state = 'applied'
WHERE backfill_state IS NULL
  AND entra_tenant_id IS NOT NULL
  AND entra_object_id IS NOT NULL
  AND backfill_disposition IS NOT NULL;

ALTER TABLE recipients ALTER COLUMN scope_mode SET NOT NULL;
ALTER TABLE recipients ALTER COLUMN backfill_state SET NOT NULL;

ALTER TABLE recipients DROP CONSTRAINT IF EXISTS recipients_scope_mode_check;
ALTER TABLE recipients ADD CONSTRAINT recipients_scope_mode_check
  CHECK (scope_mode IN ('project', 'global')) NOT VALID;
ALTER TABLE recipients VALIDATE CONSTRAINT recipients_scope_mode_check;

ALTER TABLE recipients DROP CONSTRAINT IF EXISTS recipients_backfill_disposition_check;
ALTER TABLE recipients ADD CONSTRAINT recipients_backfill_disposition_check
  CHECK (backfill_disposition IN ('migrate_active', 'deactivate', 'erase_after_retention')) NOT VALID;
ALTER TABLE recipients VALIDATE CONSTRAINT recipients_backfill_disposition_check;

ALTER TABLE recipients DROP CONSTRAINT IF EXISTS recipients_backfill_state_check;
ALTER TABLE recipients ADD CONSTRAINT recipients_backfill_state_check
  CHECK (backfill_state IN ('pending', 'applied')) NOT VALID;
ALTER TABLE recipients VALIDATE CONSTRAINT recipients_backfill_state_check;

ALTER TABLE recipients DROP CONSTRAINT IF EXISTS recipients_stable_subject_state_check;
ALTER TABLE recipients ADD CONSTRAINT recipients_stable_subject_state_check CHECK (
  (
    backfill_state = 'pending'
    AND active = false
    AND entra_tenant_id IS NULL
    AND entra_object_id IS NULL
    AND backfill_disposition IS NULL
  )
  OR
  (
    backfill_state = 'applied'
    AND entra_tenant_id IS NOT NULL
    AND entra_object_id IS NOT NULL
    AND backfill_disposition IS NOT NULL
  )
) NOT VALID;
ALTER TABLE recipients VALIDATE CONSTRAINT recipients_stable_subject_state_check;

ALTER TABLE recipients DROP CONSTRAINT IF EXISTS recipients_active_mapping_check;
ALTER TABLE recipients ADD CONSTRAINT recipients_active_mapping_check
  CHECK (active = false OR backfill_disposition = 'migrate_active') NOT VALID;
ALTER TABLE recipients VALIDATE CONSTRAINT recipients_active_mapping_check;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipients_stable_subject
  ON recipients (entra_tenant_id, entra_object_id)
  WHERE entra_tenant_id IS NOT NULL AND entra_object_id IS NOT NULL;

-- rollback: DROP INDEX IF EXISTS idx_recipients_stable_subject; ALTER TABLE recipients DROP CONSTRAINT IF EXISTS recipients_active_mapping_check, DROP CONSTRAINT IF EXISTS recipients_stable_subject_state_check, DROP CONSTRAINT IF EXISTS recipients_backfill_state_check, DROP CONSTRAINT IF EXISTS recipients_backfill_disposition_check, DROP CONSTRAINT IF EXISTS recipients_scope_mode_check, DROP COLUMN IF EXISTS backfill_state, DROP COLUMN IF EXISTS backfill_disposition, DROP COLUMN IF EXISTS scope_mode, DROP COLUMN IF EXISTS entra_object_id, DROP COLUMN IF EXISTS entra_tenant_id;
