# P7-T02: Implement identity/thread/workflow mapping

- task_id: P7-T02
- writer: codex-deep-dot（WBS どおり codex）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P7-T01 ✅（#245 merged）
- requirement_refs: PRD-001 / FR-UI-001..006
- adr_refs: ADR-0025
- acceptance_gate_ids: UX-001（security/unit 面。Teams sandbox E2E は
  P7-T03 以降 + tenant 到達後）
- risk: medium
- **並行注意**: open PR #250（.orchestration）/ #251（scripts/
  .github/actions/run-coding-agent/package.json）— 接触禁止

## Canon / 前提

- P7-T01 の `packages/channel-teams`（`ConversationMappingAuthority` は
  lookup 専用 interface として定義済み — **server 側 DB が正本**という前提を
  実装で守る）
- canon 05_opentag_teams.md: conversation/thread/user identity/attachment/
  workflow ID の mapping、source + platform message ID dedupe
- 既存 `packages/server/src/db/channelMessagesRepo.ts` 等の関連 repo を
  読解し、**役割重複するテーブルを作らない**（DELTA-03 規範）。
  必要なら既存構造の evolve（P1-T05 手順）を優先検討

## Objective

1. **mapping authority の server 実装**（`packages/server/src/db/`）:
   channel address（source + conversation + thread）→
   conversation/thread/workflow の安定 mapping。**dedupe**
   （source + platform message ID の unique 制約）と replay 安全
2. **security boundary（acceptance の核心）**: wrong user / wrong thread から
   workflow へ到達できないこと —
   - mapping lookup は **user identity（tenant + subject）を必須入力**とし、
     thread の参加 identity と不一致なら null/deny（存在オラクル回避）
   - workflow ID は mapping 経由でのみ解決（直接指定 API を作らない）
3. channel-teams 側: P7-T01 の interface への接続実装（thin。business state
   なしの規約維持）
4. tests: security/unit（wrong user・wrong thread・cross-tenant の負 fixture、
   dedupe 並行、replay）。real-PG は dual-test 規約
   （unit 変種 + `env -u TEST_DATABASE_URL` coverage 通過必須 — P6-T11 教訓）

## Forbidden

- channel-teams への永続 state / workflow 直接解決 API / 役割重複テーブル
- open PR #250/#251 ファイル接触 / 依存追加（workspace link は要 amendment）
- 実資格情報 / main direct push / merge / approve

## Scope / allowed_paths（WBS + test 規約）

- `packages/channel-teams/src/**` + `packages/channel-teams/tests/**`
- `packages/server/src/db/**` + `packages/server/tests/**`
- schema 変更時: P1-T05 手順（schema.sql + migrations、要事前報告 —
  open PR に schema 変更者なしのため衝突リスク低いが報告は必須）
- `.orchestration/**`（証跡）

## Validation

- security/unit tests green（`env -u TEST_DATABASE_URL` coverage 含む）
- fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P7-T02-identity-thread-mapping`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P7-T02-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P7-T02 status=ready_for_review

## Schema amendment（2026-08-16、orchestrator 承認 — option a）

- 承認: (1) 新 `channel_conversation_mappings`（key = source + conversation +
  正規化 thread、provider/tenant/subject を束縛、conversation/thread/
  workflow_id FK。lookup は address + tenant + subject 述語で
  **不一致・不存在とも null** — 存在オラクル回避）
  (2) 既存 `channel_messages` の evolve（source 列 default 'teams' +
  UNIQUE(source, message_id) による dedupe — 新 receipt table を作らない
  判断は DELTA-03 的に正しい）
  (3) schema.sql + 冪等 migration 202608160300 + unit/real-PG dual tests
- 条件: 既存 channel_messages の意味論（Teams content mirror）を変えない
  expand-only migration。events（retry queue authority）への相乗り回避の
  判断も支持
