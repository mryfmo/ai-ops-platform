# P4-T11-REVIEW — approve at `8a87a09`

- task_id: P4-T11 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-15
- head_sha: 8a87a0966c1f4203543f4670d381d00bca0415ad
- verdict: **approve**（non-blocking note 1 件）

## 独立再検証（reviewer 実行）

- `@aiops/server` 866/879 pass（skip は既存）/ `@aiops/web` 329/330 pass
- **fresh-DB `mise run ci` exit 0**（orchestrator 環境で単独判定。worker 側
  sandbox の Turbopack loopback 制約は環境事象と確認 — 当方環境と clean-runner
  CI の両方で全 phase 通過）
- コード読解: `mcpOpsRepo.ts`（237 行）/ `routes/mcpOps.ts` / web BFF・view

## gate 検分（MCP-001 / MCP-003 / MCP-004 / MCP-006）

- **no content leakage（MCP-003）**: SQL SELECT に input / result /
  resource_scope / obligations / hash 列が一切ない（列挙して確認）。
  reasons / error_class は `^E-[A-Z0-9-]{1,62}$` の allowlist regex で
  E-code のみ通し、非該当は `E-REDACTED` に収束。identifier 列も regex guard +
  `sanitizeSecrets` を全出力に適用。resource は id/projectId のみ投影。
  web BFF は strict shape 検証で raw content 付き上流応答を 502 遮断、
  view に content slot なし（負 test あり）
- **role-scoped（MCP-001/006）**: scope は SQL 述語（`$1::boolean OR
  projectId = ANY($2)`）でデータ取得側に強制。PRF-G は global+projects 空のみ、
  PRF-L は非空 projects のみ、他は query 前に Forbidden throw（負 test あり）。
  active recipient は**毎リクエスト**再照会（cache なし。inactive 化後 403 +
  data repo 不呼出の負 test）。403 は AuditLogWriter.append で監査記録。
  域外/不存在 invocation はともに 404（存在オラクル回避）
- **MCP-004**: registry schema-hash 状態は match/drift/unavailable の観測のみ
  （gateway 構成への書込経路なし）。mismatch/malformed → fail-closed 表示の test
- **MCP-006**: invocation audit は trace/actor/tool/resource/result +
  action ledger 相関を 1 query で返す（metadata のみ）
- 集計はコード算出（LLM なし）、schema/依存変更なし、P4-T10 の open PR #233
  対象ファイルと重なりなし（disjointness 遵守）

## Non-blocking note

1. summary の LEFT JOIN で policy_decisions 不在の tool_invocations は
   project scope から不可視（global のみ可視）。leakage 方向ではなく
   保守的な欠落だが、decision-less invocation は本来存在しない前提
   （P4-T04 不変条件）のため実害なし。live 化後の監視で欠落件数を
   確認する運用メモとして残す
