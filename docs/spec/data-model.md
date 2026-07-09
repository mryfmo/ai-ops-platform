# Data Model

The schema source of truth is [`packages/devops/src/db/schema.sql`](../../packages/devops/src/db/schema.sql). Tables are PostgreSQL-oriented and the app code assumes JSONB, UUID, and timestamptz support.

## Tables

| Table                 | Role                                                              | Main Columns                                                                                                                | Invariants                                                                                                            |
| --------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `events`              | Queue for inbound GitHub, monitor, and Graph/Teams notifications. | `event_id`, `trace_id`, `source`, `payload`, `status`, `received_at`                                                        | `source` is `github`, `monitor`, or `inbound`; `status` is `queued`, `dispatched`, `delayed`, or `done`.              |
| `pm_events`           | Normalized PM time-series events from GitHub webhook payloads.    | `event_name`, `action`, `project_id`, `repository`, `subject_type`, `from_status`, `to_status`, `normalized`, `raw_payload` | `subject_type` is limited to issue/PR/milestone/project item/project status; raw payload is sanitized before storage. |
| `pm_snapshots`        | Periodic snapshot/reconcile records for current PM state.         | `source_type`, `source_id`, `state`, `captured_at`, `payload`                                                               | Unique on `(source_type, source_id, captured_at)`; used to recover from missed webhooks.                              |
| `deployments`         | DevOps deploy state machine persistence.                          | `project_id`, `commit_sha`, `env`, `state`, `risk_score`, `approved_by`, `trace_id`                                         | `env` and `state` are checked against the TypeScript deploy state model.                                              |
| `incidents`           | Incident records.                                                 | `severity`, `severity_candidate`, `alert_rule_id`, `affected_projects`, `github_issue_url`, `resolution`                    | Severity and resolution are constrained enums.                                                                        |
| `grants`              | JIT permission grant ledger.                                      | `subject`, `subject_type`, `target`, `level`, `reason`, `expires_at`, `revoked_at`                                          | Active grants are rows with `revoked_at IS NULL`; expiry index supports revocation scans.                             |
| `recipients`          | DevOps report recipient/persona source.                           | `user_id`, `profile`, `email`, `projects`, `language`, `active`                                                             | `profile` is `PRF-M`, `PRF-L`, or `PRF-G`; inactive recipients are excluded by resolver logic.                        |
| `report_snapshots`    | DevOps report metric snapshots.                                   | `period_start`, `period_end`, `scope`, `metrics`                                                                            | `scope` is `user`, `project`, or `global`.                                                                            |
| `audit_log`           | Append-only audit ledger.                                         | `log_id`, `trace_id`, `actor`, `action`, `basis`, `detail`, `at`                                                            | Partitioned by `at`; app role must not have UPDATE/DELETE.                                                            |
| `partner_companies`   | External partner metadata.                                        | `company_id`, `name`, `region`, `language`, `teams_channel_id`, `notify_emails`                                             | `language` is `ja` or `en`.                                                                                           |
| `project_channels`    | Teams team/channel to project mapping.                            | `team_id`, `channel_id`, `project_id`, `ingestion`, `github_owner`, `github_repo`                                           | Primary key is `(team_id, channel_id)`; only registered channels are ingestion candidates.                            |
| `channel_messages`    | Sanitized copy of channel messages.                               | `team_id`, `channel_id`, `message_id`, `author_*`, `content`, timestamps                                                    | Foreign key to `project_channels`; edits/deletes are tracked by timestamps, not physical delete.                      |
| `graph_subscriptions` | Microsoft Graph subscription/delta-link ledger.                   | `subscription_id`, `resource`, `team_id`, `channel_id`, `expires_at`, `delta_link`, `mode`                                  | `mode` is `notification` or `polling`.                                                                                |
| `llm_usage`           | LLM usage/cost ledger.                                            | `agent`, `purpose`, `model`, `cost_usd`, `at`                                                                               | `cost_usd >= 0`; used by `PgCostGuard`.                                                                               |
| `coding_tasks`        | AI coding task workflow tracking.                                 | `task_id`, `project_id`, `instruction`, `agent`, `status`, `workflow_run_id`, `pr_url`, `confirmed_at`                      | Status is `queued`, `running`, `pr_created`, `failed`, or `cancelled`; dispatch requires confirmation flow.           |
| `import_ledger`       | Excel import idempotency ledger.                                  | `source_key`, `target_kind`, `github_id`, `import_run_id`, `status`                                                         | `source_key` is primary key; target kind is issue/project item/milestone.                                             |

## Derived Reads

- `/app/api/data/timeseries` reads `pm_events` and `pm_snapshots` for the requested period and filters by persona visibility before aggregation.
- `/app/api/data/agent-activity` reads `coding_tasks`.
- `PgCostGuard` reads/writes `llm_usage`.
- `PmSnapshotReconcileTask` writes `pm_snapshots`; it does not run if `GITHUB_PROJECT_NODE_ID` is unset.

## Notes

- `import_ledger` is the dedupe source of truth. The issue body import marker is a human trace marker, not a second production lookup path.
- The schema contains migration comments for ALTERs; actual infra migration rollout is outside this repository.
