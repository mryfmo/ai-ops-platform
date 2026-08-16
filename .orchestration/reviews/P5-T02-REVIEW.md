# P5-T02-REVIEW — approve at `23cb3cf`

- task_id: P5-T02 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-16
- head_sha: 23cb3cf2e2173c4ebd734e4170a13f4d70226697
- verdict: **approve**（note 1 件）

## 独立再検証

- `@aiops/integrations` 60/60 再実行
- 反証プローブ 10 families（built dist、全て仕様どおり）:
  1. token provider が app-only claims → **E-WIQ-IDENTITY**（client 内の
     強制再検証は provider を信用しない — 迂回不能）
  2. cross-tenant claims → E-WIQ-IDENTITY
  3. fetch の部分結果（entityUrls 2 件に results 1 件）→ E-WIQ-MALFORMED
  4. item 内 statusCode 404 → E-WIQ-HTTP（外側 200 でも fail）
  5. provenance あり → provenanceComplete: true + identity 添付 /
     なし → false + 空 refs（捏造なし、裁定どおり）
  6. ask network 失敗 → 1 call（非再送）
  7. fetch 5xx → 2 calls（bounded 1 retry）/ ask 5xx → 1 call（非対称を実測）
  8. path traversal（`..`）→ E-WIQ-INPUT throw
  9. `$skiptoken` 注入 → E-WIQ-INPUT throw
  10. JSON-RPC error envelope → E-WIQ-MALFORMED

## 妥当性判断

- **wire contract 裁定の遵守**: `/mcp` JSON-RPC tools/call 固定
  （endpoint 定数 + constructor で origin/pathname 検証）。SSE/JSON 両応答の
  strict parse、structuredContent 優先、hasOnlyKeys による未知 field 拒否
- **user identity preserved**: 全呼出で claims を再検証し成功結果に identity を
  添付。identity 差替え・昇格の経路なし。tool は ask/fetch/get_schema の
  型 union のみ（write 不能設計）
- **timeouts/error mapping**: withTimeout（≤30s bound）、E-WIQ-* fail-closed
  正規化、timeout→success なし、部分結果非返却
- provenance は Microsoft 公式 doc URL をコード根拠に verbatim 保持 +
  欠落明示 flag（WIQ-002 conformance 項目として validation に記録済み）
- fresh-DB `mise run ci` exit 0（reviewer 環境単独判定）

## Note

1. retry 面は fetchWithBackoff の仕様どおり **HTTP 429/冪等 5xx のみ**。
   network 例外は idempotent read でも即時 fail（保守的方向で安全性は同等、
   可用性がやや低い）。live 化後に必要なら shared util 側の拡張として別途検討
