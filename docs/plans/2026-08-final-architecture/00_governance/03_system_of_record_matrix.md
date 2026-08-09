# System of Record / Authority Matrix

| 情報領域 | Authoritative system | AI Ops Platformで保持するもの | 禁止事項 |
|---|---|---|---|
| Portfolio、project、milestone、risk、dependency、daily work state | Plane | ID mapping、event、snapshot、derived metrics | GitHub/Confluence/Teamsで同一fieldを編集可能にしない |
| Source code、Issue、PR、review、CI、release、deployment | GitHub | webhook event、workflow link、derived DORA/AIOps metrics | PlaneやTeamsからmainを直接変更しない |
| Versioned ADR、contract、code-adjacent docs | GitHub | indexed metadata、canonical URL、commit SHA | Confluenceを同じ文書の同格正本にしない |
| 技術設計、Runbook、FAQ、継続更新する知識 | Confluence | page ID、version、review status、canonical URL | SharePointと全文双方向同期しない |
| 承認済み正式文書、正式議事録、納品物、監査証跡 | SharePoint | item ID、version、classification、publication event | Teams/Wispr/Confluenceだけで正式発行済みにしない |
| 会議録音、文字起こし、AI議事録候補 | Wispr Flow | meeting correlation、取得時刻、review/publication state | Wisprノートを法的・正式記録の唯一の正本にしない |
| Mail、calendar、Teams、M365 documentsのuser-context intelligence | Microsoft 365 + Work IQ | request/response metadata、policy decision、source references | 取得結果を無条件にBedrock/Anthropicへ転送しない |
| M365 event、background処理、formal write | Microsoft Graph / M365 | subscription、delivery ID、idempotency、result | Work IQでapp-only/batchを代替しない |
| Workflow実行状態 | Temporal | workflow reference、business ledger、audit event | Teams threadやWeb sessionをworkflow正本にしない |
| Policy decision | OPA + source platform permissions | decision receipt、policy version | LLMにallow/denyを決めさせない |
| Model invocation | LiteLLM | request metadata、model alias/provider binding、usage/cost | provider keyをclientへ配布しない |
| MCP/A2A tool invocation | agentgateway | tool ID、resource scope、policy/approval、result metadata | high-risk toolを公開しない |
