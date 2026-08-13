# P3-T01 Temporal namespace / worker connectivity

- task_id: `P3-T01`
- 根拠: FinalArch:TMP-001 / PRD-001 / PRD-002 / PRD-010 / FR-CP-001..008 / ADR-0021 / ADR-0029 / ENV-DEC-001（案 B'）
- Writer: claude-code-fable5-xhigh（WBS 指定） / Reviewer: codex-gpt56-sol-high
- depends_on: P1-T01（scaffold）/ P0-T07（ENV-DEC-001）— 済。P3 entry 充足
  （profile 決定 = ENV-DEC-001 承認済み）
- branch: `agent/P3-T01-temporal-connectivity`

## allowed_paths（WBS）

1. `deploy/temporal/**`（新設）
2. `deploy/aws/**`（新設 — Terraform。ADR-0029/P0-T07a どおり Bicep でなく Terraform）
3. `packages/control-plane/**`

（付随: `@temporalio/client`/`@temporalio/worker` の exact-pin 追加に伴う package.json/pnpm-lock
変更、および transitive `@swc/core` の build script を明示 deny する `pnpm-workspace.yaml`
allowBuilds エントリ（`"@swc/core": false`）は本タスクの本質的必要物として許可対象。
【scope amendment 2026-08-13 — review finding 013: このエントリを除去すると clean runner が
`ERR_PNPM_IGNORED_BUILDS` で install 不能（GH run 31660134456）。deny 明示は build script の
実行を一切許可しない安全側の記載であり、依存追加（@temporalio/worker → @swc/core transitive）
の機械的随伴物】。gitleaks/format/traceability の全 gate 維持）

## deliverables（WBS + ENV-DEC-001）

- **dev compose**: `deploy/temporal/docker-compose.yml` — Temporal OSS 単一ノード
  （pinned digest）+ PostgreSQL + UI（internal）。**mTLS を dev でも既定**
  （ENV-DEC: 信頼境界の dev/本番乖離を作らない）
- **mTLS worker 認証**: per-env CA + server 証明書 + per-worker クライアント証明書の
  生成/ローテーション script（証明書実体は git 管理外）。worker identity 命名規約
  （environment + namespace + task-queue スコープ、admin は運用者別 identity）
- **Terraform（ECS Fargate 単一サービス + RDS 追加 DB + Secrets Manager 証明書管理 +
  SG 7233 内部限定）**: `deploy/aws/temporal/` — AWS アカウント未整備のため
  `terraform init -backend=false` + `validate` + `fmt -check` の静的検証まで
  （apply は AWS env/ENV gate 後）
- **worker connectivity（packages/control-plane）**: 接続プロファイル
  （env → namespace `aiops-<env>`・workflow kind 別 task queue・mTLS 資格 DI）、
  `@temporalio/client` による接続 factory、**cert identity と profile の整合を
  接続前に検証する client 側 fail-closed guard**
- **起動 runbook**: `deploy/temporal/RUNBOOK.md`（compose/Apple container 両手順、
  namespace・task queue 初期化、cert 発行/ローテーション、admin identity 分離）

## 既知の設計制約（正直に記録し review で判定）

- OSS Temporal の config-only では mTLS identity → claim（namespace/task-queue/非 admin）
  の server 側 enforcement は不可（custom claim mapper = Go 拡張が必要）。本タスクでは
  (a) **environment スコープは per-env CA で server 側強制**（越境 cert は TLS 拒否）、
  (b) namespace/task-queue/非 admin は client 側 fail-closed guard + 運用規約で担保し、
  (c) server 側 claim enforcement（custom claim mapper 同梱の派生 image）を P3 帯の
  follow-up タスク要件として runbook/report に明記する

## verification（WBS）

- **Temporal connection smoke**（ローカル、Apple container）: mTLS で接続し
  namespace describe が成功
- **denial tests**: (1) 別 env CA の worker cert → TLS handshake 拒否
  (2) cert なし → 拒否 (3) profile と cert identity 不整合 → client 側 guard が接続前に拒否
- unit tests（vitest。接続 factory・guard・命名規約）
- `terraform validate` / `fmt -check` green
- fresh 使い捨て DB で `mise run ci` exit 0 を単独判定してから push

## 成果物パス

- report/validation/sandbox/learning/autoskill: `.orchestration/*/P3-T01-*.md`
