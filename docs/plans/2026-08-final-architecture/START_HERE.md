# ai-ops-platform 最終構成 実装・検証パック

対象リポジトリ: `mryfmo/ai-ops-platform`  
基準ブランチ: `main`  
基準コミット: `49e2e3c0a3a9d30be46b2a3ae0727009d9eec324`  
作成基準日: 2026-08-09（JST）

## このパックの目的

このパックは、既存の **PrjOps 7エージェント + DevOps 7エージェント**の趣旨、仕様トレーサビリティ、決定的ロジック、追記専用監査、GitHub PR承認を壊さずに、次の最終構成へ段階移行するための実装正本である。

- AI Control Plane: `Temporal` + 薄いControl API + PostgreSQL ledger
- LLM Inference Plane: `LiteLLM`（Amazon Bedrockを標準、Anthropic APIを制御された代替経路）
- MCP / A2A Access Plane: `agentgateway`
- Policy: `OPA`
- M365 Intelligence Plane: `Microsoft Work IQ`
- Deterministic M365 Integration: `Microsoft Graph`
- User surfaces: Teams（OpenTag由来）+ 既存Next.js Web Workbench（Cloudflare OSの良い設計だけを移植）
- Meeting intelligence: `Wispr Flow`
- Operational PrjOps: `Plane`
- DevOps and code record: `GitHub`
- Working technical knowledge: `Confluence`
- Formal records/evidence: `SharePoint`
- AI workers: Claude Code / Droid（1タスク1 Writer、必ずPR経由）
- Observability: `OpenTelemetry`
- `Cloudflare Artifacts` は採用しない。

## 最初に読む順序

1. `00_governance/01_product_intent_and_invariants.md`
2. `01_current_state/01_repository_assessment.md`
3. `03_architecture/01_target_architecture.md`
4. `06_implementation/01_master_plan.md`
5. `06_implementation/02_wbs.yaml`
6. 担当モデルに応じて以下を読む
   - Claude Code: `07_agent_execution/CLAUDE_CODE_FABLE5_XHIGH.md`
   - Codex: `07_agent_execution/CODEX_GPT56_SOL_HIGH.md`
7. 各タスク開始前に `07_agent_execution/CHANGE_BOUNDARIES.yaml` と `08_verification/02_acceptance_test_catalog.yaml` を確認する。

## 絶対ルール

- 本パックより上位なのは、リポジトリの承認済み仕様原本、明示的な人間の決定、法務・セキュリティ規程のみである。
- LLMは、アーキテクチャ、System of Record、認可境界、モデル提供経路、正式承認場所を独自判断で変更してはならない。
- ローカル実装上の詳細は判断してよいが、公開契約、依存追加、DB変更、外部書込み、権限変更はタスク記載の境界を超えてはならない。
- 同一タスク・同一branchのWriterは1モデルだけとする。他方はReviewerであり、レビュー中に修正を混在させない。
- `main`への直接push、自動merge、本番直接変更、MCP経由のmerge/deploy/delete/permission変更は禁止する。
- 実行できなかった検証を「成功」と記載しない。証跡のない完了主張は禁止する。

## 完了の定義

各タスクは、WBSの成果物、完了条件、検証コマンド、証跡、Reviewer判定がすべて揃って初めて完了である。最終的なリポジトリDefinition of Doneは、既存規約に従い `mise run ci` greenに加え、本パックのリリースゲートを満たすこととする。
