# 非目標・除外事項

## Baselineから明示的に除外

- Cloudflare Artifacts、ArtifactFS。
- Cloudflare OS全体のforkまたはCloudflare runtimeへの全面依存。
- OpenTag内蔵LangGraph agentを全体オーケストレーターにすること。
- Notionを正式な標準構成へ追加すること。
- LiteLLMのMCP/A2A Gateway機能。
- agentgatewayのLLM Gateway機能。
- AIによるmainへの直接push、自動merge、本番自動復旧。
- Work IQによるapp-only background job。
- M365、Plane、GitHub、Confluence、Wisprの全データを単一DB/ベクトルDBへ複製すること。
- 全文会話・全文メールを無条件に長期保存すること。
- 既存14エージェントを一度に廃止して新frameworkへ全面書換えすること。

## 将来候補だが今回実装しない

- OpenFGA。関係ベース認可がOPA/Entra/SoR権限で管理不能になった時だけ追加。
- Gadgetコードを利用者が自由生成・実行する完全なCloudflare OS型環境。
- Work IQ A2Aによる自律agent delegation。read/ask経路の実証後に再評価。
- 自動修復deploy。最初はdiagnosisとPR作成まで。
- Notion Innovation Sandbox。明示的な別決定がある場合のみ。
