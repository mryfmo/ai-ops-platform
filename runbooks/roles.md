<!-- 根拠: AUD-OPM-013 / 統合運用モデル監査 §2.6 -->

# Operational Roles and RACI

## Role definitions

This runbook uses only the four roles defined by the operating-model audit. Assigning a real person, account, mailbox, team, or group to any role is `TBD(HUMAN)`.

| Role                                                | Responsibility from the audit                                           | Assigned identity or group |
| --------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------- |
| PMO オペレータ                                      | 週次サイクル監視、AGT-01 エスカレーション受領、Excel 取込の差し戻し対応 | `TBD(HUMAN)`               |
| レポート承認者（PRF-03 以上、生成トリガー者と別人） | 対外レポートの配信前サインオフ                                          | `TBD(HUMAN)`               |
| 変更承認者                                          | AGT_CHG 承認カードの判断（Sev1 確定も同様）                             | `TBD(HUMAN)`               |
| プラットフォーム管理者                              | Graph サブスクリプション・recipients・シークレットローテーション        | `TBD(HUMAN)`               |

## RACI matrix

- **R**: performs the work.
- **A**: owns the outcome and final decision. Each activity has exactly one A.
- **C**: is consulted before the decision or execution.
- **I**: is informed of the result.
- **A/R**: the same role is both accountable and responsible.

| Activity                                                              | PMO オペレータ | レポート承認者 | 変更承認者 | プラットフォーム管理者 | Procedure and evidence                                                                                                                               |
| --------------------------------------------------------------------- | -------------- | -------------- | ---------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monitor the weekly reporting cycle and escalate missed runs           | A/R            | I              | I          | C                      | [Report delivery](report-delivery.md), [Observability and SLO](observability-slo.md)                                                                 |
| Receive and triage AGT-01 escalations                                 | A/R            | I              | C          | C                      | [Manual operations](manual-ops.md)                                                                                                                   |
| Return invalid Excel imports for correction                           | A/R            | I              | I          | C                      | [Excel import guide](../docs/guide/excel-import.md)                                                                                                  |
| Sign off external reports before delivery                             | R              | A              | I          | C                      | [Report delivery](report-delivery.md), [ADR-0012](../docs/adr/0012-agent-report-standardization.md)                                                  |
| Declare incident severity, including Sev1                             | C              | I              | A          | R                      | [Manual operations](manual-ops.md), [Production gates](production-gates.md)                                                                          |
| Coordinate technical incident recovery                                | C              | I              | A          | R                      | [Manual operations](manual-ops.md), [Coding-task failure](coding-task-failure.md)                                                                    |
| Decide a general AGT_CHG approval card                                | I              | I              | A/R        | C                      | [Production gates](production-gates.md), [ADR-0006](../docs/adr/0006-ai-coding-agent-integration.md)                                                 |
| Approve a production release or rollback                              | I              | I              | A          | R                      | [Production gates](production-gates.md), [Database migrations](database-migrations.md)                                                               |
| Review an AI-generated pull request and decide whether it may proceed | I              | I              | A/R        | C                      | [ADR-0006](../docs/adr/0006-ai-coding-agent-integration.md), [CODEOWNERS](../.github/CODEOWNERS), [PR template](../.github/PULL_REQUEST_TEMPLATE.md) |
| Operate and recover Graph subscriptions                               | I              | I              | C          | A/R                    | [Graph subscription recovery](graph-subscription-recovery.md), [Real-environment E2E](e2e-real-environment.md)                                       |
| Add, change, or deactivate recipients                                 | C              | C              | I          | A/R                    | [Report delivery](report-delivery.md), [Data model](../docs/spec/data-model.md)                                                                      |
| Rotate secrets and respond to credential exposure                     | I              | I              | C          | A/R                    | [Configuration reference](../docs/reference/configuration.md), [Production gates](production-gates.md)                                               |
| Approve privileged/JIT access and execute the approved change         | I              | I              | A          | R                      | [Manual operations](manual-ops.md), [Production gates](production-gates.md)                                                                          |
| Plan and execute approved backup or restore work                      | I              | I              | A          | R                      | [Database migrations](database-migrations.md), [Production gates](production-gates.md)                                                               |
| Independently validate restore evidence and approve completion        | C              | I              | A/R        | C                      | [Database migrations](database-migrations.md), [Production gates](production-gates.md)                                                               |

## Operating constraints

- The report approver must be PRF-03 or higher and must not be the person who triggered report generation.
- Human review remains mandatory for AI-generated pull requests; the requester or author must not be the reviewer or approver, self-review is prohibited, and this RACI does not authorize automatic merge.
- The platform administrator who executes a backup or restore must not independently validate or approve that same operation; the change approver owns evidence validation and completion approval.
- Production change, incident, access, backup, and restore evidence must be retained through the applicable linked procedure.
- Role-to-identity mappings must be approved by a human before production use and must not be stored in this repository until that decision is made.
