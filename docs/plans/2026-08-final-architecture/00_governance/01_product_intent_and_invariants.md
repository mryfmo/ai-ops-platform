# 製品の趣旨・意図と不変条件

## 1. 本来実現するもの

本システムは、単なるAIチャット、単なるプロジェクト管理画面、単なるCI/CDツールではない。経営、投資元、部門長、課長、プロジェクト責任者、開発者、運用者が、同じ根拠へ到達し、人間が判断・承認し、AIエージェントが安全に実行する **PrjOps + DevOps + AIOps統合運用基盤**である。

目的は次の4点である。

1. プロジェクト状況、開発事実、運用事実、会議・文書を関連IDで結び、役割ごとに必要な粒度で提供する。
2. AIに計画・分析・実装・検証を委譲しつつ、重要な判断、正式発行、merge、deploy、権限変更は人間が統制する。
3. LLMやSaaSを交換しても、業務ワークフロー、監査証跡、System of Recordが崩れないようにする。
4. 「動いたように見える」ことではなく、要件、実装、テスト、外部証跡を追跡可能にする。

## 2. 不変条件

| ID | 不変条件 |
|---|---|
| INV-001 | Planeは日々のPrjOps運用状態の正本。GitHubはコード、PR、CI/CD、release/deployment事実、versioned specs/ADRs/contractsの正本。 |
| INV-002 | Confluenceは技術・開発・運用のWorking Knowledge。SharePointは承認済み正式文書・正式議事録・証跡の正本。 |
| INV-003 | Teams/Outlook/Wispr/AI Workbenchの会話・出力は、それだけでは正式記録にならない。正本へ発行して初めて正式化する。 |
| INV-004 | Temporalが長期workflow、retry、timer、approval wait、compensation、cancellationの正本。server内の独自setTimeout loopを最終形にしない。 |
| INV-005 | LiteLLMはLLM推論専用。Amazon Bedrockを標準経路、Anthropic APIを許可された代替・native機能経路とする。MCP/A2A機能は使わない。 |
| INV-006 | agentgatewayはMCP/A2A専用。LLM inference routingは使わない。 |
| INV-007 | Work IQはユーザー委任のMicrosoft 365 intelligence。Microsoft Graphはapp-only、通知、background job、決定論的な正式操作を担当する。 |
| INV-008 | OPAが全社横断のpolicy decisionを行う。Microsoft 365元権限、Work IQ内ポリシー、GitHub protectionを置き換えない。 |
| INV-009 | Cloudflare Artifactsは採用しない。Cloudflare OSはWorkspace/Gadget/Capability/Deferred Approvalの設計要素だけを既存Webへ移植する。 |
| INV-010 | OpenTagはTeams/Slackの会話・rich UI・HITL surfaceとして薄く使い、Control PlaneやSystem of Recordにはしない。 |
| INV-011 | 1タスク=1 Writer。Claude CodeとDroid/Codexは同じbranchを同時編集しない。Reviewerはレビュー中に無断修正しない。 |
| INV-012 | main直接push、自動merge、本番直接変更は禁止。AI変更はbranch/PR/CI/人間承認を通す。 |
| INV-013 | MCPにmerge、production deploy、delete、permission/retention変更のtoolを公開しない。 |
| INV-014 | 数値、色、状態遷移、権限、対象範囲、承認要否はコード/Policyで決定し、LLMに決めさせない。 |
| INV-015 | 外部テキストは保存前、LLM入力前、外部出力・ログ前にサニタイズする。Prompt Injectionをデータとして扱う。 |
| INV-016 | audit logは追記専用。全副作用にcorrelation/trace/workflow/actor/basisを付ける。 |
| INV-017 | 未実行の検証、mockだけのE2E、設定不足で無効な経路を完了と扱わない。 |
| INV-018 | Azure managed platformの既存承認を維持する。Bedrock利用だけを理由にcontrol planeをAWSへ移さない。 |
| INV-019 | Notionはbaselineに含めない。既存利用を残す場合も企画・PoC用途に限定し、Confluence/Plane/SharePointと同じ情報を二重管理しない。 |
| INV-020 | 既存の仕様ID、ADR、traceability gate、純粋libとagent orchestrationの分離を維持・拡張する。 |

## 3. LLMが判断してよい範囲

- private関数名、ファイル内の小規模な分割、テストfixtureの構成。
- 既存規約に沿った型名、変数名、エラーコードの具体化。
- 同一契約内でのリファクタリング。
- タスクに明記されたdependencyのexact version選定。ただし公式一次情報と互換試験が必要。

## 4. LLMが判断してはいけない範囲

- System of Recordの変更。
- Azureから別cloudへの移行。
- LiteLLMとagentgatewayの責務統合。
- Work IQとGraphの役割逆転。
- MCP high-risk toolの追加。
- mainへのAI自動merge/deploy。
- branch protectionや人間承認の弱体化。
- NotionまたはCloudflare Artifactsの再導入。
- 既存要件を「古い」とみなし無断削除すること。
