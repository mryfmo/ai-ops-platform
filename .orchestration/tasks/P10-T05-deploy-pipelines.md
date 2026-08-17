# P10-T05: Implement deployment pipelines and provenance

- task_id: P10-T05
- writer: codex-deep-dot（WBS どおり codex）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P10-T01 ✅（#248）
- requirement_refs: PRD-010 / FR-CP-008 / FR-OBS-005
- adr_refs: ADR-0016 / ADR-0028
- acceptance_gate_ids: REL-003（pipeline staging 実測は AWS 到達後 —
  本タスクは workflow/actionlint/構造検証まで）
- risk: medium
- **並行注意**: open PR #255（deploy/aws/modules/identity・secrets-manager・
  ecs-fargate・envs・validate-modules.sh・test-identity-secrets.sh・
  runbooks/aws-secret-rotation-break-glass.md）。**これらへ接触禁止**。
  deploy 側で identity 出力（OIDC role 等）を参照する場合は
  **#255 merge 後に結線**（順序条件 — それまで workflow は変数 placeholder）

## Canon / 前提

- WBS deliverables: build / sign / SBOM / provenance / staged rollout
- acceptance: **digest deploy**（tag 不可）/ environment approvals / rollback
- 既存規範: 全 image は digest pin（LiteLLM/agentgateway/OPA/Temporal で確立）、
  GitHub OIDC のみ（P10-T03）、governance guard（P8-T02 — workflows は
  guard の無条件 forbidden 対象なので、本タスクの workflow 追加は
  **人間 merge の通常 PR 経由**であり矛盾しない）
- 既存 `.github/workflows/`（ci.yml / coding-task.yml /
  coding-task-review.yml / report-generation.yml）の規約・actionlint

## Objective

1. **build/publish workflow**（`.github/workflows/`）: image build →
   **digest 固定 push**（ECR、tag は immutable + digest 記録）→
   **SBOM 生成**（syft 等 action は SHA pin）→ **provenance/署名**
   （SLSA provenance / cosign keyless — OIDC。実行は AWS/レジストリ到達後、
   構造とガードを先に固定）
2. **staged rollout workflow**: staging → approval gate
   （GitHub Environments required reviewers）→ prod canary 0/10/50/100 →
   自動 rollback 条件の骨格（実測は REL-003 の staging test で）
3. **構造検証**: P8-T06 の workflow-validator パターンを踏襲した
   deploy workflow 検証（contracts 系）:
   - **digest deploy 強制**: tag 参照（:latest 等）の workflow 内出現を reject
   - environment approvals の宣言存在 / OIDC のみ（long-lived secret 参照
     禁止 — `secrets.AWS_ACCESS_KEY` 系の出現 reject。GitHub 環境 secret の
     使用は provenance 署名等の必要最小限を allowlist）
   - action の SHA pin 強制（`@v` 系 tag 参照 reject）
4. rollback 手順の runbook（新規ファイル — #255 の runbook と別ファイル）

## Acceptance（WBS）

- digest deploy / environment approvals / rollback（構造検証 + runbook。
  実測は AWS staging 到達後の deferred と明記）

## Forbidden

- open PR #255 変更ファイルへの接触 / 実 credential・実 push
- 既存必須 check の弱体化 / 依存追加 / main direct push / merge / approve

## Scope / allowed_paths（WBS + 並行制約）

- `.github/workflows/**`（新規 workflow）/ `deploy/**`（新規ファイルのみ。
  #255 対象外）/ `contracts/**`（deploy workflow validator + package.json
  test 1 行）/ `runbooks/**`（新規）
- `.orchestration/**`（証跡）

## Validation

- actionlint / contracts tests（validator 正負 fixture）green
- fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P10-T05-deploy-pipelines`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P10-T05-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P10-T05 status=ready_for_review
