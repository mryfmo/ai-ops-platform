# P4-T01-REVIEW: agentgateway MCP/A2A-only deploy の独立レビュー

- task_id: P4-T01-REVIEW
- reviewer(worker): codex-gpt56-sol-high（codex-deep-dot）
- 対象 PR: agent/P4-T01-agentgateway-deploy（PR 番号は AGMSG-TASK note で通知）
- 参照: .orchestration/tasks/P4-T01-agentgateway-deploy.md /
  .orchestration/reports/P4-T01-REPORT.md /
  .orchestration/validation/P4-T01-VALIDATION.md

## Objective

P4-T01 の成果物を adversarial にレビューする。correctness / security /
canon 整合 / 報告の脱漏の 4 面で、refute を試みること。

## 重点観点

1. **MCP-001 迂回穴**: contracts/mcp-gateway の deep-scan が拾えない
   LLM/stdio/authz 緩和の混入経路はないか（vendor schema 上の別名キー、
   `policies` top-level 経由の attach、routeGroups 経由等）。実際に config を
   変異させ check が落ちるか live probe すること
2. **vendor 仕様の裏取り**: mcpAuthorization rules 非一致 = deny + tools/list
   filter、jwtAuth strict の fail-closed、`--validate-only` の検証範囲
   （agentgateway v1.4.1 のソース/ドキュメントで確認）
3. **smoke の証明力**: 401/404 検分が主張（default deny / LLM 無効）を本当に
   支持するか。偽陰性・偽陽性の余地
4. **canon 整合**: 04_component_specs/03_agentgateway_mcp_a2a.md の
   scope/non-scope・approval ladder・conformance と、ADR-0023、
   CHANGE_BOUNDARIES.yaml の forbidden に反していないか
5. **供給網**: digest pin の実在（ghcr manifest）、24h hold（v1.4.1 は
   2026-07-29 公開）、gitleaks 面（committed JWKS/秘密なし）

## Forbidden

- 対象 branch の実装ファイル編集（レビューのみ。findings は review file へ）
- merge / approve 操作
- 依存追加・gate 変更

## Expected artifacts

- review: .orchestration/reviews/P4-T01-REVIEW.md
  （finding ごとに severity / evidence / 再現 probe / 提案）
- validation: .orchestration/validation/P4-T01-REVIEW-VALIDATION.md
  （live probe のコマンドと出力）

## Done signal

AGMSG-RESULT v1 task_id=P4-T01-REVIEW status=ready_for_review
