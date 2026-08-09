#!/usr/bin/env bash

# @file verification/run_db_integration.sh
# @brief Validate Plan 001 against an explicitly disposable PostgreSQL database.
# @description
#   Recreates the public schema several times. It refuses to run unless the operator opts in
#   and the connected database name clearly identifies a Plan 001/test database.
# @example
#   P001_ALLOW_DISPOSABLE_DB=1 TEST_DATABASE_URL=postgres://postgres@localhost:55432/aiops_p001 verification/run_db_integration.sh

set -euo pipefail

: "${TEST_DATABASE_URL:?TEST_DATABASE_URL is required}"
if [[ "${P001_ALLOW_DISPOSABLE_DB:-}" != "1" ]]; then
  echo "Refusing destructive integration test without P001_ALLOW_DISPOSABLE_DB=1" >&2
  exit 1
fi

database_name="$(psql "$TEST_DATABASE_URL" -Atqc 'SELECT current_database()')"
if [[ ! "$database_name" =~ (p001|test) ]]; then
  echo "Refusing non-disposable database: name must contain p001 or test" >&2
  exit 1
fi

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
schema="$root_dir/packages/devops/src/db/schema.sql"
migration="$root_dir/packages/devops/src/db/migrations/202607110000_audit_log_partitions.sql"

psql_cmd=(psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -X)

"${psql_cmd[@]}" <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
DO $$ BEGIN CREATE ROLE app_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA public TO app_role;
SQL
"${psql_cmd[@]}" -f "$schema"

"${psql_cmd[@]}" <<'SQL'
SET ROLE app_role;
INSERT INTO audit_log (retention_class, trace_id, actor, action, basis, detail, at)
VALUES ('devops_1y', '00000000-0000-0000-0000-000000000001', 'AGT-INC', 'detected', 'REQ-028', '{"ok":true}', now());
SELECT trace_id FROM audit_log WHERE trace_id = '00000000-0000-0000-0000-000000000001';
INSERT INTO action_reminder_state (action_id, reminders_sent_count, last_notified_at)
VALUES ('ACT-001', 1, '2026-08-09T00:00:00Z')
ON CONFLICT (action_id) DO UPDATE SET
  reminders_sent_count = LEAST(action_reminder_state.reminders_sent_count + 1, 3),
  last_notified_at = EXCLUDED.last_notified_at;
INSERT INTO action_reminder_state (action_id, reminders_sent_count, last_notified_at)
VALUES ('ACT-001', 1, '2026-08-10T00:00:00Z')
ON CONFLICT (action_id) DO UPDATE SET
  reminders_sent_count = LEAST(action_reminder_state.reminders_sent_count + 1, 3),
  last_notified_at = EXCLUDED.last_notified_at;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM action_reminder_state
    WHERE action_id = 'ACT-001'
      AND reminders_sent_count = 2
      AND last_notified_at = '2026-08-10T00:00:00Z'
  ) THEN
    RAISE EXCEPTION 'action reminder state upsert did not persist the expected outcome';
  END IF;
END;
$$;
RESET ROLE;
SQL

if "${psql_cmd[@]}" -c "INSERT INTO audit_log (retention_class, trace_id, actor, action, basis, detail) VALUES ('invalid', gen_random_uuid(), 'test', 'test', 'REQ-028', '{}')"; then
  echo "invalid retention class was accepted" >&2
  exit 1
fi
if "${psql_cmd[@]}" -c "SET ROLE app_role; UPDATE audit_log SET actor = 'changed'"; then
  echo "app_role UPDATE was accepted" >&2
  exit 1
fi
if "${psql_cmd[@]}" -c "SET ROLE app_role; DELETE FROM audit_log"; then
  echo "app_role DELETE was accepted" >&2
  exit 1
fi
if "${psql_cmd[@]}" -c "INSERT INTO action_reminder_state (action_id, reminders_sent_count, last_notified_at) VALUES ('invalid', 1, now())"; then
  echo "invalid action reminder identifier was accepted" >&2
  exit 1
fi
if "${psql_cmd[@]}" -c "INSERT INTO action_reminder_state (action_id, reminders_sent_count) VALUES ('ACT-002', 1)"; then
  echo "nonzero reminder state without notification time was accepted" >&2
  exit 1
fi
if "${psql_cmd[@]}" -c "SET ROLE app_role; DELETE FROM action_reminder_state"; then
  echo "app_role action reminder DELETE was accepted" >&2
  exit 1
fi

"${psql_cmd[@]}" <<'SQL'
SELECT ensure_audit_log_partition('devops_1y', DATE '2025-05-01');
SELECT ensure_audit_log_partition('devops_1y', DATE '2025-05-01');
SELECT ensure_audit_log_partition('prjops_5y', DATE '2025-05-01');
SET TIME ZONE 'UTC';
SELECT ensure_audit_log_partition('devops_1y', DATE '2031-01-01');
SET TIME ZONE 'Asia/Tokyo';
SELECT ensure_audit_log_partition('devops_1y', DATE '2031-02-01');
INSERT INTO audit_log (retention_class, trace_id, actor, action, basis, detail, at) VALUES
  ('devops_1y', gen_random_uuid(), 'test', 'utc_january', 'REQ-028', '{}', '2031-01-31T23:59:59.999999Z'),
  ('devops_1y', gen_random_uuid(), 'test', 'utc_february', 'REQ-028', '{}', '2031-02-01T00:00:00Z');
DO $$
BEGIN
  IF (SELECT count(*) FROM audit_retention_candidates(DATE '2026-07-11')) <> 1
     OR NOT EXISTS (
       SELECT 1 FROM audit_retention_candidates(DATE '2026-07-11')
       WHERE retention_class = 'devops_1y' AND month_start = DATE '2025-05-01'
     ) THEN
    RAISE EXCEPTION 'retention dry-run did not isolate the expired DevOps partition';
  END IF;
  IF EXISTS (
    SELECT 1 FROM audit_retention_candidates(DATE '2026-07-11')
    WHERE month_start >= DATE '2026-07-01'
  ) THEN
    RAISE EXCEPTION 'retention dry-run targeted a current/future partition';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM audit_log
    WHERE action = 'utc_january' AND tableoid = 'audit_log_devops_1y_2031_01'::regclass
  ) OR NOT EXISTS (
    SELECT 1 FROM audit_log
    WHERE action = 'utc_february' AND tableoid = 'audit_log_devops_1y_2031_02'::regclass
  ) THEN
    RAISE EXCEPTION 'UTC-adjacent partitions have a gap, overlap, or DEFAULT misrouting';
  END IF;
END;
$$;
RESET TIME ZONE;
SET TIME ZONE 'Asia/Tokyo';
DO $$
BEGIN
  IF EXISTS (
    (SELECT * FROM audit_retention_candidates()
     EXCEPT ALL
     SELECT * FROM audit_retention_candidates((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date))
    UNION ALL
    (SELECT * FROM audit_retention_candidates((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date)
     EXCEPT ALL
     SELECT * FROM audit_retention_candidates())
  ) THEN
    RAISE EXCEPTION 'default retention cutoff is not the UTC date';
  END IF;
END;
$$;
RESET TIME ZONE;

CREATE SCHEMA audit_shadow;
CREATE TABLE audit_shadow.audit_log (
  retention_class TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL
) PARTITION BY LIST (retention_class);
CREATE TABLE audit_shadow.audit_log_devops_1y PARTITION OF audit_shadow.audit_log
  FOR VALUES IN ('devops_1y') PARTITION BY RANGE (at);
CREATE TABLE audit_shadow.audit_log_devops_1y_1999_01 PARTITION OF audit_shadow.audit_log_devops_1y
  FOR VALUES FROM ('1999-01-01T00:00:00Z') TO ('1999-02-01T00:00:00Z');
SET search_path = audit_shadow, public;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.audit_retention_candidates(DATE '2026-07-11')
    WHERE partition_name !~ '^public\.'
  ) THEN
    RAISE EXCEPTION 'retention discovery escaped the intended schema';
  END IF;
END;
$$;
RESET search_path;
DROP SCHEMA audit_shadow CASCADE;

INSERT INTO audit_log (retention_class, trace_id, actor, action, basis, detail, at)
VALUES ('devops_1y', gen_random_uuid(), 'test', 'quarantine', 'REQ-028', '{}', '2000-01-01');
INSERT INTO audit_log (retention_class, trace_id, actor, action, basis, detail, at)
VALUES ('devops_1y', gen_random_uuid(), 'test', 'overlap', 'REQ-028', '{"preserve":true}', '2030-04-15');
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM audit_log
    WHERE at = '2000-01-01' AND tableoid = 'audit_log_devops_1y_default'::regclass
  ) THEN
    RAISE EXCEPTION 'out-of-range audit record was not quarantined';
  END IF;
END;
$$;
SQL

if "${psql_cmd[@]}" -c "SELECT ensure_audit_log_partition('devops_1y', DATE '2030-04-01')"; then
  echo "partition creation unexpectedly accepted an overlapping DEFAULT row" >&2
  exit 1
fi
"${psql_cmd[@]}" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM audit_log
    WHERE at = '2030-04-15'
      AND detail = '{"preserve":true}'
      AND tableoid = 'audit_log_devops_1y_default'::regclass
  ) THEN
    RAISE EXCEPTION 'failed partition creation did not preserve the DEFAULT row';
  END IF;
END;
$$;
SQL

DATABASE_URL="$TEST_DATABASE_URL" pnpm --dir "$root_dir" --filter @aiops/devops db:migrate
DATABASE_URL="$TEST_DATABASE_URL" pnpm --dir "$root_dir" --filter @aiops/devops db:migrate

"${psql_cmd[@]}" <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
CREATE TABLE audit_log (
  log_id BIGSERIAL PRIMARY KEY,
  retention_class TEXT NOT NULL CHECK (retention_class IN ('prjops_5y', 'devops_1y')),
  trace_id UUID NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  basis TEXT NOT NULL,
  detail JSONB NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO audit_log (retention_class, trace_id, actor, action, basis, detail, at) VALUES
  ('devops_1y', '00000000-0000-0000-0000-000000000011', 'a', 'one', 'REQ-028', '{"n":1}', '2024-01-01T00:00:00Z'),
  ('prjops_5y', '00000000-0000-0000-0000-000000000012', 'b', 'two', 'REQ-028', '{"nested":{"ok":true}}', '2024-02-01T00:00:00Z'),
  ('devops_1y', '00000000-0000-0000-0000-000000000013', 'c', 'three', 'REQ-028', '[1,2,3]', '2024-03-01T00:00:00Z');
SQL
"${psql_cmd[@]}" -1 -f "$migration"
"${psql_cmd[@]}" <<'SQL'
DO $$
BEGIN
  IF (SELECT count(*) FROM audit_log) <> 3
     OR (SELECT count(*) FROM audit_log WHERE retention_class = 'devops_1y') <> 2
     OR (SELECT count(*) FROM audit_log WHERE retention_class = 'prjops_5y') <> 1
     OR NOT EXISTS (SELECT 1 FROM audit_log WHERE detail = '{"nested":{"ok":true}}')
     OR NOT EXISTS (
       SELECT 1 FROM audit_log
       WHERE action = 'one' AND tableoid = 'audit_log_devops_1y_2024_01'::regclass
     )
     OR NOT EXISTS (
       SELECT 1 FROM audit_log
       WHERE action = 'two' AND tableoid = 'audit_log_prjops_5y_2024_02'::regclass
     )
     OR NOT EXISTS (
       SELECT 1 FROM audit_log
       WHERE action = 'three' AND tableoid = 'audit_log_devops_1y_2024_03'::regclass
     )
     OR (SELECT count(*) FROM audit_retention_candidates(DATE '2026-07-11')
         WHERE retention_class = 'devops_1y' AND month_start IN (DATE '2024-01-01', DATE '2024-03-01')) <> 2
     OR to_regclass('audit_log_legacy_20260711') IS NOT NULL THEN
    RAISE EXCEPTION 'upgrade did not preserve fixture rows and JSON content';
  END IF;
END;
$$;
SQL

"${psql_cmd[@]}" <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
CREATE TABLE audit_log (
  log_id BIGSERIAL PRIMARY KEY,
  trace_id UUID NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  basis TEXT NOT NULL,
  detail JSONB NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO audit_log (trace_id, actor, action, basis, detail)
VALUES ('00000000-0000-0000-0000-000000000020', 'a', 'unclassified', 'REQ-028', '{"preserve":true}');
SQL
if "${psql_cmd[@]}" -1 -f "$migration"; then
  echo "non-empty unclassified legacy audit data was migrated" >&2
  exit 1
fi
"${psql_cmd[@]}" <<'SQL'
DO $$
BEGIN
  IF to_regclass('audit_log') IS NULL
     OR to_regclass('audit_log_legacy_20260711') IS NOT NULL
     OR (SELECT count(*) FROM audit_log WHERE detail = '{"preserve":true}') <> 1 THEN
    RAISE EXCEPTION 'unclassified rollback did not preserve the original table and row';
  END IF;
END;
$$;
SQL

"${psql_cmd[@]}" <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
CREATE TABLE audit_log (
  log_id BIGSERIAL PRIMARY KEY,
  retention_class TEXT NOT NULL CHECK (retention_class IN ('prjops_5y', 'devops_1y')),
  trace_id UUID NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  basis TEXT NOT NULL,
  detail JSONB NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO audit_log (retention_class, trace_id, actor, action, basis, detail)
VALUES ('prjops_5y', '00000000-0000-0000-0000-000000000021', 'a', 'one', 'REQ-028', '{"preserve":true}');
SQL
mismatch_migration="$(mktemp "${TMPDIR:-/tmp}/p001-mismatch.XXXXXX.sql")"
trap 'rm -f "$mismatch_migration"' EXIT
sed 's/SELECT count(\*) INTO after_count FROM audit_log;/SELECT count(*) + 1 INTO after_count FROM audit_log;/' "$migration" > "$mismatch_migration"
if "${psql_cmd[@]}" -1 -f "$mismatch_migration"; then
  echo "intentional copy mismatch committed" >&2
  exit 1
fi
"${psql_cmd[@]}" <<'SQL'
DO $$
BEGIN
  IF to_regclass('audit_log') IS NULL
     OR to_regclass('audit_log_legacy_20260711') IS NOT NULL
     OR (SELECT count(*) FROM audit_log WHERE detail = '{"preserve":true}') <> 1 THEN
    RAISE EXCEPTION 'mismatch rollback did not preserve the legacy table';
  END IF;
END;
$$;
SQL

echo "P001 PostgreSQL integration passed"
