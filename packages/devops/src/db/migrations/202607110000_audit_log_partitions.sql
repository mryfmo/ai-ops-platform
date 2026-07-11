-- DevOps REQ-028 / SPEC-INT-056: loss-safe audit partition and retention-class migration.
-- The migration runner supplies one transaction; every validation failure rolls the rename/copy back.

DO $$
DECLARE
  is_current_shape BOOLEAN;
  legacy_has_retention BOOLEAN;
  legacy_has_rows BOOLEAN;
  legacy_has_invalid_retention BOOLEAN;
BEGIN
  IF to_regclass('audit_log') IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_partitioned_table pt
    JOIN pg_class c ON c.oid = pt.partrelid
    JOIN information_schema.columns col ON col.table_schema = current_schema()
      AND col.table_name = c.relname
      AND col.column_name = 'retention_class'
    WHERE c.oid = 'audit_log'::regclass
      AND pt.partstrat = 'l'
  ) INTO is_current_shape;

  IF NOT is_current_shape THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'audit_log'
        AND column_name = 'retention_class'
    ) INTO legacy_has_retention;
    SELECT EXISTS (SELECT 1 FROM audit_log) INTO legacy_has_rows;

    IF legacy_has_rows AND NOT legacy_has_retention THEN
      RAISE EXCEPTION 'non-empty legacy audit_log requires reviewed retention classification';
    END IF;
    IF legacy_has_retention THEN
      EXECUTE $query$SELECT EXISTS (
        SELECT 1 FROM audit_log
        WHERE retention_class IS NULL
           OR retention_class NOT IN ('prjops_5y', 'devops_1y')
      )$query$ INTO legacy_has_invalid_retention;
      IF legacy_has_invalid_retention THEN
        RAISE EXCEPTION 'legacy audit_log contains invalid retention classification';
      END IF;
    END IF;

    IF to_regclass('audit_log_legacy_20260711') IS NOT NULL THEN
      RAISE EXCEPTION 'audit_log_legacy_20260711 already exists';
    END IF;
    ALTER TABLE audit_log RENAME TO audit_log_legacy_20260711;
    IF to_regclass('idx_audit_log_trace_id') IS NOT NULL THEN
      ALTER INDEX idx_audit_log_trace_id RENAME TO idx_audit_log_legacy_20260711_trace_id;
    END IF;
  END IF;
END;
$$;

CREATE SEQUENCE IF NOT EXISTS audit_log_log_id_seq;
CREATE TABLE IF NOT EXISTS audit_log (
  log_id          BIGINT NOT NULL DEFAULT nextval('audit_log_log_id_seq'),
  retention_class TEXT NOT NULL CHECK (retention_class IN ('prjops_5y', 'devops_1y')),
  trace_id        UUID NOT NULL,
  actor           TEXT NOT NULL,
  action          TEXT NOT NULL,
  basis           TEXT NOT NULL,
  detail          JSONB NOT NULL,
  at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_partitioned_pkey PRIMARY KEY (retention_class, at, log_id)
) PARTITION BY LIST (retention_class);
CREATE INDEX IF NOT EXISTS idx_audit_log_trace_id ON audit_log (trace_id);

CREATE TABLE IF NOT EXISTS audit_log_prjops_5y PARTITION OF audit_log
  FOR VALUES IN ('prjops_5y') PARTITION BY RANGE (at);
CREATE TABLE IF NOT EXISTS audit_log_devops_1y PARTITION OF audit_log
  FOR VALUES IN ('devops_1y') PARTITION BY RANGE (at);

CREATE OR REPLACE FUNCTION ensure_audit_log_partition(p_retention_class TEXT, p_month DATE)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
  parent_name TEXT;
  partition_name TEXT;
  month_start DATE := date_trunc('month', p_month)::date;
  month_start_utc TEXT := to_char(month_start, 'YYYY-MM-DD') || 'T00:00:00Z';
  month_end_utc TEXT := to_char((month_start + INTERVAL '1 month')::date, 'YYYY-MM-DD') || 'T00:00:00Z';
BEGIN
  IF p_retention_class NOT IN ('prjops_5y', 'devops_1y') THEN
    RAISE EXCEPTION 'invalid audit retention class: %', p_retention_class;
  END IF;
  IF p_month <> month_start THEN
    RAISE EXCEPTION 'audit partition month must be the first day: %', p_month;
  END IF;

  parent_name := 'audit_log_' || p_retention_class;
  partition_name := parent_name || '_' || to_char(month_start, 'YYYY_MM');
  IF to_regclass(partition_name) IS NULL THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L::timestamptz) TO (%L::timestamptz)',
      partition_name,
      parent_name,
      month_start_utc,
      month_end_utc
    );
  END IF;
  RETURN partition_name;
END;
$$;

SELECT ensure_audit_log_partition('prjops_5y', date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date);
SELECT ensure_audit_log_partition('prjops_5y', (date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 month')::date);
SELECT ensure_audit_log_partition('devops_1y', date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date);
SELECT ensure_audit_log_partition('devops_1y', (date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 month')::date);

CREATE TABLE IF NOT EXISTS audit_log_prjops_5y_default PARTITION OF audit_log_prjops_5y DEFAULT;
CREATE TABLE IF NOT EXISTS audit_log_devops_1y_default PARTITION OF audit_log_devops_1y DEFAULT;

CREATE OR REPLACE FUNCTION audit_retention_candidates(
  p_as_of DATE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
)
RETURNS TABLE (partition_name TEXT, retention_class TEXT, month_start DATE)
LANGUAGE sql
STABLE
SET search_path FROM CURRENT
AS $$
  WITH partitions AS (
    SELECT
      format('%I.%I', root_schema.nspname, child.relname) AS partition_name,
      CASE
        WHEN parent.relname = 'audit_log_prjops_5y' THEN 'prjops_5y'
        ELSE 'devops_1y'
      END AS retention_class,
      to_date(substring(child.relname FROM '(\d{4}_\d{2})$'), 'YYYY_MM') AS month_start
    FROM pg_inherits
    JOIN pg_class child ON child.oid = inhrelid
    JOIN pg_namespace child_schema ON child_schema.oid = child.relnamespace
    JOIN pg_class parent ON parent.oid = inhparent
    JOIN pg_namespace parent_schema ON parent_schema.oid = parent.relnamespace
    JOIN pg_inherits parent_link ON parent_link.inhrelid = parent.oid
    JOIN pg_class root ON root.oid = parent_link.inhparent
    JOIN pg_namespace root_schema ON root_schema.oid = root.relnamespace
    WHERE root.oid = 'audit_log'::regclass
      AND parent_schema.oid = root_schema.oid
      AND child_schema.oid = root_schema.oid
      AND parent.relname IN ('audit_log_prjops_5y', 'audit_log_devops_1y')
      AND child.relname ~ '\d{4}_\d{2}$'
  )
  SELECT p.partition_name, p.retention_class, p.month_start
  FROM partitions p
  WHERE p.month_start < date_trunc('month', p_as_of)::date
    AND p.month_start < date_trunc('month', p_as_of)::date - CASE p.retention_class
      WHEN 'prjops_5y' THEN INTERVAL '5 years'
      ELSE INTERVAL '1 year'
    END
  ORDER BY p.month_start, p.partition_name;
$$;

DO $$
DECLARE
  before_count BIGINT;
  after_count BIGINT;
  content_mismatch BOOLEAN;
  legacy_has_retention BOOLEAN;
  historical_partition RECORD;
BEGIN
  IF to_regclass('audit_log_legacy_20260711') IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'audit_log_legacy_20260711'
      AND column_name = 'retention_class'
  ) INTO legacy_has_retention;

  SELECT count(*) INTO before_count FROM audit_log_legacy_20260711;
  IF legacy_has_retention THEN
    FOR historical_partition IN
      SELECT retention_class, date_trunc('month', at AT TIME ZONE 'UTC')::date AS month_start
      FROM audit_log_legacy_20260711
      GROUP BY retention_class, date_trunc('month', at AT TIME ZONE 'UTC')::date
    LOOP
      PERFORM ensure_audit_log_partition(
        historical_partition.retention_class,
        historical_partition.month_start
      );
    END LOOP;

    INSERT INTO audit_log (log_id, retention_class, trace_id, actor, action, basis, detail, at)
    SELECT log_id, retention_class, trace_id, actor, action, basis, detail, at
    FROM audit_log_legacy_20260711;
  ELSIF before_count <> 0 THEN
    RAISE EXCEPTION 'non-empty legacy audit_log requires reviewed retention classification';
  END IF;
  SELECT count(*) INTO after_count FROM audit_log;

  IF legacy_has_retention THEN
    SELECT EXISTS (
      (SELECT log_id, retention_class, trace_id, actor, action, basis, detail, at
       FROM audit_log_legacy_20260711
       EXCEPT ALL
       SELECT log_id, retention_class, trace_id, actor, action, basis, detail, at FROM audit_log)
      UNION ALL
      (SELECT log_id, retention_class, trace_id, actor, action, basis, detail, at FROM audit_log
       EXCEPT ALL
       SELECT log_id, retention_class, trace_id, actor, action, basis, detail, at
       FROM audit_log_legacy_20260711)
    ) INTO content_mismatch;
  ELSE
    content_mismatch := before_count <> 0 OR after_count <> 0;
  END IF;

  IF before_count <> after_count OR content_mismatch THEN
    RAISE EXCEPTION 'audit_log copy validation failed: before=%, after=%, content_mismatch=%',
      before_count, after_count, content_mismatch;
  END IF;

  PERFORM setval('audit_log_log_id_seq', COALESCE(max(log_id), 1), max(log_id) IS NOT NULL) FROM audit_log;
  ALTER SEQUENCE audit_log_log_id_seq OWNED BY audit_log.log_id;
  DROP TABLE audit_log_legacy_20260711;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_role') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM app_role;
    GRANT INSERT, SELECT ON audit_log TO app_role;
    GRANT USAGE, SELECT ON SEQUENCE audit_log_log_id_seq TO app_role;
  END IF;
END;
$$;

-- Rollback is restore-only after a backup/PITR checkpoint; do not collapse retention classes in place.
