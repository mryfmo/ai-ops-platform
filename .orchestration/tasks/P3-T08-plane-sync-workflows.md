# AGMSG-TASK: P3-T08 — Plane reconcile/promotion workflows

- task_id: P3-T08
- writer: claude-code-fable5-xhigh（orchestrator が実装）
- reviewer: codex-gpt56-sol-high（AGMSG-TASK `P3-T08-REVIEW`）
- depends_on: P3-T02 ✅（P3-T03..T07 の確立様式を踏襲）
- risk: medium
- branch: `agent/P3-T08-plane-sync-workflows`

## allowed_paths（WBS）

1. `packages/control-plane/src/workflows/**`（+ 対応 `src/lib/**`・`tests/**`・
   record script・vitest coverage exclude〔P3-T06 amendment 条件〕）
2. `packages/integrations/src/plane/**`（**必要最小限**。operationBoundary
   （plane = read + draft のみ）は不変更。変更不要なら不変更）

## deliverables（WBS + component spec 08）

- **planeSyncWorkflow（親）+ 3 child workflows**（正典: 別 child に分離）:
  - projection（GitHub → Plane）: state summary + canonical link のみを投影。
    dedupe 恒等 = (external_source, external_id, project_id, mapping_version)。
    unknown write result は reconcile（正典 Dedupe 節）
  - event（Plane → platform）: 内部 event store への冪等記録（同 dedupe 恒等）
  - promotion（Plane → GitHub）: engineering-ready かつ承認済み work item のみ、
    **baseline revision を read 時に固定**し、draft PR/Issue まで
    （formal publish・merge は人間/platform protection の管轄 — 決して行わない）

## acceptance（WBS）

- **authority boundary preserved**: Plane 書き込みは operationBoundary の
  read + draft 境界内（activity 契約で明記、receipt に draft 性を束縛）。
  GitHub 側も draft までで merge/deploy への経路なし
- **stale checks preserved**: promotion は pinned baseline と現行 revision の
  不一致で write なしの stale 終端。projection/event は mapping_version 束縛

## gates

- TMP-003（blocking, ci）: unknown write result の lost-response で
  二重 write なし + reconcile 回収

## verification

- lib 純粋判定 matrix + recorded fixtures + replay（確立 harness）
- fixtures: projection（dedupe 既存 reconciled 混在）/ projection-unknown-write
  （喪失→reconcile 回収）/ promotion-complete（baseline 固定 + draft receipt）/
  promotion-stale（revision 移動 → write 0）/ promotion-not-eligible
  （承認なし → write 0）/ event / shadow / 親 orchestration
- 恒久則（binding、P3-T03..T07 で確立）: unknown 受け + 参照前形検証 / receipt
  束縛（dedupe 恒等 + baseline echo）/ callback・reconcile 内 parse は
  E-CP-CONTRACT 変換（activity エラー誤分類禁止）/ unresolved 非成功 /
  fixture 毎一意 ID / merged fixtures byte 不変（push head 検証）
- fresh 使い捨て DB（run 毎再作成・same-shell）で `mise run ci` exit 0

## expected artifacts

- report/validation/review/acceptance/learning: `.orchestration/*/P3-T08-*.md`
