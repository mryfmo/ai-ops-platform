# P5-T08-REVIEW — approve at `47a84b4`

- task_id: P5-T08 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-16
- head_sha: 47a84b40a521e0958ef19b77b8a7446cdeaecfba
- verdict: **approve**

## 独立再検証

- `@aiops/integrations` 68/68 / `@aiops/server` 890 pass（PG trigger test 含む）
- 反証プローブ 6 families（built dist、全て仕様どおり）:
  A. 正規 differential（owner 全可 + comparison に ACCESS-DENIED あり）→ passed /
  B. comparison 全可（trimming の証拠なし）→ **false**（「差が出ない = 不合格」の
  厳密判定）/ C. comparison に network error 混入 → inconclusive → false
  （曖昧さを合格にしない）/ D. client が別 subject の identity を返す →
  E-WIQ-REF-IDENTITY（identity binding — probe 対象のすり替え防止）/
  E. cross-tenant 比較 → throw / E2. 同一 subject 比較 → throw

## 検分

- **schema/migration（amendment 条件の遵守）**: `work_iq_query_receipts` は
  原文列なし（question_hash は ask のみ・sha256 形式 CHECK、fetch は NULL 強制）、
  **UPDATE/DELETE/TRUNCATE を REVOKE + trigger で二重遮断**（追記専用）、
  既存テーブル不変、DELTA-03 相関方針（decisionId/traceId、二重記録禁止）を
  コメントで明記。migration ⇔ schema.sql parity は verify:db（ci 内）で検証
- **client 拡張**: 403 → `E-WIQ-ACCESS-DENIED`（外側/entity 内両方）—
  differential の conclusive 判定の基盤。既存挙動の破壊なし（68 tests）
- **accessibility probe**: refs 解決不能・fetch 失敗・identity 不一致を
  個別 evidence 化し、`allAccessible` は全件 accessible のみ
- **real-tenant harness**: 手順・env 変数名・期待値を validation に文書化
  （実資格情報なし）。WIQ-001/002/005 の実 tenant 実行は sandbox-m365 到達後
- receipts repo は sanitizeJsonDeep 経由で保存（原則 4）。gitleaks は CI 検証

## 妥当性判断

「results cite accessible sources only」の機械検証と、permission-trim の
two-user differential が**曖昧さを合格にしない**厳密な意味論で実装された。
評価: differential の「comparison 側に少なくとも 1 件の明示 ACCESS-DENIED を
要求する」設計は、trimming が実際に機能していることの積極的証明であり
WIQ-002 の趣旨に適合する。
