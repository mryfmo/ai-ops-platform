# P4-T02-REVIEW — approve at `fadb8f8`

- task_id: P4-T02 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-15
- head_sha: fadb8f82fa064b04f1692e0034cac07524a01637
- verdict: **approve**（non-blocking note 2 件）

## 独立再検証（reviewer 実行）

- `mise run contracts` 46/46 / `@aiops/integrations` vitest 16/16 /
  `generate-agentgateway.mjs --check` → `REGISTRY CONFIG PASS: enabled=0`
  （canonical 全 disabled で governed config と byte 一致）
- 決定性: enabled-mixed fixture の 2 回生成が byte 一致（DETERMINISTIC）+
  golden fixture と一致（GOLDEN-MATCH）
- vendor CEL field の裏取り: v1.4.1 `rbac.rs` の `ResourceId { target, name }`
  が "tool" として materialize — `mcp.tool.target` / `mcp.tool.name` は実在

## 反証プローブ

1. schema へのコメント追記 → gate 通過（**正当**: hash は parse 後の正規化内容。
   コメントは semantic drift ではない）
2. semantic drift（`additionalProperties: false→true`）→ gate **fail** ✓
3. enabled entry から endpoint 欠落 → 生成 **拒否**（fail-closed）✓
4. 生成 block 内の手書き編集（sentinel→"true"）→ `--check` **fail** ✓
5. registry/ledger の検証網: 未知 key・重複 id・未承認 owner/auth/caller・
   forbidden operation token（部分一致含む）・L4+ operation・risk ≠ operation
   上限、をコード読解で確認（generator 側 exactKeys/fail 網羅）

## 妥当性判断

- MCP-001: 生成経路が deny-all sentinel を保存（enabled=0 → `["false"]` +
  `targets: []` の byte 一致を CI 強制）。P4-T01 の contracts check は不変で、
  生成出力もその allowlist を通過する
- MCP-004: forbidden_operation_tokens（merge/deploy/delete/permission）の
  部分一致 reject + L4 以上の operation 登録拒否 + canonical registry の
  全 entry disabled/endpoint 不在を test が固定
- option (a) 裁定の遵守: endpoint は enabled 時のみ必須、canonical は
  全 disabled、1:1 写像・default 補完なし
- スコープ: 承認済み amendment の範囲内（contracts/package.json 1 行 +
  packages/integrations/tests/**）。preparatory classification と整合

## Non-blocking notes（後続タスクで対応）

1. rules の `mcp.tool.name == <operation>` は operation 分類名を実 tool 名と
   同一視する保守的 placeholder。実サーバの tool 名は onboarding
   （P4-T05..T08）で per-server mapping に精緻化が必要（現状は過剰 deny 方向 =
   fail-closed であり、全 disabled のため runtime 影響なし）
2. `generate-agentgateway.mjs` の cross-workspace `.ts` import は
   Node >= 22.18 の type stripping / tsx 前提。pinned Node 22.23 で動作確認済み
   だが、将来 generator を build 済み JS 参照へ寄せる余地あり
