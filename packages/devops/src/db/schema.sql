-- packages/devops/src/db/schema.sql
--
-- 根拠: DevOps DOC-INT-04 §3 データ構造（SPEC-INT-050番台）
-- データストアはRDB（PostgreSQL想定）。本ファイルは全テーブル定義の正本。
-- 変更時は通常のPRレビューを経ること。

CREATE TABLE IF NOT EXISTS events (
  event_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id    UUID NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('github', 'monitor', 'inbound')),
  payload     JSONB NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('queued', 'dispatched', 'delayed', 'done')) DEFAULT 'queued',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_trace_id ON events (trace_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events (status);

-- ADR-0007 / PrjOps SPEC-INT-062 / DevOps SPEC-INT-081: GitHub PM時系列イベント。
-- projects_v2_item / projects_v2_status_update / issues / pull_request / milestone webhookを正規化し、
-- raw_payloadは保存前にsanitizeSecrets()を通すこと（REQ-036 / REQ-031）。
CREATE TABLE IF NOT EXISTS pm_events (
  event_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id    UUID NOT NULL,
  event_name  TEXT NOT NULL,
  action      TEXT,
  project_id  TEXT,
  repository  TEXT,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('issue', 'pull_request', 'milestone', 'project_item', 'project_status')),
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

-- ADR-0007 / DevOps AC-031a: 定期フルsnapshot。webhook取りこぼしreconcileの正本。
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

-- SPEC-INT-020 デプロイ状態機械の値のみ許可（lib/deployStateMachine.tsのDeployState型と一致させること）
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

-- SPEC-INT-053 権限台帳（grants）
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

-- SPEC-INT-054 配信名簿（recipients）
CREATE TABLE IF NOT EXISTS recipients (
  user_id  TEXT PRIMARY KEY,
  profile  TEXT NOT NULL CHECK (profile IN ('PRF-M', 'PRF-L', 'PRF-G')),
  email    TEXT NOT NULL,
  projects TEXT[] NOT NULL DEFAULT '{}',
  language TEXT NOT NULL CHECK (language IN ('ja', 'en')) DEFAULT 'ja',
  active   BOOLEAN NOT NULL DEFAULT true
);

-- SPEC-INT-055 report_snapshots
CREATE TABLE IF NOT EXISTS report_snapshots (
  snapshot_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start TIMESTAMPTZ NOT NULL,
  period_end   TIMESTAMPTZ NOT NULL,
  scope        TEXT NOT NULL CHECK (scope IN ('user', 'project', 'global')),
  metrics      JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SPEC-INT-056 audit_log（追記専用。REQ-028）
CREATE TABLE IF NOT EXISTS audit_log (
  log_id   BIGSERIAL PRIMARY KEY,
  trace_id UUID NOT NULL,
  actor    TEXT NOT NULL,
  action   TEXT NOT NULL,
  basis    TEXT NOT NULL,
  detail   JSONB NOT NULL,
  at       TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (at);
CREATE INDEX IF NOT EXISTS idx_audit_log_trace_id ON audit_log (trace_id);

-- audit_logへのUPDATE/DELETE権限をアプリロールへ付与しないこと（SPEC-INT-056: 追記専用の担保）。
-- 実運用のロール作成例（DDLはインフラ側のマイグレーションで管理。ここではコメントとして明記）:
--   REVOKE UPDATE, DELETE ON audit_log FROM app_role;
--   GRANT INSERT, SELECT ON audit_log TO app_role;

-- SPEC-INT-057 partner_companies
CREATE TABLE IF NOT EXISTS partner_companies (
  company_id      TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  region          TEXT,
  language        TEXT NOT NULL CHECK (language IN ('ja', 'en')) DEFAULT 'en',
  teams_channel_id TEXT,
  notify_emails   TEXT[] NOT NULL DEFAULT '{}'
);

-- 月次パーティション作成例（audit_logの13か月保持ローテーション。REQ-028: 保持1年）
-- CREATE TABLE audit_log_2026_07 PARTITION OF audit_log
--   FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
-- 13か月経過したパーティションはDROP TABLEで削除する運用スクリプトを別途 /runbooks に用意する。

-- ============================================================
-- ADR-0005: 常駐サーバ+Teams統合（プロジェクト専用チャネルの会話取込）
-- ============================================================

-- ADR-0005: プロジェクト専用チーム/チャネルの台帳。
-- 会話取込スコープ制限の正本（このテーブルに登録されたチャネルのみ取込対象。RSC権限と二重防御）。
CREATE TABLE IF NOT EXISTS project_channels (
  team_id     TEXT NOT NULL,
  channel_id  TEXT NOT NULL,
  project_id  TEXT NOT NULL,
  created_by  TEXT NOT NULL,
  ingestion   TEXT NOT NULL CHECK (ingestion IN ('active', 'paused', 'closed')) DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at   TIMESTAMPTZ,
  PRIMARY KEY (team_id, channel_id)
);
CREATE INDEX IF NOT EXISTS idx_project_channels_project ON project_channels (project_id);
-- rollback: DROP TABLE project_channels;

-- ADR-0005: チャネル会話の写し。保存前に sanitizeSecrets() を必ず通すこと（REQ-030）。
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
-- mode: notification=change notification受信中 / polling=renew失敗時の5分deltaフォールバック（SPEC-INT-001）
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

-- ADR-0005: LLM使用量台帳（PgCostGuard。SPEC-INT-060: 日次コスト上限をバッチ+WebチャットでSYSTEM全体共有）
CREATE TABLE IF NOT EXISTS llm_usage (
  usage_id  BIGSERIAL PRIMARY KEY,
  agent     TEXT NOT NULL,
  purpose   TEXT NOT NULL,
  model     TEXT NOT NULL,
  cost_usd  NUMERIC(10, 6) NOT NULL CHECK (cost_usd >= 0),
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
  trace_id        UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coding_tasks_status ON coding_tasks (status);
CREATE INDEX IF NOT EXISTS idx_coding_tasks_project ON coding_tasks (project_id);
-- rollback: DROP TABLE coding_tasks;

-- ============================================================
-- MIGRATIONS（既存テーブルへのALTER。CLAUDE.md「既存テーブルのALTERは別途DDLコメントで明示」）
-- ============================================================

-- 2026-07-07 ADR-0005 / SPEC-INT-033: project_channelsにGitHubリポジトリ紐付け列を追加。
-- Teamsチャネルからの /gh pr list, /gh issue list, /gh issue create 照会コマンド（AGT-teamsConversationAgent）が
-- projectIdからGitHubリポジトリを解決するために使用する。未設定（NULL）の場合、当該プロジェクトのGitHub照会
-- コマンドは「このプロジェクトにはGitHubリポジトリが未登録です」を返して終了する（実行時ガード、DB制約ではない）。
ALTER TABLE project_channels ADD COLUMN IF NOT EXISTS github_owner TEXT;
ALTER TABLE project_channels ADD COLUMN IF NOT EXISTS github_repo TEXT;
-- rollback: ALTER TABLE project_channels DROP COLUMN IF EXISTS github_owner; ALTER TABLE project_channels DROP COLUMN IF EXISTS github_repo;

-- 2026-07-07 ADR-0006: coding_tasksに確認フロー用の列を追加。
-- 「誤発火防止のため人間の明示クリック必須」（ADR-0006決定3）を満たすため、Teams/WebUIからの
-- code_task指示は即座にworkflow_dispatchせず、まずstatus='queued'でINSERTし、確認リンク
-- （taskId + confirmTokenのHMAC-SHA256、packages/server/src/lib/confirmToken.ts）を発行する。
-- confirm_token_hashは平文トークンではなくハッシュを保存する（DB漏洩時にリンクを再構成されないため）。
-- confirmed_atは人間がGET/POST /coding-tasks/:taskId/confirmを通過した時刻（NULLのまま＝未確認）。
ALTER TABLE coding_tasks ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE coding_tasks ADD COLUMN IF NOT EXISTS confirm_token_hash TEXT;
-- rollback: ALTER TABLE coding_tasks DROP COLUMN IF EXISTS confirmed_at; ALTER TABLE coding_tasks DROP COLUMN IF EXISTS confirm_token_hash;
