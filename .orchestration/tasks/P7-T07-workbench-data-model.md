# P7-T07: Add Workbench workspace data model

- task_id: P7-T07
- writer: codex-deep-dot（Owner 指示 2026-08-15 により実務委任。WBS 原記載
  writer=claude。orchestrator は起票・adversarial review・acceptance）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P1-T05 ✅ / P3-T02 ✅
- requirement_refs: PRD-001 / FR-UI-001..006
- adr_refs: ADR-0025
- acceptance_gate_ids: UX-003
- risk: medium
- **並行注意**: open PR #244（P3-T13: deploymentsRepo/approvalsRepo/
  scheduler tasks/control-plane）と #245（channel-teams/pnpm-workspace/
  pnpm-lock）。**これらの変更ファイルに一切触れない**（本タスクは新規
  repo/route/model ファイル + schema.sql/migration で分離可能）

## Canon（必読）

- `04_component_specs/06_web_workbench.md`: Storage 節 —
  **workspace metadata/read model = PostgreSQL、workflow state = Temporal、
  code = GitHub、formal doc = SharePoint、Cloudflare Artifacts = none**。
  Deferred action（side effect 候補は pending action へ集約）、
  Capability default none、Blueprint
- ADR-0025: Cloudflare OS から workspace/gadget/capability/deferred-action の
  **設計だけ**を移植（runtime 非依存）
- P1-T05 DELTA-03 系の規範: 既存 authority（approvals / action_ledger /
  deployments / workflows）と**役割重複するテーブルを作らない**

## Objective

**workspace / source / run / action の read-model データモデル**:

1. **schema**（P1-T05 手順: schema.sql + migration + repo + tests 同一 PR）:
   - `workbench_workspaces`（project/repo/meeting/incident 種別、owner、
     role-based view の基盤 metadata）
   - `workbench_workspace_sources`（source/provenance panel の参照:
     外部 SoR への **参照のみ**（GitHub/SharePoint/Confluence/Temporal の
     ID/URL/型）— 内容の複製を持たない）
   - `workbench_workspace_runs`（workflow timeline の read model:
     **workflowId 参照のみ**。workflow state の正本は Temporal —
     状態複製・並行 authority 禁止）
   - `workbench_pending_actions`（deferred action 集約: 既存
     approvals/action_ledger への**参照**で、実行 authority を持たない）
2. **repos**（`packages/server/src/db/`、新規ファイルのみ）: 参照整合・
   追記/更新規律（見た目上の read model — 監査系は append-only 原則）
3. **API/UI 最小結線**（`packages/web/src/`）: 型と server route の骨格
   （既存 identity envelope / role-based 取得規範 — reportPermissionFilter
   系のデータ取得側 scope 強制）。UI 実装の本体は P7-T08/T10 の管轄
4. tests: DB（real PG）/ API（app.request）/ 型

## Acceptance（WBS）

- **no workflow/SoR duplication**: run は workflowId 参照のみ・source は
  外部参照のみ・pending action は既存 authority 参照のみ、を schema 制約 +
  test で固定（複製列が存在しないこと）

## Forbidden

- workflow state・SoR 内容の複製列 / 並行 authority テーブル
- open PR #244/#245 の変更ファイルへの接触
- 依存追加（workspace link は要 amendment）/ 実資格情報
- main direct push / merge / approve

## Scope / allowed_paths（WBS + P1-T05 手順 + test 規約）

- `packages/web/src/**` / `packages/server/src/db/**`（新規ファイル）
- `packages/devops/src/db/schema.sql` +
  `packages/devops/src/db/migrations/2026081601xx_workbench_*.sql`
- `packages/server/tests/**` / `packages/web/tests/**`
- `packages/server/src/http/app.ts` / `src/index.ts`（結線行のみ、事前承認 —
  ただし #244 が index.ts を触っていないか確認し、触っていれば結線は
  route 登録ファイル側で完結させる）
- `.orchestration/**`（証跡）

## Validation

- DB/API tests green / fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P7-T07-workbench-data-model`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P7-T07-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P7-T07 status=ready_for_review
