# P8-T07: Implement writer-reviewer handoff state

- task_id: P8-T07
- writer: codex-deep-dot（Owner 指示 2026-08-15 により実務委任。WBS 原記載
  writer=claude）/ reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P8-T04 ✅（#267）/ P8-T05 ✅（#268、merge 待ちの場合は
  branch を main から切り、#268 ファイルへ非接触 — scope は元々 disjoint）
- acceptance_gate_ids: COD-001 / COD-002（ci 面）
- risk: medium

## Canon / 前提（必読）

- canon 04_component_specs/09_coding_agents.md「One Writer protocol」:
  task manifest に writer/reviewer 固定。reviewer 修正が必要なら task を
  返却して writer が修正。reviewer が直接修正する場合は **writer role の
  明示的再割当 + 新 commit range の記録**
- P8-T01 の agent-task contract（manifest/callback）と P8-T06 の
  review job を読解し、状態モデルをそれらと整合させる（契約再実装禁止）
- 既存 DB 慣行: schema 変更は migrations/NNN_*.sql 新規作成（schema.sql は
  fresh-DB 形のみ更新）、repo 層 + tests 同一 PR、監査は append-only

## Objective

1. **状態機械（pure lib）**: writer_assigned → in_progress → ready_for_review
   → (approved | rework_requested → in_progress) + reviewer_takeover
   （role 再割当）の遷移を純関数で定義。**不正遷移は型/検証で拒否**
   （COD-001: one writer lock — 同時 writer 主張の拒否を含む）
2. **role change explicit（acceptance）**: takeover は「旧 writer 明示 +
   新 writer 明示 + 理由 + 新 commit range」を必須 field とし、
   暗黙の role 変化を表現不能に
3. **commit range pinned（acceptance）**: 各遷移 record に base/head SHA
   （40-hex 検証）を束縛。ready_for_review / approved は exact head 必須。
   head 変化（新 push）で旧 approval が無効になる規則を状態側でも強制
   （dismiss_stale_reviews と同型の一貫性）
4. **永続層**: packages/server/src/db/ に handoff 状態 repo（CAS/version
   付き更新 — P7-T05 の pending+version パターン踏襲）+ migration + 監査
   append。concurrent claim 拒否の test（COD-003 の先行実装があれば整合）
5. workflow 結線（packages/control-plane/src/workflows/**）: Temporal
   workflow から遷移を駆動する activity 契約（P3 系の determinism 規約遵守、
   注入可能・ネットワークなし test）
6. tests: 全遷移 + 不正遷移 + 同時 claim + commit range 不一致 +
   takeover field 欠落の負 fixture

## Forbidden

- main push / merge / approve / 依存追加 / 実資格情報
- 既存 P8-T01/T06 契約の再定義・破壊 / audit_log の UPDATE/DELETE
- open PR **#268** 変更ファイル接触（scope は disjoint のはず — 触れる
  必要が出たら AGMSG-TASK-UPDATE で裁定を求める）

## Scope / allowed_paths（WBS）

- `packages/control-plane/src/workflows/**`
- `packages/server/src/db/**`（+ 対応 migrations / tests は既存慣行の
  tests/ ディレクトリ）
- `.orchestration/**`（証跡）

## Validation

- workflow/repo tests green（PG 系は random-schema 分離の先例遵守）/
  fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P8-T07-writer-reviewer-handoff`（main から分岐）、commit →
  AGMSG-RESULT → orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P8-T07-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P8-T07 status=ready_for_review
