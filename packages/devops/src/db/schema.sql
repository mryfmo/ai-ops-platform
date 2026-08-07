-- packages/devops/src/db/schema.sql
--
-- 根拠: DevOps DOC-INT-04 §3 データ構造（DevOps:SPEC-INT-050番台）
-- データストアはRDB（PostgreSQL想定）。本ファイルは全テーブル定義の正本。
-- 変更時は通常のPRレビューを経ること。

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  event_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id    UUID NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('github', 'monitor', 'inbound')),
  payload     JSONB NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('queued', 'dispatched', 'delayed', 'done', 'dead')) DEFAULT 'queued',
  attempts    INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  claimed_at  TIMESTAMPTZ,
  dedupe_key  TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_trace_id ON events (trace_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events (status);
CREATE INDEX IF NOT EXISTS idx_events_next_attempt ON events (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_events_claimed_at ON events (claimed_at) WHERE status = 'dispatched';
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedupe_key ON events (dedupe_key) WHERE dedupe_key IS NOT NULL;

-- ADR-0007 / PrjOps:SPEC-INT-062 / DevOps:SPEC-INT-081: GitHub PM時系列イベント。
-- projects_v2_item / projects_v2_status_update / issues / pull_request / milestone / deployment webhookを正規化し、
-- raw_payloadは保存前にsanitizeSecrets()を通すこと（REQ-036 / DevOps:REQ-031）。
CREATE TABLE IF NOT EXISTS pm_events (
  event_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id    UUID NOT NULL,
  event_name  TEXT NOT NULL,
  action      TEXT,
  project_id  TEXT,
  repository  TEXT,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('issue', 'pull_request', 'milestone', 'project_item', 'project_status', 'deployment')),
  subject_id  TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  from_status TEXT,
  to_status   TEXT,
  normalized  JSONB NOT NULL,
  raw_payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pm_events_time ON pm_events (occurred_at);
CREATE INDEX IF NOT EXISTS idx_pm_events_project_time ON pm_events (project_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_pm_events_subject ON pm_events (subject_type, subject_id);

-- ADR-0007 / DevOps:AC-031a: 定期フルsnapshot。webhook取りこぼしreconcileの正本。
CREATE TABLE IF NOT EXISTS pm_snapshots (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id    UUID NOT NULL,
  project_id  TEXT,
  repository  TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('issue', 'pull_request', 'milestone', 'project_item', 'project_status', 'deployment')),
  source_id   TEXT NOT NULL,
  state       TEXT,
  captured_at TIMESTAMPTZ NOT NULL,
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, captured_at)
);
CREATE INDEX IF NOT EXISTS idx_pm_snapshots_time ON pm_snapshots (captured_at);
CREATE INDEX IF NOT EXISTS idx_pm_snapshots_project_time ON pm_snapshots (project_id, captured_at);

-- ADR-0010 / AC-038-1: Seven Keys月次PDCA snapshot。
-- 追記専用。月次ジョブの冪等性は (month, project_id) の一意制約と repo のskip監査で担保する。
CREATE TABLE IF NOT EXISTS seven_keys_snapshots (
  snapshot_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month        TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  project_id   TEXT NOT NULL,
  keys_rag     JSONB NOT NULL,
  improved_keys TEXT[] NOT NULL DEFAULT '{}',
  worsened_keys TEXT[] NOT NULL DEFAULT '{}',
  next_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (month, project_id)
);
CREATE INDEX IF NOT EXISTS idx_seven_keys_snapshots_project_month ON seven_keys_snapshots (project_id, month);
-- rollback: DROP TABLE seven_keys_snapshots;

-- DevOps:SPEC-INT-020 デプロイ状態機械の値のみ許可（lib/deployStateMachine.tsのDeployState型と一致させること）
CREATE TABLE IF NOT EXISTS deployments (
  deploy_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   TEXT NOT NULL,
  commit_sha   TEXT NOT NULL,
  env          TEXT NOT NULL CHECK (env IN ('dev', 'staging', 'prod')),
  state        TEXT NOT NULL CHECK (state IN (
                  'pending', 'staging_deployed', 'approval_requested', 'approved',
                  'rejected', 'expired', 'prod_deploying', 'monitoring', 'stable',
                  'rolling_back', 'rolled_back'
                )),
  risk_score   INT CHECK (risk_score BETWEEN 0 AND 100),
  approved_by  TEXT,
  approved_at  TIMESTAMPTZ,
  trace_id     UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON deployments (project_id);
CREATE INDEX IF NOT EXISTS idx_deployments_state ON deployments (state);

CREATE TABLE IF NOT EXISTS incidents (
  incident_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity           TEXT NOT NULL CHECK (severity IN ('sev1', 'sev2', 'sev3', 'sev4')),
  severity_candidate TEXT CHECK (severity_candidate IN ('sev1', 'sev2', 'sev3', 'sev4')),
  alert_rule_id      TEXT,
  affected_projects  TEXT[] NOT NULL DEFAULT '{}',
  github_issue_url   TEXT,
  resolution         TEXT CHECK (resolution IN ('fixed', 'false_positive', 'duplicate')),
  detected_at        TIMESTAMPTZ NOT NULL,
  resolved_at        TIMESTAMPTZ,
  acked_by           TEXT,
  acked_at           TIMESTAMPTZ,
  trace_id           UUID NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_incidents_alert_rule_id ON incidents (alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents (severity);

-- DevOps:SPEC-INT-053 権限台帳（grants）
CREATE TABLE IF NOT EXISTS grants (
  grant_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject      TEXT NOT NULL,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('internal', 'external')),
  target       TEXT NOT NULL,
  level        TEXT NOT NULL CHECK (level IN ('pull', 'push', 'maintain', 'admin')),
  reason       TEXT NOT NULL,
  approved_by  TEXT NOT NULL,
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_grants_expires_at ON grants (expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_grants_subject ON grants (subject);

-- P010-F02-T03 / DEC-SPEC-002 / DevOps:SPEC-INT-054: stable subject配信名簿。
CREATE TABLE IF NOT EXISTS recipients (
  user_id  TEXT PRIMARY KEY,
  profile  TEXT NOT NULL CHECK (profile IN ('PRF-M', 'PRF-L', 'PRF-G', 'PRF-01', 'PRF-02', 'PRF-03', 'PRF-04', 'PRF-05')),
  persona  TEXT CHECK (persona IN ('member', 'leader', 'global-manager', 'manager', 'executive', 'investor')),
  email    TEXT NOT NULL,
  projects TEXT[] NOT NULL DEFAULT '{}',
  language TEXT NOT NULL CHECK (language IN ('ja', 'en')) DEFAULT 'ja',
  active   BOOLEAN NOT NULL DEFAULT true,
  entra_tenant_id UUID,
  entra_object_id UUID,
  scope_mode TEXT NOT NULL CHECK (scope_mode IN ('project', 'global')),
  backfill_disposition TEXT CHECK (backfill_disposition IN ('migrate_active', 'deactivate', 'erase_after_retention')),
  backfill_state TEXT NOT NULL CHECK (backfill_state IN ('pending', 'applied')),
  teams_team_id TEXT,
  teams_channel_id TEXT,
  CONSTRAINT recipients_stable_subject_state_check CHECK (
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
  ),
  CONSTRAINT recipients_active_mapping_check CHECK (
    active = false OR backfill_disposition = 'migrate_active'
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipients_stable_subject
  ON recipients (entra_tenant_id, entra_object_id)
  WHERE entra_tenant_id IS NOT NULL AND entra_object_id IS NOT NULL;

-- ADR-0014 / DevOps:REQ-042 / SPEC-INT-069: 標準report受領。
CREATE TABLE IF NOT EXISTS standard_reports (
  report_id      TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  report_type    TEXT NOT NULL CHECK (report_type IN ('weekly-summary', 'manager-weekly', 'investor-quarterly')),
  period_label   TEXT NOT NULL,
  generated_at   TEXT NOT NULL,
  payload        JSONB NOT NULL,
  trace_id       UUID NOT NULL,
  received_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_standard_reports_received ON standard_reports (received_at);

-- ADR-0014 / DevOps:REQ-042 / SPEC-INT-069: report配信ログ。
CREATE TABLE IF NOT EXISTS report_delivery_log (
  report_id    TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  delivered_at TIMESTAMPTZ NOT NULL,
  status       TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('pending', 'sent')),
  PRIMARY KEY (report_id, recipient_id)
);

-- SPEC-INT-055 report_snapshots
CREATE TABLE IF NOT EXISTS report_snapshots (
  snapshot_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start TIMESTAMPTZ NOT NULL,
  period_end   TIMESTAMPTZ NOT NULL,
  scope        TEXT NOT NULL CHECK (scope IN ('user', 'project', 'global')),
  project_id   TEXT,
  source       TEXT NOT NULL,
  metrics      JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_metric_lookup
  ON report_snapshots (scope, project_id, source, period_start);

-- SPEC-INT-056 audit_log（追記専用。REQ-028）
CREATE TABLE IF NOT EXISTS audit_log (
  log_id         BIGSERIAL,
  retention_class TEXT NOT NULL CHECK (retention_class IN ('prjops_5y', 'devops_1y')),
  trace_id       UUID NOT NULL,
  actor          TEXT NOT NULL,
  action         TEXT NOT NULL,
  basis          TEXT NOT NULL,
  detail         JSONB NOT NULL,
  at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (retention_class, at, log_id)
) PARTITION BY LIST (retention_class);
CREATE INDEX IF NOT EXISTS idx_audit_log_trace_id ON audit_log (trace_id);

CREATE TABLE IF NOT EXISTS audit_log_prjops_5y PARTITION OF audit_log
  FOR VALUES IN ('prjops_5y') PARTITION BY RANGE (at);
CREATE TABLE IF NOT EXISTS audit_log_devops_1y PARTITION OF audit_log
  FOR VALUES IN ('devops_1y') PARTITION BY RANGE (at);

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

SELECT ensure_audit_log_partition('prjops_5y', date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date);
SELECT ensure_audit_log_partition('prjops_5y', (date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 month')::date);
SELECT ensure_audit_log_partition('devops_1y', date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date);
SELECT ensure_audit_log_partition('devops_1y', (date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 month')::date);

CREATE TABLE IF NOT EXISTS audit_log_prjops_5y_default PARTITION OF audit_log_prjops_5y DEFAULT;
CREATE TABLE IF NOT EXISTS audit_log_devops_1y_default PARTITION OF audit_log_devops_1y DEFAULT;

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

-- app_role is infrastructure-owned; apply least privilege when it already exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_role') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM app_role;
    GRANT INSERT, SELECT ON audit_log TO app_role;
    GRANT USAGE, SELECT ON SEQUENCE audit_log_log_id_seq TO app_role;
  END IF;
END;
$$;

-- SPEC-INT-057 partner_companies
CREATE TABLE IF NOT EXISTS partner_companies (
  company_id      TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  region          TEXT,
  language        TEXT NOT NULL CHECK (language IN ('ja', 'en')) DEFAULT 'en',
  teams_channel_id TEXT,
  notify_emails   TEXT[] NOT NULL DEFAULT '{}'
);

-- ============================================================
-- ADR-0005: 常駐サーバ+Teams統合（プロジェクト専用チャネルの会話取込）
-- ============================================================

-- ADR-0005: プロジェクト専用チーム/チャネルの台帳。
-- 会話取込スコープ制限の正本（このテーブルに登録されたチャネルのみ取込対象。RSC権限と二重防御）。
CREATE TABLE IF NOT EXISTS project_channels (
  team_id     TEXT NOT NULL,
  channel_id  TEXT NOT NULL,
  project_id  TEXT NOT NULL,
  github_owner TEXT,
  github_repo  TEXT,
  created_by  TEXT NOT NULL,
  ingestion   TEXT NOT NULL CHECK (ingestion IN ('active', 'paused', 'closed')) DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at   TIMESTAMPTZ,
  PRIMARY KEY (team_id, channel_id)
);
CREATE INDEX IF NOT EXISTS idx_project_channels_project ON project_channels (project_id);
-- rollback: DROP TABLE project_channels;

-- ADR-0005: チャネル会話の写し。保存前に sanitizeSecrets() を必ず通すこと（DevOps:REQ-030）。
-- Teams側の編集/削除は last_modified_at / deleted_at で追従（物理削除しない。監査整合のため）。
-- 保持期間: project_channels.closed_at から13か月後に当該チャネル分をDELETE（runbooks/channel-messages-purge.md）。
CREATE TABLE IF NOT EXISTS channel_messages (
  team_id          TEXT NOT NULL,
  channel_id       TEXT NOT NULL,
  message_id       TEXT NOT NULL,
  reply_to_id      TEXT,
  author_aad_id    TEXT,
  author_name      TEXT,
  content_type     TEXT NOT NULL CHECK (content_type IN ('html', 'text')),
  content          TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL,
  last_modified_at TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ,
  ingested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, channel_id, message_id),
  FOREIGN KEY (team_id, channel_id) REFERENCES project_channels (team_id, channel_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_messages_channel_time ON channel_messages (channel_id, created_at);
-- rollback: DROP TABLE channel_messages;

-- ADR-0005: Graphサブスクリプション台帳。renew対象・プロセス再起動後の復元・deltaLink永続化の正本。
-- mode: notification=change notification受信中 / polling=renew失敗時の5分deltaフォールバック（DevOps:SPEC-INT-001）
CREATE TABLE IF NOT EXISTS graph_subscriptions (
  subscription_id TEXT PRIMARY KEY,
  resource        TEXT NOT NULL,
  team_id         TEXT,
  channel_id      TEXT,
  expires_at      TIMESTAMPTZ NOT NULL,
  delta_link      TEXT,
  mode            TEXT NOT NULL CHECK (mode IN ('notification', 'polling')) DEFAULT 'notification',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- rollback: DROP TABLE graph_subscriptions;

-- ADR-0005: LLM使用量台帳（PgCostGuard。DevOps:SPEC-INT-060: 日次コスト上限をバッチ+WebチャットでSYSTEM全体共有）
CREATE TABLE IF NOT EXISTS llm_usage (
  usage_id  BIGSERIAL PRIMARY KEY,
  agent     TEXT NOT NULL,
  purpose   TEXT NOT NULL,
  model     TEXT NOT NULL,
  cost_usd  NUMERIC(10, 6) NOT NULL CHECK (cost_usd >= 0),
  cache_creation_input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (cache_creation_input_tokens >= 0),
  cache_read_input_tokens     BIGINT NOT NULL DEFAULT 0 CHECK (cache_read_input_tokens >= 0),
  at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_llm_usage_at ON llm_usage (at);
-- rollback: DROP TABLE llm_usage;

-- ADR-0006: AIコーディングタスク台帳（Teams/WebUI発のコーディング指示→GitHub Actions実行の追跡）
CREATE TABLE IF NOT EXISTS coding_tasks (
  task_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      TEXT NOT NULL,
  requested_by    TEXT NOT NULL,
  source          TEXT NOT NULL CHECK (source IN ('teams', 'webui')),
  instruction     TEXT NOT NULL,
  agent           TEXT NOT NULL CHECK (agent IN ('claude-code', 'droid')),
  status          TEXT NOT NULL CHECK (status IN ('queued', 'running', 'pr_created', 'failed', 'cancelled')) DEFAULT 'queued',
  workflow_run_id BIGINT,
  pr_url          TEXT,
  branch          TEXT,
  -- dispatch時に選ばれたGitHubリポジトリ。reaperはこの不変スコープに対して実行状態を観測する
  -- （reap時にproject_channelsから引き直すと、チャネル構成の変化で別リポジトリを見て誤終端する）。
  github_owner    TEXT,
  github_repo     TEXT,
  confirmed_at    TIMESTAMPTZ,
  confirm_token_hash TEXT,
  trace_id        UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coding_tasks_status ON coding_tasks (status);
CREATE INDEX IF NOT EXISTS idx_coding_tasks_project ON coding_tasks (project_id);
-- rollback: DROP TABLE coding_tasks;

-- ADR-0008 / REQ-037 / DevOps:SPEC-INT-063: Excelインポート台帳。
CREATE TABLE IF NOT EXISTS import_ledger (
  source_key     TEXT PRIMARY KEY,
  target_kind    TEXT NOT NULL CHECK (target_kind IN ('issue', 'project_item', 'milestone')),
  github_id      TEXT NOT NULL,
  import_run_id  UUID NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('pending', 'imported', 'skipped', 'failed')),
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_import_ledger_run ON import_ledger (import_run_id);
-- rollback: DROP TABLE import_ledger;

-- ============================================================
-- MIGRATIONS
-- ============================================================
-- 既存DBへのALTERは packages/devops/src/db/migrations/*.sql を順序適用する。
-- 新規DBは本schema.sqlで最新形を作成し、その後db:migrateでschema_migrationsを同期する。
