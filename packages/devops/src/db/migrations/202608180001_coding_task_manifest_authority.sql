-- FinalArch:COD-001 / FinalArch:COD-003 / FinalArch:COD-004 / ADR-0006 / ADV-FIX-04
-- Fix exact manifest UTF-8 text and raw-byte SHA-256 for every coding task.

ALTER TABLE coding_tasks ADD COLUMN IF NOT EXISTS manifest TEXT;
ALTER TABLE coding_tasks ADD COLUMN IF NOT EXISTS manifest_sha256 TEXT;

-- Historical tasks predate the issuer. The valid digest binds this fail-closed sentinel;
-- dispatch schema validation rejects it instead of fabricating retroactive authority.
UPDATE coding_tasks
SET manifest = E'{}\n',
    manifest_sha256 = 'ca3d163bab055381827226140568f3bef7eaac187cebd76878e0b63e9e442356'
WHERE manifest IS NULL OR manifest_sha256 IS NULL;

ALTER TABLE coding_tasks ALTER COLUMN manifest SET NOT NULL;
ALTER TABLE coding_tasks ALTER COLUMN manifest_sha256 SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'coding_tasks'::regclass
      AND conname = 'coding_tasks_manifest_sha256_check'
  ) THEN
    ALTER TABLE coding_tasks
      ADD CONSTRAINT coding_tasks_manifest_sha256_check CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION coding_tasks_block_manifest_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.manifest IS DISTINCT FROM OLD.manifest
     OR NEW.manifest_sha256 IS DISTINCT FROM OLD.manifest_sha256 THEN
    RAISE EXCEPTION 'coding task manifest authority is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER coding_tasks_block_manifest_update
BEFORE UPDATE OF manifest, manifest_sha256 ON coding_tasks
FOR EACH ROW EXECUTE FUNCTION coding_tasks_block_manifest_mutation();

-- rollback: DROP TRIGGER coding_tasks_block_manifest_update ON coding_tasks;
-- rollback: DROP FUNCTION coding_tasks_block_manifest_mutation();
-- rollback: ALTER TABLE coding_tasks DROP COLUMN manifest_sha256, DROP COLUMN manifest;
