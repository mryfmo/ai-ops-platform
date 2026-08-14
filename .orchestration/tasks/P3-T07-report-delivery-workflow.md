# AGMSG-TASK: P3-T07 — report delivery workflow

- task_id: P3-T07
- writer: claude-code-fable5-xhigh（orchestrator が実装）
- reviewer: codex-gpt56-sol-high（AGMSG-TASK `P3-T07-REVIEW`）
- depends_on: P3-T02 ✅, P3-T03 ✅（approval child）
- risk: medium
- branch: `agent/P3-T07-report-delivery-workflow`

## allowed_paths（WBS）

1. `packages/control-plane/src/workflows/**`（+ 対応 `src/lib/**`・`tests/**`・
   record script・vitest coverage exclude への新規 sandbox workflow 追加
   〔P3-T06 amendment と同一条件〕）
2. `packages/prjops/**` / `packages/server/**`（**必要最小限**。冪等台帳
   DeliveryLogStore・reportPermissionFilter の既存純粋関数は activity 契約で
   再利用が第一。変更不要なら不変更）

## スコープ判断（P3-T03..T06 と同型）

deliverable（generation/validation/approval/delivery workflow）と acceptance は
workflow 層で充足。server/prjops の Temporal client 結線は flag 配下の統合タスク。
権威の正本: 配信冪等 = DeliveryLogStore（reportId::recipientId、
PrjOps:SPEC-INT-052）、承認 = approvalsRepo（P3-T03 child 経由）、
権限 = reportPermissionFilter + isActiveRecipient（リクエスト毎・キャッシュ禁止 —
設計原則 6）。workflow はこれらを複製せず待機・順序・冪等 key の耐久化のみ担う。

## deliverables（WBS）

- **reportDeliveryWorkflow**: generation（冪等 write）→ validation（read、
  invalid は failed 終端）→ approval（P3-T03 child。rejected/expired は failed
  終端 = no auto-approval）→ per-recipient delivery（authority read →
  shadow 構造抑止 → single-attempt + reconcile）
- **recipient idempotency**: 配信 key は (reportId, recipientId) から決定的に
  構築。既配信 recipient は authority read で reconciled（deliverReport
  未 schedule）。lost-response も schedule 1 回 + reconcile 回収（TMP-003）
- **approval profiles preserved**: deliverReport activity 契約に
  「実装は配信時に reportPermissionFilter / isActiveRecipient をリクエスト毎に
  適用する（キャッシュ禁止）」を明記。workflow は reportId/recipientId のみ
  搬送し、report 内容・profile 判定結果を持たない

## gates

- TMP-003（blocking, ci）: lost-response delivery + no duplicate object

## verification

- lib 純粋判定の matrix unit tests + recorded fixtures + replay（確立 harness）
- fixtures: complete（既配信 recipient の reconcile 混在）/ delivery-lost-response /
  approval-rejected（delivery 0 件）/ validation-failed（approval child 未起動）/
  shadow（delivery write 0 件）
- 恒久則（binding）: unknown 受け + 参照前形検証 / receipt は reportId・
  recipientId・key に束縛 / 検証は helper 外 / E-CP-CONTRACT non-retryable /
  unresolved は非成功終了 / fixture 毎一意 ID / merged fixtures byte 不変
- fresh 使い捨て DB（run 毎再作成・same-shell）で `mise run ci` exit 0

## expected artifacts

- report/validation/review/acceptance/learning: `.orchestration/*/P3-T07-*.md`
