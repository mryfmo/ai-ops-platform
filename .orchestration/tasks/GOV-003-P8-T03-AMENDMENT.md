# GOV-003-P8-T03-AMENDMENT: WBS P8-T03 amendment draft（Owner 署名用）

- task_id: GOV-003-P8-T03-AMENDMENT
- writer: codex-deep-dot / reviewer: claude-code-fable5-xhigh（orchestrator）
- 背景: docs/security/2026-08-10-secret-identity-migration-plan.md（138-145 行）
  の GOV-003 stop — 「Before P8-T03 starts, the Owner must amend its
  deliverables, acceptance, and verification」。P8-T03 実装は**本 amendment の
  Owner merge（= 署名）まで凍結**（orchestrator 裁定 2026-08-17）
- risk: low（docs-only）

## Objective（docs-only PR を 1 本作る）

1. **WBS 正本修正** `docs/plans/2026-08-final-architecture/06_implementation/02_wbs.yaml`
   の P8-T03 を security plan の要求どおり amend:
   - deliverables += GitHub App installation-token minting（job-scoped、
     repository/permission narrowing、dedicated push/PR-step injection）
   - acceptance += always-run revocation/expiry / PAT removal readiness
   - verification += out-of-scope/main-push negative tests
   - allowed_paths += `packages/control-plane/tests/**`（verification が新規
     tests を要求するのに tests path 欠落 — 整合是正、orchestrator 裁定済み）
2. **decision record** `docs/decisions/2026-08-17-gov-003-p8-t03-amendment.md`:
   amendment 内容・根拠（security plan 該当行）・「Owner merge = GOV-003 署名」
   を明記。P4 preparatory-classification record（2026-08-15）の書式踏襲
3. pack 整合: IMPORT_NOTES 是正台帳へ行追加 + `SHA256SUMS` 再計算 +
   `python3 scripts/validate_pack.py` green（P2 期の WBS 是正と同手順）

## 裁定（amendment 本文へ反映すること）

- **issuer auth boundary**: runner/workflow は master key・App private key を
  一切持たない。workflow → issuer（control-plane）の認証は **GitHub OIDC
  audience-bound token**（P10 の OIDC-only 規範と同型）。live endpoint 未到達の
  間は構造 + fail-closed（endpoint 設定不在 = 発行拒否）で先行し、
  E2E は環境 gate 後
- PAT secret の最終削除は P10-T10 管轄のまま（本 amendment は readiness まで）

## Forbidden

- 実装コード変更（P8-T03 本体は凍結中）/ open PR #260/#261/#262 接触 /
  main direct push / merge / approve / 依存追加

## Scope / allowed_paths

- `docs/plans/2026-08-final-architecture/**`（WBS + IMPORT_NOTES + SHA256SUMS）
- `docs/decisions/**`
- `.orchestration/**`（証跡）

## Validation

- `python3 scripts/validate_pack.py` green（113 tasks 維持）+
  `shasum -c` 相当の SHA 整合 / `mise run ci` は docs-only なので
  format/traceability green を確認

## PR / blocked-auth

- branch `agent/GOV-003-p8-t03-amendment`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/GOV-003-P8-T03-AMENDMENT*.md`

## Done signal

AGMSG-RESULT v1 task_id=GOV-003-P8-T03-AMENDMENT status=ready_for_review
