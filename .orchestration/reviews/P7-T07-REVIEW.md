# P7-T07-REVIEW — approve at `2b2f3e4`

- task_id: P7-T07 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-16
- head_sha: 2b2f3e4dbf0385a058b282a8e2125686f8be9ed9
- verdict: **approve**

## 独立再検証

- server（workbench 8 PG tests 含む）/ web tests 再実行 + fresh-DB
  `mise run ci` exit 0（reviewer 環境単独判定）
- **disjointness の機械確認**: #244/#245 の変更ファイルとの重複 **0**
- schema 読解: 4 テーブルすべて**参照専用**を FK で強制 —
  `workbench_workspace_runs.workflow_id REFERENCES workflow_runs`（状態列なし、
  Temporal が正本）、`workbench_pending_actions` は approvals FK + 
  `action_ledger(operation_id, approval_id)` への複合 FK（実行 authority を
  持たない）、sources は外部 SoR 参照のみ（content/body/payload 列なし）

## 検分（UX-003）

- **no workflow/SoR duplication**: 複製列の不在を schema 検分で確認。
  参照整合は app 検証でなく **DB FK** で担保（より強い）
- データ取得側 scope 強制（原則 6）: project scope を SQL 述語で適用・
  不整合 scope は query 前 reject・**未選択 content field の投影排除** test
- route 規範: identity envelope / 毎リクエスト active recipient 再照会 /
  401・400・**域外と不存在の同一 404**（存在オラクル回避）— mcpOps/m365 と
  同型を維持
- secret-shaped source metadata の**保存前 reject** test（原則 4 の入口面）
- migration 番号は P5-T08（…0000）に続く …0100 で整合、rollback 手順記載
- UI 本体は P7-T08/T10 の管轄に留めた最小 BFF/route（scaffold 相当）

## 妥当性判断

read model を「FK 参照 + 投影制限」だけで構成し、正本（Temporal/approvals/
action_ledger/SoR）に一切の状態を複製しない設計は canon の Storage 節と
DELTA-03 規範に正確に適合。

---

## R01 追補（2026-08-16）

- **R01（blocking、resolved）**: 初回 head `2b2f3e4` は reviewer fresh-DB の
  並行 coverage 実行で workbenchPg（linkRun）が fail — 他 real-PG suite が
  共有 TEST_DATABASE の public tables を cleanup するため authority fixture が
  相互削除される分離問題。root-fix `1a2750f`: suite 固有の random schema
  （search_path 固定）に閉じる分離。maxWorkers 等の隠蔽なし
- reviewer 検証: fresh-DB `mise run ci` を**2 回連続 exit 0**（失敗 0 件）
- verdict: **approve at `1a2750f`**
