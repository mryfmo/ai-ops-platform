# P0-T04: Implement architecture fitness checks（WBS 正本タスク）

- task_id: P0-T04
- WBS 正本: docs/plans/2026-08-final-architecture/06_implementation/02_wbs.yaml（P0-T04）
- repo: /Users/mryfmo/Workspace/ai-ops-platform（branch `agent/P0-T04-fitness-checks`、base = 最新 main）
- Writer: codex-gpt56-sol-high（= codex-deep-dot）
- Reviewer: claude-code-fable5-xhigh（orchestrator 受入時）
- risk: medium / max_turns: 30
- acceptance gates: GOV-004 / GOV-005
- 依存: P0-T03（merged #154）。実施順: P0-T06-merge → P0-T08-REVIEW の後

## Intent

20 不変条件（INV-001..020、docs/plans/2026-08-final-architecture/03_architecture/03_invariants.md）
のそれぞれに「自動 fitness check」または「文書化された手動ゲート」を対応付け、自動側を
`mise run governance` として CI に組み込む。移行が進んでも禁止形（直接 egress、gateway 二重化、
Cloudflare Artifacts、危険 MCP tool 常時有効化）が構造的に入り込めない状態を作る。

## 実装要件

1. **INV マトリクス**: 20 不変条件 × { automated check | manual gate } の対応表を成果物に含める
   （scripts/ 配下の check 実装 or docs 参照。全 INV が漏れなくどちらかに載ること = acceptance 1）
2. **自動 check（最低限）**:
   - 禁止直接 egress: LLM/外部 API を allowlist 外の直接 fetch で呼ぶ import/URL パターン検出
     （既存 SPEC-INT-060 allowlist と整合。grandfather: 既存クライアント経由は許可）
   - gateway 二重化検出: agentgateway 経路確立後に別経路で MCP/A2A を張る構成の検出
     （現段階では「新規経路はレジストリ登録必須」の静的検査として実装可）
   - Cloudflare Artifacts / Notion baseline: 依存・設定・URL の混入検出（immutable-off flag と対応）
   - 危険 MCP tool: 許可リスト外 tool 名の設定ファイル混入検出
   - 移行 flag レジストリ整合: `packages/shared/src/migration/featureFlags.ts` と正本
     `08_feature_flags.yaml` の一致検証（PR #156 の契約を CI で恒久保証）
3. **`mise run governance`** タスクを .mise.toml に追加し、`mise run ci` の列に組み込む
   （ci.yml 変更時は **DELTA-06: .ci/agt-dep-evidence.json artifact 契約（PR #149）を保存** = acceptance 2）
4. **Vitest 4 `--` フィルタ退行の是正**（P0-T05 learning の取込）: `pnpm --filter X run test -- <pattern>`
   がフィルタとして機能しない問題を、mise タスクまたは test script の形で正しいフィルタ渡しに修正
5. 新規ファイルは根拠ヘッダ必須（FinalArch:INV-xxx / GOV-004 / GOV-005 が使用可能。P0-T03 で文法登録済み）

## allowed_paths（WBS 準拠）

```
scripts/**
tests/**
package.json
.mise.toml
.github/workflows/ci.yml
docs/plans/2026-08-final-architecture/**（INVマトリクス文書を置く場合のみ・既存文書の書換禁止）
```

## forbidden

- main direct push / force push / merge / 依存追加（既存ツールチェーンで実装）/ 本番設定
- 既存 check・ゲートの弱体化（traceability・gitleaks・governance 対象の縮小）

## 品質要件

- PR（ai-generated、task ID・変更理由・実行コマンドと結果・未実行検証と理由）
- 検証: `mise run governance` 単独 green + fresh disposable DB での `mise run ci` green（exit code 個別確認）
- 反例テスト: 各自動 check につき「違反を検出する」negative fixture を最低 1 件
- 証跡5ファイル（.orchestration 規約）

## 完了報告

```
AGMSG-RESULT v1 task_id=P0-T04 status=ready_for_review report=.orchestration/reports/P0-T04-report.md validation=.orchestration/validation/P0-T04-validation.md sandbox=.orchestration/sandboxes/P0-T04-sandbox.md learning=.orchestration/learning/P0-T04-learning.md autoskill=.orchestration/autoskill/runs/P0-T04-autoskill.md
```
