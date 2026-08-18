# P7-T09: Add Teams-to-Workbench handoff

- task_id: P7-T09
- writer: codex-deep-dot（WBS どおり codex）/ reviewer: claude-code-fable5-xhigh
- depends_on: P7-T05 ✅（#260）/ P7-T07 ✅
- acceptance_gate_ids: UX-005（ci 面。live E2E は tenant 到達後 deferred）
- risk: medium

## Canon / 前提（必読）

- WBS deliverables: **signed short-lived deep link**。acceptance:
  **identity/workflow preserved / link replay/expiry protected**
- 既存資産を再利用（再実装禁止）: P7-T05 の署名 correlation パターン、
  P7-T02 の identity/thread mapping、P7-T07 の workbench 永続層、
  P7-T08 の grants。link の受け側 authz は P7-T08/T05 の per-request
  再解決規範に従う（キャッシュ禁止）
- P7-T04/T10 の型規範: URL は branded/検証済みのみ、LLM 由来文字列を
  link 生成経路に入れない

## Objective

1. **link mint（pure lib + 注入可能な結線）**: Teams 会話 context
   （signed identity + thread/workflow 参照）→ Workbench deep link。
   HMAC/署名 + **短命 expiry 必須**（未指定を型で表現不能に）+
   **single-use（replay 遮断）**。secret/clock/fetch は注入
2. **受け側 verify**: 署名・expiry・単回性・identity 一致を検証し、
   workflow context を復元。失敗は一様拒否（存在 oracle なし）+ 監査。
   受け側でも per-request authz 再解決（link 所持 = 権限ではない）
3. tests: replay / 期限切れ / 改竄 / identity 不一致 / 未署名 /
   grant 外 workflow の負 fixture + identity/workflow 保存の正 fixture

## Forbidden

- long-lived link / 無署名 link / link への PII・secret 埋め込み
- main push / merge / approve / 依存追加 / 実資格情報
- open PR 変更ファイル接触（dispatch 時点の open PR を確認）

## Scope / allowed_paths（WBS）

- `packages/channel-teams/**` / `packages/web/src/**`
- （tests は各 package の tests/ 慣行に従う）
- `.orchestration/**`（証跡）

## Validation

- 新規 tests green / fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P7-T09-teams-workbench-handoff`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P7-T09-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P7-T09 status=ready_for_review
