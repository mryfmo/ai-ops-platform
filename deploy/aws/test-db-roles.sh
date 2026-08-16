#!/usr/bin/env bash
# 根拠: FinalArch:PRD-010 / ADR-0029 / REL-001 / P10-T04
# @file deploy/aws/test-db-roles.sh
# @brief Prove database isolation and audit append-only grants in disposable PostgreSQL.
# @description
#   Starts an isolated local cluster, applies role provisioning twice, installs
#   the unchanged application schema, and verifies runtime audit mutations fail.
#   No network or AWS credential is used.
# @option P10_T04_PG_BIN PostgreSQL bin directory; defaults to commands on PATH.
# @option P10_T04_PG_PORT Local disposable server port; defaults to a process-derived port.
# @example
#   ./deploy/aws/test-db-roles.sh
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly script_dir
repo_root="$(cd "$script_dir/../.." && pwd)"
readonly repo_root
readonly provision_sql="$repo_root/packages/devops/src/db/provision_database_roles.sql"
readonly schema_sql="$repo_root/packages/devops/src/db/schema.sql"
readonly pg_bin="${P10_T04_PG_BIN:-}"
readonly pg_port="${P10_T04_PG_PORT:-$((55000 + ($$ % 1000)))}"
cluster_dir=""
server_started=0

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

# @description Resolve a PostgreSQL executable from P10_T04_PG_BIN or PATH.
# @arg $1 name Executable name.
pg_command() {
  if [ -n "$pg_bin" ]; then
    printf '%s/%s\n' "$pg_bin" "$1"
  else
    command -v "$1"
  fi
}

# @description Stop the disposable server and remove its exact temporary directory.
cleanup() {
  local exit_code=$?
  set +e
  if [ "$server_started" = "1" ]; then
    "$(pg_command pg_ctl)" -D "$cluster_dir/data" -m immediate stop >/dev/null
  fi
  if [ -n "$cluster_dir" ] && [[ "$cluster_dir" == "${TMPDIR:-/tmp}/aiops-p10-t04."* ]]; then
    rm -rf -- "$cluster_dir"
  fi
  exit "$exit_code"
}
trap cleanup EXIT

[ -f "$provision_sql" ] || fail "missing provisioning SQL: $provision_sql"
[ -f "$schema_sql" ] || fail "missing application schema: $schema_sql"
for executable in initdb pg_ctl psql; do
  [ -x "$(pg_command "$executable")" ] || fail "$executable is required"
done

cluster_dir="$(mktemp -d "${TMPDIR:-/tmp}/aiops-p10-t04.XXXXXX")"
mkdir "$cluster_dir/socket"
"$(pg_command initdb)" -D "$cluster_dir/data" -U postgres --auth=trust --no-locale >/dev/null
"$(pg_command pg_ctl)" -D "$cluster_dir/data" -o "-F -k $cluster_dir/socket -p $pg_port" -w start >/dev/null
server_started=1

readonly psql=("$(pg_command psql)" -X -v ON_ERROR_STOP=1 -h "$cluster_dir/socket" -p "$pg_port" -U postgres)
readonly provision_args=(
  -v app_password=local-app-only
  -v litellm_password=local-litellm-only
  -v temporal_password=local-temporal-only
)

if "${psql[@]}" -d postgres -f "$provision_sql" >/dev/null 2>&1; then
  fail "provisioning unexpectedly accepted missing password references"
fi
"${psql[@]}" -d postgres "${provision_args[@]}" -f "$provision_sql" >/dev/null
"${psql[@]}" -d postgres "${provision_args[@]}" -f "$provision_sql" >/dev/null
"${psql[@]}" -d aiops -c "SET ROLE aiops_owner" -f "$schema_sql" >/dev/null
"${psql[@]}" -d postgres "${provision_args[@]}" -f "$provision_sql" >/dev/null
"${psql[@]}" -d aiops -c "SET ROLE aiops_owner; INSERT INTO app.audit_log (retention_class, trace_id, actor, action, basis, detail) VALUES ('devops_1y', '00000000-0000-0000-0000-000000000001', 'test', 'seed', 'P10-T04', '{}')" >/dev/null

"${psql[@]}" -d aiops -Atc "
  SELECT CASE WHEN
    NOT has_table_privilege('app_role', 'app.audit_log', 'UPDATE') AND
    NOT has_table_privilege('app_role', 'app.audit_log', 'DELETE') AND
    NOT has_table_privilege('app_role', 'app.audit_log', 'TRUNCATE') AND
    has_table_privilege('app_role', 'app.audit_log', 'INSERT') AND
    has_table_privilege('app_role', 'app.audit_log', 'SELECT') AND
    has_table_privilege('app_role', 'app.events', 'SELECT') AND
    has_table_privilege('app_role', 'app.events', 'INSERT') AND
    has_table_privilege('app_role', 'app.events', 'UPDATE') AND
    has_table_privilege('app_role', 'app.llm_usage', 'UPDATE') AND
    NOT has_table_privilege('app_role', 'app.schema_migrations', 'INSERT') AND
    NOT has_table_privilege('app_role', 'app.work_iq_query_receipts', 'UPDATE') AND
    NOT has_table_privilege('litellm_app', 'app.audit_log', 'UPDATE') AND
    NOT has_table_privilege('litellm_app', 'app.audit_log', 'DELETE') AND
    NOT has_table_privilege('temporal', 'app.audit_log', 'UPDATE') AND
    NOT has_table_privilege('temporal', 'app.audit_log', 'DELETE') AND
    has_database_privilege('app_role', 'aiops', 'CONNECT') AND
    NOT has_database_privilege('litellm_app', 'aiops', 'CONNECT') AND
    NOT has_database_privilege('temporal', 'aiops', 'CONNECT')
  THEN 'catalog-pass' ELSE 'catalog-fail' END" | grep -qx catalog-pass || fail "role catalog grants are unsafe"

for isolated_role in litellm_app temporal; do
  if "$(pg_command psql)" -X -v ON_ERROR_STOP=1 -h "$cluster_dir/socket" -p "$pg_port" -U "$isolated_role" -d aiops -c "SELECT 1" >/dev/null 2>&1; then
    fail "$isolated_role unexpectedly connected to the aiops database"
  fi
done

for statement in UPDATE DELETE TRUNCATE; do
  case "$statement" in
    UPDATE) sql="UPDATE app.audit_log SET actor = 'mutated'" ;;
    DELETE) sql="DELETE FROM app.audit_log" ;;
    TRUNCATE) sql="TRUNCATE app.audit_log" ;;
  esac
  if "${psql[@]}" -d aiops -c "SET ROLE app_role; $sql" >/dev/null 2>&1; then
    fail "app_role unexpectedly executed $statement on audit_log"
  fi
done

if "${psql[@]}" -d aiops -c "SET ROLE app_role; INSERT INTO app.schema_migrations (version) VALUES ('P10-T04-forbidden')" >/dev/null 2>&1; then
  fail "app_role unexpectedly inserted into schema_migrations"
fi

"${psql[@]}" -d aiops -c "SET ROLE app_role; INSERT INTO app.events (trace_id, source, payload) VALUES ('00000000-0000-0000-0000-000000000003', 'inbound', '{}'); UPDATE app.events SET status = 'done' WHERE trace_id = '00000000-0000-0000-0000-000000000003'" >/dev/null
"${psql[@]}" -d aiops -c "SET ROLE app_role; INSERT INTO app.llm_usage (agent, purpose, model, cost_usd) VALUES ('P10-T04', 'reservation', 'fixture', 0.01); UPDATE app.llm_usage SET cost_usd = 0.02 WHERE agent = 'P10-T04'" >/dev/null
"${psql[@]}" -d aiops -Atc "SELECT cost_usd FROM app.llm_usage WHERE agent = 'P10-T04'" | grep -qx 0.020000 || fail "app_role LLM reservation reconciliation failed"
"${psql[@]}" -d aiops -c "SET ROLE app_role; INSERT INTO app.audit_log (retention_class, trace_id, actor, action, basis, detail) VALUES ('devops_1y', '00000000-0000-0000-0000-000000000002', 'app', 'append', 'P10-T04', '{}')" >/dev/null
"${psql[@]}" -d aiops -c "SET ROLE aiops_readonly; SELECT count(*) FROM app.audit_log" >/dev/null
if "${psql[@]}" -d aiops -c "SET ROLE aiops_readonly; UPDATE app.audit_log SET actor = 'mutated'" >/dev/null 2>&1; then
  fail "aiops_readonly unexpectedly updated audit_log"
fi

echo "DB ROLE PASS: idempotent provisioning and audit UPDATE/DELETE/TRUNCATE denial verified."
