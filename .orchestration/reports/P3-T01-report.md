# P3-T01 report

- Status: implementation complete; awaiting independent reviewer / Owner merge
- Branch: `agent/P3-T01-temporal-connectivity`
- Writer: claude-code-fable5-xhigh / Reviewer: codex-gpt56-sol-high（P3-T01-REVIEW 発注）

## Delivered

- `deploy/temporal/`: dev 単一ノード compose（mTLS 既定・digest pin）、
  per-env 証明書生成 script（CA/server/worker/operator、90 日既定）、
  mTLS smoke（接続 + 拒否マトリクス）、起動/ローテーション RUNBOOK
- `deploy/aws/temporal/`: ECS Fargate 単一サービス + Secrets Manager TLS 資材 +
  SG 7233 内部限定の Terraform（validate/fmt 済み。apply は AWS baseline 後）
- `packages/control-plane`: `buildConnectionProfile`（namespace=aiops-<env>、
  task queue=正典 workflow kind 1:1）、証明書 identity 解析、
  接続前 fail-closed guard（E-TMP01）、`createTemporalConnection`
  （@temporalio/client 1.22.0 exact-pin、DI）

## 既知の制約（レビュー・後続タスクへの明示事項）

- OSS Temporal は config のみで mTLS identity → claim（namespace/task-queue/非 admin）の
  server 側強制ができない（custom claim mapper = Go 拡張）。本タスクの担保:
  (1) per-env CA による環境スコープの server 強制（smoke で実証）
  (2) client 側 fail-closed guard (3) operator 別 identity 運用。
  server 側 claim 強制（claim mapper 同梱の派生 image）は **P3 帯 follow-up タスク**
  として起票が必要（ENV-DEC-001 の authorizer 要件の完全充足はそこで）
- 出所不明の `.orchestration/tasks/P3-T01-temporal-provision.md`（同旨の草稿）を
  worktree で検出 — 本タスクの正本は `P3-T01-temporal-namespace-worker-connectivity.md`
