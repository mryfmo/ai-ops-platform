# 現行リポジトリ評価

## 1. 強みとして維持するもの

| 領域 | 現行資産 | 移行方針 |
|---|---|---|
| モノレポ | pnpm workspace、mise固定、package境界 | 維持。追加packageを同じ規約へ統合 |
| 決定性 | `src/lib`と`src/agents`の分離 | Temporal Activity導入後も維持 |
| 仕様追跡 | spec ID catalog、traceability tool | 新要件・ADR・testへ拡張 |
| 監査 | PostgreSQL append-only audit log | policy/model/tool/workflow receiptを追加 |
| セキュリティ | secretSanitizer、allowlist、DI、HMAC検証 | 全外部connectorへ横展開 |
| Teams/Graph | notification、polling、channel auth | Graphのsystem pathとして維持 |
| GitHub | App token、webhook、coding task PR | TemporalからのdispatchとDroid対応へ拡張 |
| Web | Next.js、persona、approvals、generative UI | AI Workbenchへ段階拡張 |
| Observability | OTel基礎 | LiteLLM/agentgateway/Temporalへ相関拡張 |
| Governance | AGENTS、CLAUDE import、Skills、CODEOWNERS | 2-model handoffと新境界を追加 |

## 2. 最終構成との主要ギャップ

1. LLMがAnthropic SDKへ直接接続し、Bedrock/Anthropicを統一するGatewayがない。
2. scheduler、retry、approval、coding task stateがserver/DB/GitHub Actionsへ分散し、durable workflow正本がない。
3. MCP/A2Aの中央access plane、tool allowlist、resource scope、統一監査がない。
4. Work IQのdelegated M365 intelligence pathがない。
5. Teamsの対話surfaceはGraph command parser中心で、OpenTag型rich conversational channelがない。
6. Wispr、Confluence、SharePointへのmeeting-to-action/knowledge publication workflowがない。
7. OPAによる全社横断policy decisionがなく、各client/routeの個別guardへ分散している。
8. Claude coding agentはdirect API key、Droidはdisabledである。
9. accepted Azure baselineに対するIaC実装・実証が不足している。
10. main branch protectionが無効で、ADR-0006の人間merge保証がプラットフォーム上で成立していない。

## 3. 現行ADRの扱い

| ADR | 扱い |
|---|---|
| 0001 monorepo | 維持 |
| 0002 Claude SDK | ADR-0022で部分supersede。構造化出力/決定性は維持し、通信先をLiteLLMへ統一 |
| 0003 resident runtime | ADR-0021でscheduler/retry部分をTemporalへ移行。常駐API/worker必要性は維持 |
| 0005 Teams integration | Graph system pathを維持。OpenTag-derived user channelを追加するため部分supersede |
| 0006 AI coding agents | branch/PR/human mergeを維持。LiteLLM、Droid、1 Writerルールを追加 |
| 0013/0018 page agent | 既存WebをWorkBenchへ発展。Cloudflare OS全体は導入しない |
| 0016 Azure platform | 維持。Bedrockは外部inference providerとして接続 |
| 0019 Plane workflow | 運用流動=Plane、record-grade=GitHub/SharePointという境界を維持・明確化 |

## 4. 最優先のSTOP事項

- branch protectionが有効化されるまで、AI Writerの本番運用を開始しない。
- LiteLLM導入前にdirect provider keyを削除しない。dual-run/canaryとrollbackを準備する。
- Temporal導入前に既存schedulerを削除しない。shadow runとcutover gateを通す。
- Work IQ CRUDを初期から有効化しない。read/askとOBOを先に実証する。
- agentgatewayへhigh-risk toolを登録しない。
