# P0-T09: Define secret and identity migration plan（WBS 正本タスク）

- task_id: P0-T09
- WBS 正本: docs/plans/2026-08-final-architecture/06_implementation/02_wbs.yaml（P0-T09）
- repo: /Users/mryfmo/Workspace/ai-ops-platform（branch `agent/P0-T09-secret-identity-migration`、base = f179156 以降の main）
- Writer: codex-gpt56-sol-high（= codex-deep-dot）
- Reviewer: claude-code-fable5-xhigh（orchestrator 受入時）
- risk: **high** / max_turns: 30
- acceptance gates: GOV-003
- 依存: P0-T03（merged）。実施順: P0-T04 の後

## Intent

現行の credential 面（ANTHROPIC_API_KEY 直接持ち、GitHub App/PAT、Graph app 資格、
webhook/callback secret、DB 資格）から最終形（LiteLLM 経由の provider key 集中管理、
agentgateway/OPA 前段、Entra Workload ID / OBO、AIOPS_PR_TOKEN 分離）への
**credential matrix と rotation 順序**を確定する。受入条件: (1) master/provider key が
client/runner に残らない設計であること、(2) break-glass 手順が文書化されること。

## 実装要件

1. **Credential matrix**（docs/security/ 配下、日付付きファイル名）: 全 credential について
   { 名称 / 種別 / 現保有場所 / 最終形の保有場所 / スコープ最小化 / rotation トリガと順序 /
   失効検知 / 監査記録先 } を表形式で。現行 .env.example・server config スキーマ・
   P0-T06 台帳・ADR-0022/0023 と整合させること
2. **移行順序**: どの credential をどのフェーズ（P1 LiteLLM → P2 gateway → …）で
   どの順に移すか。各ステップに rollback（旧 credential 即時復帰）を付す
3. **break-glass**: LiteLLM/gateway 停止時の直接経路復帰手順（runbooks/ 配下）。
   inference.anthropic_direct_fallback flag（requires: classification<=internal +
   explicit-provider-allow）との整合。発動条件・承認者・監査記録・事後 rotation 義務を明記
4. **no-master-key-on-clients 検証**: 最終形で client/runner 側に残る credential の全列挙と、
   それぞれが provider master key でないことの根拠。現行違反（例: coding-task の
   ANTHROPIC_API_KEY 直接使用 = PACK-05 grandfather）を移行対象として明記
5. `.env.example` の変更は「最終形で不要になる変数」への TODO コメント付与まで
   （実削除は該当フェーズのタスクで行う）
6. 新規ファイルは根拠ヘッダ必須（FinalArch:NFR-SEC-xxx / GOV-003 / ADR-0022/0023 等）

## allowed_paths（WBS 準拠）

```
docs/security/**
runbooks/**
.env.example
```

## forbidden

- main direct push / force push / merge / 実装コード変更 / 依存変更 / 本番設定
- 実 credential・実テナント ID・実 key 素材を文書に書くこと（すべてプレースホルダ）

## 品質要件

- PR（ai-generated、task ID・変更理由・実行コマンドと結果・未実行検証と理由）
- 検証: gitleaks 相当 secret scan green + `mise run ci` green（fresh disposable DB、exit code 個別確認）
- 証跡5ファイル（.orchestration 規約）

## 完了報告

```
AGMSG-RESULT v1 task_id=P0-T09 status=ready_for_review report=.orchestration/reports/P0-T09-report.md validation=.orchestration/validation/P0-T09-validation.md sandbox=.orchestration/sandboxes/P0-T09-sandbox.md learning=.orchestration/learning/P0-T09-learning.md autoskill=.orchestration/autoskill/runs/P0-T09-autoskill.md
```
