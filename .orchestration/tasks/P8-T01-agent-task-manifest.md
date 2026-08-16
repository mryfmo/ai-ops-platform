# P8-T01: Define machine-readable agent task manifest

- task_id: P8-T01
- writer: codex-deep-dot（WBS どおり codex）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P1-T04 ✅ / P3-T04 ✅
- requirement_refs: PRD-008 / FR-AGT-001..006
- adr_refs: ADR-0027
- acceptance_gate_ids: COD-003（One writer lock rejects concurrent claim —
  schema/unit 面。real repo E2E は P8-T10）
- risk: medium
- **並行注意**: open PR #244（server scheduler/db/control-plane）/
  #245（channel-teams）/ #246（server app.ts・index.ts・workbench・schema.sql）。
  **これらの変更ファイルへ接触禁止**。特に `packages/server/src/http/app.ts` と
  `packages/server/src/index.ts` は #246 が変更中 — server 側は新規ファイルで
  完結させ、barrel/app 結線が必要なら **#246 merge 後の後続 PR に分離**する
  旨を report へ記録

## Canon（必読）

- `04_component_specs/09_coding_agents.md`: One Writer protocol
  （manifest に writer/reviewer 固定、reviewer は read-only、role 変更は
  明示再割当 + commit range 記録）、Runner environment（pinned CLI/
  scoped key/allowed・forbidden paths/max runtime・cost・tokens・tool calls）、
  Task completion callback 項目、Review dimensions。
  **model 名は execution profile label であり capability assumption を
  リポジトリにハードコードしない**
- ADR-0027 / 既存 `contracts/` 構造（schemas/ + check-*.mjs + *.test.mjs +
  package.json test 結線の確立パターン — P4-T01/T02 と同型）

## Objective

1. **manifest schema**（`contracts/agent-task/`）: writer / reviewer /
   allowed・forbidden paths / gates / budget（runtime・cost・tokens・
   tool calls 上限）/ branch・PR 規約 / callback 項目、の machine-readable
   schema（JSON Schema、正規化 hash gate は P4-T02 パターン任意）
2. **検証 lib + gate**: manifest instance の検証（node --test を contracts
   package.json へ結線）:
   - **invalid assignments rejected**: writer==reviewer / 未知 role・profile
     label 形式違反 / allowed と forbidden の重複 / budget 欠落・非正値 /
     path glob 形式違反 → すべて reject
   - **overlapping assignments rejected**: 複数 manifest 間で同一 path を
     許可する並行 writer（One Writer 違反）を検出する純関数
     （COD-003 の schema 面 — pairwise disjointness 判定）
3. **`.github/`**: manifest 検証を CI に載せる workflow 追加または既存
   build-test への組込み（actionlint green。既存 workflow の破壊禁止）
4. server 側で必要な型があれば新規ファイルのみ（結線は後続）

## Acceptance（WBS）

- invalid/overlapping assignments rejected（負 fixture 網羅）

## Forbidden

- open PR #244/#245/#246 の変更ファイルへの接触
- capability assumption のハードコード / 依存追加 / 実資格情報
- main direct push / merge / approve

## Scope / allowed_paths（WBS + 並行制約）

- `contracts/agent-task/**` / `contracts/package.json`（test 1 行）
- `.github/**`（workflow 追加。既存の必須 check を弱めない）
- `packages/server/src/**`（**新規ファイルのみ**。app.ts/index.ts 禁止）+
  `packages/server/tests/**`
- `.orchestration/**`（証跡）

## Validation

- contracts tests green / actionlint green /
  fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P8-T01-agent-task-manifest`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P8-T01-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P8-T01 status=ready_for_review
