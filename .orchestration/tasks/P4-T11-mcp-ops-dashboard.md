# P4-T11: Create MCP operations dashboard and audit queries

- task_id: P4-T11
- writer: codex-deep-dot（WBS どおり codex）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P4-T04 ✅（#232 merged）
- requirement_refs: PRD-003 / PRD-005 / FR-MCP-001..007
- adr_refs: ADR-0023
- acceptance_gate_ids: MCP-001 / MCP-003 / MCP-004
- risk: medium
- 発注時期: P4-T10 完了後（solo worker 直列）

## Objective

P4-T04 で永続化される policy decisions / tool invocations / action ledger を
情報源として、MCP 運用の可視化と監査 query を追加する:

1. **views**: tool usage / deny 率と deny 理由 / error class 分布 /
   registry schema drift（P4-T02 の hash gate 状態）
2. **audit queries**: MCP-006 相関（trace/actor/tool/resource/result）で
   任意の invocation を遡れる server API + 定型 query

## 制約（gate 由来）

- **no content leakage**（MCP-003 系）: dashboard / API は tool の入出力
  content を一切表示しない。metadata（decision/E-code/latency/risk/
  bundle version/相関 ID）のみ。evidence JSON を出す場合も sanitize 済み
  metadata 限定で、raw input/result は返さない
- **role-scoped**: 既存 `reportPermissionFilter` 系（AGENTS.md 原則 6）を
  データ取得側で強制。表示層の後付け masking 禁止。recipients active 判定は
  リクエスト毎
- 数値・集計はコード算出（LLM 不使用）。web は既存 ViewSpec/チャート規約に従う
- 依存追加禁止・schema 変更なし（既存 repo の読み取り query のみ追加）

## Scope / allowed_paths（WBS）

- `packages/web/src/**` / `packages/server/src/**` / `docs/guide/**`
- `.orchestration/**`（証跡）

## Acceptance（WBS）

- no content leakage（負 test: content を含む evidence を挿入しても API/画面に
  raw content が出ない）
- role-scoped（負 test: scope 外 role のアクセスが data 層で拒否される）

## Validation

- web/API tests（`app.request()` パターン、ネットワークなし）
- fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P4-T11-mcp-ops-dashboard`、commit → AGMSG-RESULT → orchestrator が
  push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P4-T11-*.md`（既存命名規約どおり）

## Done signal

AGMSG-RESULT v1 task_id=P4-T11 status=ready_for_review

## Scope amendment（2026-08-15、orchestrator 承認）

- 追加 allowed_paths: `packages/web/tests/**` / `packages/server/tests/**`
  （repo 規約 `packages/*/tests/*.test.ts` 準拠。gate 由来の負 test —
  content leakage / role-scope — の配置に必須）
- 他 scope / forbidden 不変
