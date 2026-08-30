-- 根拠: FinalArch:PRD-010 / FinalArch:FR-CP-008 / ADR-0029 / REL-001 / P10-T04
-- Run with psql as the RDS administrator. Password variables must be resolved
-- from Secrets Manager by the approved bootstrap job; never commit values.

\if :{?app_password}
\else
  \getenv app_password AIOPS_DB_APP_PASSWORD
\endif
\if :{?litellm_password}
\else
  \getenv litellm_password AIOPS_DB_LITELLM_PASSWORD
\endif
\if :{?temporal_password}
\else
  \getenv temporal_password AIOPS_DB_TEMPORAL_PASSWORD
\endif
\if :{?app_password}
\else
  DO $$ BEGIN RAISE EXCEPTION 'app password reference is required'; END $$;
\endif
\if :{?litellm_password}
\else
  DO $$ BEGIN RAISE EXCEPTION 'litellm password reference is required'; END $$;
\endif
\if :{?temporal_password}
\else
  DO $$ BEGIN RAISE EXCEPTION 'temporal_password is required'; END $$;
\endif

SELECT 'CREATE ROLE aiops_owner NOLOGIN NOINHERIT'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aiops_owner')
\gexec
SELECT 'CREATE ROLE litellm_owner NOLOGIN NOINHERIT'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'litellm_owner')
\gexec
SELECT 'CREATE ROLE temporal_owner NOLOGIN NOINHERIT'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'temporal_owner')
\gexec
SELECT 'CREATE ROLE aiops_readonly NOLOGIN NOINHERIT'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aiops_readonly')
\gexec
SELECT 'CREATE ROLE app_role LOGIN NOINHERIT'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_role')
\gexec
SELECT 'CREATE ROLE litellm_app LOGIN NOINHERIT'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'litellm_app')
\gexec
SELECT 'CREATE ROLE temporal LOGIN NOINHERIT'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'temporal')
\gexec

ALTER ROLE aiops_owner NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE litellm_owner NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE temporal_owner NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE aiops_readonly NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE app_role LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'app_password';
ALTER ROLE litellm_app LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'litellm_password';
ALTER ROLE temporal LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'temporal_password';
GRANT aiops_owner, litellm_owner, temporal_owner TO CURRENT_USER WITH ADMIN OPTION;

SELECT format('CREATE DATABASE %I OWNER %I', 'aiops', 'aiops_owner')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'aiops')
\gexec
SELECT format('CREATE DATABASE %I OWNER %I', 'litellm', 'litellm_owner')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'litellm')
\gexec
SELECT format('CREATE DATABASE %I OWNER %I', 'temporal', 'temporal_owner')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'temporal')
\gexec
SELECT format('CREATE DATABASE %I OWNER %I', 'temporal_visibility', 'temporal_owner')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'temporal_visibility')
\gexec

ALTER DATABASE aiops OWNER TO aiops_owner;
ALTER DATABASE litellm OWNER TO litellm_owner;
ALTER DATABASE temporal OWNER TO temporal_owner;
ALTER DATABASE temporal_visibility OWNER TO temporal_owner;
REVOKE ALL ON DATABASE aiops, litellm, temporal, temporal_visibility FROM PUBLIC;
GRANT CONNECT ON DATABASE aiops TO app_role, aiops_readonly;
GRANT CONNECT ON DATABASE litellm TO litellm_app;
GRANT CONNECT ON DATABASE temporal, temporal_visibility TO temporal;

ALTER DATABASE aiops SET search_path TO app, public;
ALTER DATABASE litellm SET search_path TO litellm, public;
ALTER DATABASE temporal SET search_path TO temporal, public;
ALTER DATABASE temporal_visibility SET search_path TO temporal_visibility, public;
ALTER ROLE app_role IN DATABASE aiops SET search_path TO app, public;
ALTER ROLE aiops_readonly IN DATABASE aiops SET search_path TO app, public;
ALTER ROLE litellm_app IN DATABASE litellm SET search_path TO litellm, public;
ALTER ROLE temporal IN DATABASE temporal SET search_path TO temporal, public;
ALTER ROLE temporal IN DATABASE temporal_visibility SET search_path TO temporal_visibility, public;

\connect aiops
CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION aiops_owner;
ALTER SCHEMA app OWNER TO aiops_owner;
REVOKE ALL ON SCHEMA public, app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO app_role, aiops_readonly;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA app TO app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO app_role;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO aiops_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE aiops_owner IN SCHEMA app GRANT SELECT ON TABLES TO aiops_readonly;
DO $$
DECLARE
  mutable_table TEXT;
BEGIN
  FOREACH mutable_table IN ARRAY ARRAY[
    'action_ledger', 'action_reminder_state', 'agent_handoffs', 'agent_runs', 'approvals',
    'channel_messages', 'coding_tasks', 'deployments', 'events',
    'grants', 'graph_subscriptions', 'id_mapping_heads', 'import_ledger',
    'llm_usage', 'meeting_artifacts', 'report_delivery_log', 'status_ingest_records',
    'workflow_runs'
  ]
  LOOP
    IF to_regclass(format('app.%I', mutable_table)) IS NOT NULL THEN
      EXECUTE format('GRANT UPDATE ON TABLE app.%I TO app_role', mutable_table);
    END IF;
  END LOOP;
END;
$$;
DO $$
BEGIN
  IF to_regclass('app.schema_migrations') IS NOT NULL THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON app.schema_migrations FROM app_role, aiops_readonly;
  END IF;
  IF to_regclass('app.audit_log') IS NOT NULL THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON app.audit_log FROM app_role, aiops_readonly;
    GRANT INSERT, SELECT ON app.audit_log TO app_role;
    GRANT SELECT ON app.audit_log TO aiops_readonly;
  END IF;
  IF to_regclass('app.work_iq_query_receipts') IS NOT NULL THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON app.work_iq_query_receipts FROM app_role, aiops_readonly;
    GRANT SELECT, INSERT ON app.work_iq_query_receipts TO app_role;
  END IF;
END;
$$;

\connect litellm
CREATE SCHEMA IF NOT EXISTS litellm AUTHORIZATION litellm_owner;
ALTER SCHEMA litellm OWNER TO litellm_owner;
REVOKE ALL ON SCHEMA public, litellm FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA litellm TO litellm_app;

\connect temporal
CREATE SCHEMA IF NOT EXISTS temporal AUTHORIZATION temporal_owner;
ALTER SCHEMA temporal OWNER TO temporal_owner;
REVOKE ALL ON SCHEMA public, temporal FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA temporal TO temporal;

\connect temporal_visibility
CREATE SCHEMA IF NOT EXISTS temporal_visibility AUTHORIZATION temporal_owner;
ALTER SCHEMA temporal_visibility OWNER TO temporal_owner;
REVOKE ALL ON SCHEMA public, temporal_visibility FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA temporal_visibility TO temporal;
