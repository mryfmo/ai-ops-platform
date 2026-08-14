# P4-T10: Implement tool result size/time/depth limits

- task_id: P4-T10
- writer: codex-deep-dot（Owner 指示 2026-08-15 により実務委任。WBS 原記載は
  writer=claude。orchestrator は起票・adversarial review・acceptance のみ）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P4-T04 ✅（#232 merged, main 42e6a15）
- requirement_refs: PRD-003 / PRD-005 / FR-MCP-001..007
- adr_refs: ADR-0023
- acceptance_gate_ids: MCP-006（All calls correlated and audited — blocking。
  evidence: trace/actor/tool/resource/result）
- risk: medium

## Objective

`GovernedMcpToolCaller`（P4-T04）の実行面に **bounded invocation profile** を
追加する: oversized / slow / recursive（深い・連鎖する）tool call が安全に
失敗し、その失敗も MCP-006 の相関情報（trace/actor/tool/resource/result）
付きで receipt / ledger に記録されること。

## Deliverables

1. **bounded invocation profile**（pure lib、`packages/integrations/src/lib/`）:
   - result size 上限（bytes。超過は結果を破棄し fail — 部分結果を返さない）
   - invocation timeout（wall-clock。既存 P3 規範どおり timeout→success 遷移禁止）
   - depth / chain 上限（governed call から派生する governed call の深さ・
     同一 operationId 系列の再帰を検出して遮断）
   - profile は risk level 別に定義可能な決定的テーブル（コード算出、LLM 不使用）
2. `GovernedMcpToolCaller` への結線: execute 前後で profile を強制。
   超過は fail-closed（`E-TOOL-OVERSIZED` / `E-TOOL-TIMEOUT` / `E-TOOL-DEPTH`
   等の E-code で receipt/ledger へ。receipt には常に decisionId /
   policyBundleVersion / trace/actor/tool/resource/result 相関を維持）
3. 必要なら `packages/policy/**` の obligations（maxResultBytes 等）を
   profile へ写像（OPA obligation が profile より緩い場合は**厳しい方**を採用）

## 設計制約

- P4-T04 の不変条件を壊さない: decision 先行・全経路 receipt・fail-closed・
  approvals 二重照合はそのまま。profile は execute 段の追加防壁
- timeout 後に result が届いても success へ遷移しない（破棄 + failed のまま）
- lib/agents 分離・DI・ネットワークなし test・依存追加禁止
- schema 変更なしで実装できる想定（不要なら DB は触らない）

## Scope / allowed_paths（WBS）

- `packages/integrations/src/mcp/**`（+ 既存規約どおり
  `packages/integrations/src/lib/**` と `packages/integrations/tests/**`）
- `packages/policy/**`（obligations 写像が必要な場合のみ最小限）
- `.orchestration/**`（証跡）

## Acceptance（WBS）

- oversized / slow / recursive calls fail **safely**:
  部分結果なし・timeout→success なし・深さ超過遮断・すべて相関付き記録

## Validation

- load/timeout tests（fake timer / 大型 payload / 深い連鎖の決定的 test。
  実時間 sleep に依存しない）
- fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P4-T10-bounded-invocation` を main（42e6a15）から作成、
  commit は worker 名義 → AGMSG-RESULT（head SHA）→ push/PR は orchestrator 代行。
  draft 禁止

## Expected artifacts

- report: `.orchestration/reports/P4-T10-REPORT.md`
- validation: `.orchestration/validation/P4-T10-VALIDATION.md`
- sandbox: `.orchestration/sandboxes/P4-T10-SANDBOX.md`
- learning: `.orchestration/learning/P4-T10-LEARNING.md`
- autoskill: `.orchestration/autoskill/runs/P4-T10.md`

## Done signal

AGMSG-RESULT v1 task_id=P4-T10 status=ready_for_review

## Bounds clarification（2026-08-15、orchestrator 承認）

- 正典に数値既定なし → 実装裁量として worker 提案の決定的テーブルを採択:
  | risk | maxResultBytes | timeoutMs | maxDepth | maxChain |
  |------|---------------|-----------|----------|----------|
  | L0 | 1,048,576 | 30,000 | 4 | 8 |
  | L1 | 524,288 | 20,000 | 3 | 6 |
  | L2 | 262,144 | 10,000 | 2 | 4 |
  | L3 | 131,072 | 5,000 | 1 | 2 |
- OPA obligation（maxResultBytes 等）との合成は **min-wins（厳しい方）**
- 定数は根拠コメント付きの単一テーブルで export（レビュー可能な 1 箇所）。
  変更は本 check/テーブルの更新 = レビュー経由のみ
