# 決定権限とドリフト防止

## 優先順位

1. 法令・契約・社内セキュリティ規程
2. 明示的な人間Owner決定
3. 承認済み仕様原本とAccepted ADR
4. 本パックの不変条件・契約・WBS
5. リポジトリのAGENTS.mdとpackage-local規約
6. 各タスクの実装判断

下位の資料が上位と衝突した場合、LLMは勝手に解釈で解消せず、`BLOCKED-DECISION`として止める。

## Decision Budget

| 区分 | 例 | LLMの扱い |
|---|---|---|
| GREEN | private helper、test fixture、内部型の整理 | 自律決定可。PRに理由を記載 |
| YELLOW | public API、DB migration、dependency追加、feature flag既定値 | 提案を作りReviewer承認後に実装 |
| RED | SoR、cloud、認証方式、正式承認、retention、MCP high-risk tool | Owner承認済みADRなしでは禁止 |

## Drift Check

各PRで以下を機械・レビュー確認する。

- LiteLLMのMCP/A2A endpointが有効になっていない。
- agentgatewayのLLM routeが有効になっていない。
- direct `api.anthropic.com` 呼出しが許可されたmigration adapter以外に残っていない。
- Work IQをapp-onlyで呼ぼうとしていない。
- Microsoft Graphのbackground/event pathをWork IQへ置換していない。
- MCP manifestにL5/L6操作がない。
- Cloudflare Artifacts依存が追加されていない。
- Notionをbaseline connectorへ追加していない。
- 同じ情報の双方向同期が新設されていない。
- audit_logへのUPDATE/DELETEがない。
- branch protectionを前提にした実装なのに実設定証跡がない状態でgo-liveとしていない。

## Architecture Change Procedure

RED変更が必要な場合は次の順序を固定する。

1. 既存要件と影響範囲を列挙。
2. 新ADRを`Proposed`で作成。
3. security、data、operations、license、migration、rollbackを評価。
4. Owner承認。
5. Accepted ADRと同じPRでspec catalog、WBS、test catalogを更新。
6. 実装PRは別にする。
