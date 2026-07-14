-- DevOps:REQ-028 / SPEC-INT-056: block audit log mutation for every database role.

CREATE OR REPLACE FUNCTION audit_log_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'E-AUD03: audit_log is append-only';
END;
$$;

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
  EXECUTE format(
    'CREATE OR REPLACE TRIGGER audit_log_block_update_delete BEFORE UPDATE OR DELETE ON %I FOR EACH STATEMENT EXECUTE FUNCTION audit_log_block_mutation()',
    partition_name
  );
  EXECUTE format(
    'CREATE OR REPLACE TRIGGER audit_log_block_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION audit_log_block_mutation()',
    partition_name
  );
  RETURN partition_name;
END;
$$;

DO $$
DECLARE
  audit_partition REGCLASS;
BEGIN
  FOR audit_partition IN SELECT relid FROM pg_partition_tree('audit_log'::regclass)
  LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER audit_log_block_update_delete BEFORE UPDATE OR DELETE ON %s FOR EACH STATEMENT EXECUTE FUNCTION audit_log_block_mutation()',
      audit_partition
    );
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER audit_log_block_truncate BEFORE TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION audit_log_block_mutation()',
      audit_partition
    );
  END LOOP;
END;
$$;
