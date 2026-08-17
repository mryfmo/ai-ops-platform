# P10-T04: Implement database roles/schemas/backups

- task_id: P10-T04
- writer: codex-deep-dot（WBS どおり codex）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P10-T01 ✅（#248 merged）/ P1-T05 ✅
- requirement_refs: PRD-010 / FR-CP-008 / FR-OBS-005
- adr_refs: ADR-0016 / ADR-0028
- acceptance_gate_ids: REL-001（restore 実測は AWS env 到達後 —
  本タスクは module/SQL/手順 + local 検証まで）
- risk: medium
- **並行注意**: open PR #250-#253。deploy/aws は #248 merge 済みの
  modules/envs が基底。**#248 の既存ファイル変更は最小限**（rds module の
  変数/出力拡張は可 — 変更内容を report に列挙）。他 open PR ファイル接触禁止

## Canon / 前提

- runtime spec: **専用論理 DB/role/schema**（LiteLLM/Temporal/app の分離 —
  P2/P3 で確立済みの前提を IaC 化）、audit append-only
  （app role へ audit_log の UPDATE/DELETE を付与しない — schema.sql の
  REVOKE 群と整合）
- P10-T01 の rds/secrets-manager/identity module 構造・validate-modules.sh
  の credential guard / floci 検証パターン
- `packages/devops/src/db/schema.sql` の既存 role/grant 設計
  （status_ingest/work_iq/workbench の append-only trigger 含む）

## Objective

1. **Terraform**: RDS 配下の論理 DB/role/schema 構成（app/litellm/temporal/
   readonly 等の分離、password は Secrets Manager 参照 — 実値なし）、
   **PITR + LTR backup 設定**、パラメータ（SSL 強制等）
2. **role provisioning SQL/手順**（`deploy/aws/` or
   `packages/devops/src/db/`）: 環境初期化の冪等 script —
   **audit mutation prohibited**（audit_log 系への UPDATE/DELETE 権限を
   どの app role にも付与しない）を機械検証可能な形で
3. **restore 手順**（`runbooks/`）: same-region restore / PITR 復元の
   手順書（実測は AWS 到達後の deferred verification として明記 —
   P10-T01 と同形式）
4. **検証**: fmt/validate + floci plan（既存 harness 拡張）、
   role SQL は local disposable PG に適用して
   「app role で audit UPDATE が拒否される」負 test

## Acceptance（WBS）

- audit mutation prohibited（local PG での負 test 実測）
- restore tested（手順書 + AWS 到達後 deferred の明記）

## Forbidden

- 実 credential/ARN / 実 AWS 到達 / open PR ファイル接触
- schema.sql の既存内容変更（role 付与 script は別ファイル）
- 依存追加 / main direct push / merge / approve

## Scope / allowed_paths（WBS）

- `deploy/aws/**`（modules/rds・secrets-manager の拡張 + 新規）
- `packages/devops/src/db/**`（**新規 provisioning script のみ**）
- `runbooks/**` / `.orchestration/**`

## Validation

- fmt/validate/floci plan green / role 負 test 実測
- fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P10-T04-db-roles-backups`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P10-T04-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P10-T04 status=ready_for_review
