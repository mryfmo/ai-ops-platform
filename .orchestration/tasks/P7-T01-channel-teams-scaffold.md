# P7-T01: Scaffold channel-teams package

- task_id: P7-T01
- writer: codex-deep-dot（Owner 指示 2026-08-15 により実務委任。WBS 原記載
  writer=claude。orchestrator は起票・adversarial review・acceptance）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P1-T04 ✅ / P3-T02 ✅
- requirement_refs: PRD-001 / FR-UI-001..006
- adr_refs: ADR-0025
- acceptance_gate_ids: UX-001（sandbox-teams E2E は tenant 到達後 —
  本タスクは package tests まで）
- risk: medium
- **並行注意**: PR #244（P3-T13）が open。対象ファイル
  （packages/control-plane/** / packages/server/** / verification/**）に
  **一切触れない**こと（本タスクは新規 package + workspace 登録のみで自然に分離）

## Canon（必読）

- `docs/plans/2026-08-final-architecture/04_component_specs/05_opentag_teams.md`:
  Adopt（managed channel pattern / mention・thread subscription / cards・
  approval UI / AG-UI boundary / recoverable error reporting）と
  **Do not adopt**（OpenTag 標準 OpenAI/LangGraph agent・MCP 接続の所有・
  in-memory state を workflow 正本にすること・OpenTag approval 単独での
  外部操作確定）
- ADR-0025: channel adapter は AG-UI client として Control API/streaming へ
  接続。business state は持たない
- 既存 packages（shared/web）の tsconfig / vitest / eslint / package.json 規約

## Objective（scaffold — 後続 P7-T02..T05 の土台）

1. **`packages/channel-teams` 新規 package**: 既存 monorepo 規約準拠の
   scaffold（package.json / tsconfig / vitest 設定 / lint、
   `pnpm-workspace.yaml` 登録、mise run ci の全 gate を通過する形）
2. **adapter runtime の骨格**（lib/結線分離）:
   - AG-UI client contract の型定義（Control API との接続境界:
     conversation ID / thread ID / user identity / attachment refs /
     workflow ID の mapping 型 — 実結線は P7-T02）
   - **no business state stored** を構造で強制: adapter 内に永続 state を
     持たない設計（mapping は server 側 DB が正本になる前提の interface のみ）
   - recoverable error reporting の型（E-code 体系は既存規約踏襲）
3. **replaceable adapter**: adapter interface と Teams 実装の分離
   （interface に Teams 固有型を漏らさない — 別 channel 実装で置換可能）
4. tests: 型/contract の unit tests（ネットワークなし。dedupe キー
  （source + platform message ID）の純関数があればその境界 test）

## Acceptance（WBS）

- no business state stored（adapter に永続化 API が存在しない構造 + test）
- replaceable adapter（interface 分離の型 test）

## Forbidden

- Control API への実結線・Teams 実 credential・Bot Framework 実接続
  （P7-T02 以降）/ OpenTag の Do-not-adopt 項目 / 依存追加
  （**外部依存は原則ゼロで scaffold**。必要が生じたら要 amendment）
- PR #244 対象ファイルへの接触 / main direct push / merge / approve

## Scope / allowed_paths（WBS）

- `packages/channel-teams/**` / `pnpm-workspace.yaml`
- `.orchestration/**`（証跡）

## Validation

- package tests green / fresh DB で `mise run ci` exit 0（単独判定 —
  traceability の根拠 ID ヘッダ遵守）

## PR / blocked-auth

- branch `agent/P7-T01-channel-teams-scaffold`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P7-T01-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P7-T01 status=ready_for_review

## Scope amendment（2026-08-16、orchestrator 承認）

- 追加 allowed_paths: `pnpm-lock.yaml` — 新 workspace package
  `packages/channel-teams` の **empty importer entry 1 hunk のみ**
  （pnpm v11 の frozen install 要件。外部依存の追加なし）
