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

-- DevOps:SPEC-INT-020 デプロイ状態。dispatch_failedはworkflow dispatch境界の運用上の終端状態。
CREATE TABLE IF NOT EXISTS deployments (
  deploy_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   TEXT NOT NULL,
  github_owner TEXT,
  github_repo  TEXT,
  commit_sha   TEXT NOT NULL,
  env          TEXT NOT NULL CHECK (env IN ('dev', 'staging', 'prod')),
  state        TEXT NOT NULL CHECK (state IN (
                  'pending', 'staging_deployed', 'approval_requested', 'approved',
                  'rejected', 'expired', 'prod_deploying', 'monitoring', 'stable',
                  'rolling_back', 'rolled_back', 'dispatch_failed'
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

-- PrjOps:REQ-009 / SPEC-INT-025: resident AGT-06 operational reminder state。
-- pinned prjops-data snapshotはread-onlyのため、送信成功直後のcount/escalationをDBで永続化する。
CREATE TABLE IF NOT EXISTS action_reminder_state (
  action_id             TEXT PRIMARY KEY CHECK (action_id ~ '^ACT-[0-9]+$'),
  reminders_sent_count  INT NOT NULL DEFAULT 0 CHECK (reminders_sent_count BETWEEN 0 AND 3),
  last_notified_at      TIMESTAMPTZ,
  escalated_at          TIMESTAMPTZ,
  CHECK (reminders_sent_count = 0 OR last_notified_at IS NOT NULL),
  CHECK (escalated_at IS NULL OR last_notified_at IS NOT NULL)
);
-- rollback: DROP TABLE action_reminder_state;

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
    GRANT SELECT, INSERT, UPDATE ON action_reminder_state TO app_role;
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
  source           TEXT NOT NULL DEFAULT 'teams' CHECK (btrim(source) <> ''),
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_messages_source_message ON channel_messages (source, message_id);
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

-- DevOps:SPEC-EXT-010 / AUD-OPM-001: 人間承認の状態正本。
CREATE TABLE IF NOT EXISTS approvals (
  approval_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_type       TEXT NOT NULL CHECK (approval_type IN ('change', 'report', 'jit_grant')),
  target_id           TEXT NOT NULL,
  project_id          TEXT,
  target_sha          TEXT CHECK (target_sha IS NULL OR target_sha ~ '^[0-9a-f]{40}$'),
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by        TEXT NOT NULL,
  approver_tenant_id  UUID,
  approver_object_id  UUID,
  decided_at          TIMESTAMPTZ,
  reason              TEXT,
  delivered_at        TIMESTAMPTZ,
  dispatched_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- P1-T05 expand（FinalArch:CON-003 / DELTA-03）: 冪等承認・CAS・期限。既存行は NULL 許容。
  -- ALTER 追記との列順一致のため created_at の後に置く
  payload_hash        TEXT,
  expected_version    BIGINT,
  expires_at          TIMESTAMPTZ,
  CHECK (
    (status = 'pending' AND approver_tenant_id IS NULL AND approver_object_id IS NULL AND decided_at IS NULL AND reason IS NULL)
    OR (status = 'approved' AND approver_tenant_id IS NOT NULL AND approver_object_id IS NOT NULL AND decided_at IS NOT NULL)
    OR (status = 'rejected' AND approver_tenant_id IS NOT NULL AND approver_object_id IS NOT NULL AND decided_at IS NOT NULL
        AND NULLIF(btrim(reason), '') IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_approvals_pending ON approvals (created_at, approval_id) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS idx_approvals_pending_target
  ON approvals (approval_type, target_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_approvals_approved_undispatched
  ON approvals (decided_at, approval_id)
  WHERE approval_type = 'change' AND status = 'approved' AND dispatched_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_approvals_pending_expiry
  ON approvals (expires_at)
  WHERE status = 'pending' AND expires_at IS NOT NULL;
-- rollback: DROP TABLE approvals;

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
-- P1-T05: 制御プレーン ledger（FinalArch:CON-003 / FR-CP-001 / ADR-0020。
-- 設計正本: docs/plans/2026-08-final-architecture/05_contracts/ledger-migration-design.sql）
-- DELTA-03: 人間承認の正本は既存 approvals、デプロイ 12 状態機械の正本は既存 deployments。
-- 本節は並行正本を作らず、approval 連携は approvals(approval_id) への参照で表す。
-- ============================================================

-- FinalArch:FR-CP-001: workflow の read model。workflow_id は control-plane の
-- buildWorkflowId（"<kind>/<businessKey>"）。真の実行履歴の正本は Temporal（P3-T01）。
CREATE TABLE IF NOT EXISTS workflow_runs (
  workflow_id     TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL,
  workflow_type   TEXT NOT NULL CHECK (workflow_type IN (
                    'meeting', 'coding-task', 'incident', 'report',
                    'plane-sync', 'graph-subscription', 'knowledge-publication'
                  )),
  business_key    TEXT NOT NULL,
  project_id      TEXT,
  status          TEXT NOT NULL CHECK (status IN ('accepted', 'running', 'waiting', 'completed', 'failed', 'cancelled')),
  current_step    TEXT,
  waiting_reason  TEXT,
  version         BIGINT NOT NULL DEFAULT 0,
  trace_id        UUID NOT NULL,
  correlation_id  UUID NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  UNIQUE (workflow_type, business_key)
);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs (status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_project ON workflow_runs (project_id);
-- rollback: DROP TABLE workflow_runs;

-- FinalArch:PRD-001 / FinalArch:FR-UI-001 / FinalArch:FR-UI-003 / ADR-0025 / UX-001:
-- channel address から workflow への唯一の mapping 正本。initiating identity を同じ行に束縛し、
-- lookup は address + provider + tenant + subject の完全一致だけを返す。
CREATE TABLE IF NOT EXISTS channel_conversation_mappings (
  source                   TEXT NOT NULL CHECK (btrim(source) <> ''),
  platform_conversation_id TEXT NOT NULL CHECK (btrim(platform_conversation_id) <> ''),
  platform_thread_id       TEXT CHECK (platform_thread_id IS NULL OR btrim(platform_thread_id) <> ''),
  identity_provider        TEXT NOT NULL CHECK (btrim(identity_provider) <> ''),
  tenant_id                TEXT NOT NULL CHECK (btrim(tenant_id) <> ''),
  subject_id               TEXT NOT NULL CHECK (btrim(subject_id) <> ''),
  conversation_id          TEXT NOT NULL CHECK (btrim(conversation_id) <> ''),
  thread_id                TEXT NOT NULL CHECK (btrim(thread_id) <> ''),
  workflow_id              TEXT NOT NULL REFERENCES workflow_runs(workflow_id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT channel_conversation_mappings_address_unique
    UNIQUE NULLS NOT DISTINCT (source, platform_conversation_id, platform_thread_id)
);
-- rollback: DROP TABLE channel_conversation_mappings;

-- FinalArch:CON-003: 外部副作用の冪等 ledger。approval を要する操作は approvals を参照する
-- （DELTA-03: 承認の並行正本を作らない。deployments の状態機械はここに写像しない）。
CREATE TABLE IF NOT EXISTS action_ledger (
  operation_id     UUID PRIMARY KEY,
  workflow_id      TEXT NOT NULL REFERENCES workflow_runs(workflow_id),
  system           TEXT NOT NULL,
  operation        TEXT NOT NULL,
  resource_key     TEXT NOT NULL,
  input_hash       TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN (
                     'planned', 'approval_pending', 'approved', 'applying', 'applied',
                     'rejected', 'failed', 'unknown', 'compensated'
                   )),
  approval_id      UUID REFERENCES approvals(approval_id),
  -- DELTA-03: deploy 系操作は既存 deployments 状態機械が正本。action_ledger の行は
  -- 外部呼び出しの冪等性のみを追跡し、必ず正本行へ anchor する（並行正本の禁止を CHECK で強制）
  deployment_id    UUID REFERENCES deployments(deploy_id),
  external_id      TEXT,
  external_version TEXT,
  attempt_count    INT NOT NULL DEFAULT 0,
  last_error_class TEXT,
  trace_id         UUID NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (system, operation, resource_key, input_hash),
  CONSTRAINT action_ledger_deployment_authority CHECK (system <> 'deployments' OR deployment_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_action_ledger_workflow ON action_ledger (workflow_id);
CREATE INDEX IF NOT EXISTS idx_action_ledger_status ON action_ledger (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_action_ledger_operation_approval
  ON action_ledger (operation_id, approval_id);
-- rollback: DROP TABLE action_ledger;

-- FinalArch:PRD-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-004 /
-- FinalArch:FR-UI-005 / FinalArch:FR-UI-006 / ADR-0025 / UX-003:
-- Workbench は presentation read model であり、正本内容・workflow/action/approval 状態を複製しない。
CREATE TABLE IF NOT EXISTS workbench_workspaces (
  workspace_id  UUID PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('project', 'repository', 'meeting', 'incident')),
  project_id    TEXT NOT NULL CHECK (btrim(project_id) <> ''),
  owner_user_id TEXT NOT NULL REFERENCES recipients(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workbench_workspaces_project ON workbench_workspaces (project_id);

-- 外部 SoR の参照 metadata だけを保持する。本文・payload・summary は列として持たない。
CREATE TABLE IF NOT EXISTS workbench_workspace_sources (
  source_ref_id UUID PRIMARY KEY,
  workspace_id  UUID NOT NULL REFERENCES workbench_workspaces(workspace_id) ON DELETE CASCADE,
  source_system TEXT NOT NULL CHECK (source_system IN ('github', 'sharepoint', 'confluence', 'temporal')),
  source_type   TEXT NOT NULL CHECK (source_type ~ '^[a-z][a-z0-9_-]{0,63}$'),
  external_id   TEXT NOT NULL CHECK (btrim(external_id) <> '' AND length(external_id) <= 512),
  canonical_url TEXT NOT NULL CHECK (
    canonical_url ~ '^https://[^?#[:space:]]+$' AND canonical_url !~ '^https://[^/]*@'
  ),
  linked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, source_system, external_id)
);

-- workflow state は Temporal / workflow_runs が正本。Workbench は workflow_id link だけを保持する。
CREATE TABLE IF NOT EXISTS workbench_workspace_runs (
  workspace_id UUID NOT NULL REFERENCES workbench_workspaces(workspace_id) ON DELETE CASCADE,
  workflow_id  TEXT NOT NULL REFERENCES workflow_runs(workflow_id),
  linked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, workflow_id)
);

-- 実行・承認 authority は action_ledger / approvals。Workbench は一致する authority pair の参照だけを保持する。
CREATE TABLE IF NOT EXISTS workbench_pending_actions (
  workspace_id UUID NOT NULL REFERENCES workbench_workspaces(workspace_id) ON DELETE CASCADE,
  operation_id UUID NOT NULL,
  approval_id  UUID NOT NULL REFERENCES approvals(approval_id),
  linked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, operation_id),
  FOREIGN KEY (operation_id, approval_id)
    REFERENCES action_ledger(operation_id, approval_id)
);
-- rollback: DROP TABLE workbench_pending_actions, workbench_workspace_runs,
--   workbench_workspace_sources, workbench_workspaces;
-- rollback: DROP INDEX idx_action_ledger_operation_approval;

-- FinalArch:CON-004: OPA 判定の記録（判定の実体は policy bundle。ここは証跡）。
CREATE TABLE IF NOT EXISTS policy_decisions (
  decision_id           UUID PRIMARY KEY,
  workflow_id           TEXT,
  actor_id              TEXT NOT NULL,
  action                TEXT NOT NULL,
  resource              JSONB NOT NULL,
  input_hash            TEXT NOT NULL,
  policy_bundle_version TEXT NOT NULL,
  decision              TEXT NOT NULL CHECK (decision IN ('allow', 'deny', 'require_approval')),
  reasons               JSONB NOT NULL,
  obligations           JSONB NOT NULL,
  trace_id              UUID NOT NULL,
  decided_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_policy_decisions_workflow ON policy_decisions (workflow_id);
-- rollback: DROP TABLE policy_decisions;

-- FinalArch:PRD-003: モデル呼び出し台帳（コスト・ルーティング証跡。llm_usage は現行経路の
-- 正本のまま維持し、P2 の LiteLLM 経路がこちらへ記録する）。
CREATE TABLE IF NOT EXISTS model_invocations (
  invocation_id           UUID PRIMARY KEY,
  workflow_id             TEXT,
  model_alias             TEXT NOT NULL,
  provider_binding        TEXT NOT NULL,
  provider_model_revision TEXT NOT NULL,
  route_reason            TEXT NOT NULL,
  classification          TEXT NOT NULL,
  input_tokens            BIGINT,
  output_tokens           BIGINT,
  cost_usd                NUMERIC(18, 8),
  latency_ms              BIGINT,
  status                  TEXT NOT NULL,
  error_class             TEXT,
  trace_id                UUID NOT NULL,
  invoked_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_model_invocations_workflow ON model_invocations (workflow_id);
-- rollback: DROP TABLE model_invocations;

-- FinalArch:CON-005: MCP tool 呼び出し台帳。approval 連携は approvals を参照（DELTA-03）。
CREATE TABLE IF NOT EXISTS tool_invocations (
  invocation_id      UUID PRIMARY KEY,
  workflow_id        TEXT,
  server_id          TEXT NOT NULL,
  server_version     TEXT NOT NULL,
  tool_name          TEXT NOT NULL,
  risk_level         TEXT NOT NULL CHECK (risk_level IN ('L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6')),
  resource_scope     JSONB NOT NULL,
  policy_decision_id UUID REFERENCES policy_decisions(decision_id),
  approval_id        UUID REFERENCES approvals(approval_id),
  latency_ms         BIGINT,
  status             TEXT NOT NULL,
  error_class        TEXT,
  trace_id           UUID NOT NULL,
  invoked_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tool_invocations_workflow ON tool_invocations (workflow_id);
-- rollback: DROP TABLE tool_invocations;

-- ADR-0024 / WIQ-001 / WIQ-002 / WIQ-005: delegated `/m365/query` の
-- metadata-only receipt。question/response 原文は列として保持しない。
-- DELTA-03: 将来 gateway 経由に移行する場合、policy_decision_id / trace_id で
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

-- FinalArch:CON-002: SoR 間 ID 対応の versioned mapping。
-- 現行値の正本は id_mapping_heads（論理キー PK の単一行。単調 version CAS は
-- ON CONFLICT DO UPDATE + WHERE で行い、READ COMMITTED の並行実行でも
-- EvalPlanQual により最新行と比較される）。id_mappings は受理された全版の
-- 追記専用履歴（UPDATE/DELETE しない）。
CREATE TABLE IF NOT EXISTS id_mapping_heads (
  project_id       TEXT NOT NULL,
  source_system    TEXT NOT NULL,
  source_object_id TEXT NOT NULL,
  target_system    TEXT NOT NULL,
  target_object_id TEXT NOT NULL,
  mapping_version  BIGINT NOT NULL,
  provenance       JSONB NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, source_system, source_object_id, target_system)
);
-- rollback: DROP TABLE id_mapping_heads;

CREATE TABLE IF NOT EXISTS id_mappings (
  mapping_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       TEXT NOT NULL,
  source_system    TEXT NOT NULL,
  source_object_id TEXT NOT NULL,
  target_system    TEXT NOT NULL,
  target_object_id TEXT NOT NULL,
  mapping_version  BIGINT NOT NULL,
  provenance       JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, source_system, source_object_id, target_system, mapping_version)
);
CREATE INDEX IF NOT EXISTS idx_id_mappings_project ON id_mappings (project_id);
-- rollback: DROP TABLE id_mappings;

-- FinalArch:PRD-005: 会議成果物（抽出・レビュー・公開状態）。
CREATE TABLE IF NOT EXISTS meeting_artifacts (
  meeting_artifact_id    UUID PRIMARY KEY,
  m365_meeting_id        TEXT NOT NULL,
  wispr_meeting_id       TEXT,
  project_id             TEXT,
  source_version         TEXT NOT NULL,
  correlation_confidence NUMERIC(5, 4),
  extraction             JSONB NOT NULL,
  review_status          TEXT NOT NULL CHECK (review_status IN ('pending', 'approved', 'rejected', 'partial')),
  publication_status     JSONB NOT NULL,
  trace_id               UUID NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (m365_meeting_id, source_version)
);
CREATE INDEX IF NOT EXISTS idx_meeting_artifacts_project ON meeting_artifacts (project_id);
-- rollback: DROP TABLE meeting_artifacts;

-- ADR-0027 / FinalArch:GOV-005: AI コーディングタスクの実行台帳（one-writer 証跡）。
-- 現行経路の coding_tasks は正本のまま維持し、FinalArch 経路（P8 帯）がこちらへ記録する。
CREATE TABLE IF NOT EXISTS agent_runs (
  agent_run_id        UUID PRIMARY KEY,
  workflow_id         TEXT,
  task_id             TEXT NOT NULL UNIQUE,
  writer              TEXT NOT NULL,
  reviewer            TEXT NOT NULL,
  branch              TEXT,
  commit_sha          TEXT,
  pull_request_url    TEXT,
  allowed_paths       JSONB NOT NULL,
  acceptance_gate_ids JSONB NOT NULL,
  execution_evidence  JSONB NOT NULL,
  status              TEXT NOT NULL,
  trace_id            UUID NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (writer <> reviewer)
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs (status);
-- rollback: DROP TABLE agent_runs;

-- PrjOps:REQ-004/005 / PrjOps:SPEC-INT-030 / FinalArch:ING-001:
-- source dedupe・thread clarification count・effect/terminal receipt の operational authority。
-- channel 原文と canonical status update は保持しない。
CREATE TABLE IF NOT EXISTS status_ingest_records (
  source_key             TEXT PRIMARY KEY,
  thread_key             TEXT NOT NULL CHECK (btrim(thread_key) <> ''),
  channel                TEXT NOT NULL CHECK (channel IN ('email', 'teams', 'github')),
  source_message_id      TEXT NOT NULL CHECK (source_message_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$'),
  prior_clarify_count    SMALLINT NOT NULL CHECK (prior_clarify_count BETWEEN 0 AND 3),
  clarify_count          SMALLINT NOT NULL CHECK (clarify_count BETWEEN 0 AND 3),
  action                 TEXT NOT NULL CHECK (action IN ('accept', 'clarify', 'escalate_incomplete')),
  state                  TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'complete')),
  revision               BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  side_effects           JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(side_effects) = 'object'),
  canonical_reference    TEXT,
  notification_reference TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT status_ingest_source_identity UNIQUE (channel, source_message_id),
  CONSTRAINT status_ingest_source_key_check CHECK (
    source_key = 'status-ingest:' || channel || ':' || source_message_id
  ),
  CONSTRAINT status_ingest_clarification_transition_check CHECK (
    (action = 'clarify' AND prior_clarify_count < 3 AND clarify_count = prior_clarify_count + 1) OR
    (action = 'accept' AND clarify_count = prior_clarify_count) OR
    (action = 'escalate_incomplete' AND prior_clarify_count = 3 AND clarify_count = 3)
  ),
  CONSTRAINT status_ingest_terminal_receipt_check CHECK (
    (state = 'pending' AND canonical_reference IS NULL AND notification_reference IS NULL) OR
    (
      state = 'complete' AND btrim(notification_reference) <> '' AND
      (
        (action = 'accept' AND btrim(canonical_reference) <> '') OR
        (action <> 'accept' AND canonical_reference IS NULL)
      )
    )
  )
);
CREATE INDEX IF NOT EXISTS idx_status_ingest_records_thread
  ON status_ingest_records (thread_key, created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_role') THEN
    REVOKE DELETE, TRUNCATE ON status_ingest_records FROM app_role;
    GRANT SELECT, INSERT, UPDATE ON status_ingest_records TO app_role;
  END IF;
END;
$$;
-- rollback: DROP TABLE status_ingest_records;

-- ============================================================
-- MIGRATIONS
-- ============================================================
-- 既存DBへのALTERは packages/devops/src/db/migrations/*.sql を順序適用する。
-- 新規DBは本schema.sqlで最新形を作成し、その後db:migrateでschema_migrationsを同期する。
