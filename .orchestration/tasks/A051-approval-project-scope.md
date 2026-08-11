# A051: 承認のプロジェクトスコープ細粒度認可

- task_id: A051
- repo: /Users/mryfmo/Workspace/ai-ops-platform（main worktree。ブランチ `agent/a051-approval-scope`）
- 発行: claude-deep-dot（orchestrator）2026-08-09
- 担当: codex-deep-dot（herdr pane w1D:p5, `codex --profile deep` = gpt-5.6-sol high、fresh session）
- レビュー・受入: claude-deep-dot
- max_turns: 30
- 根拠: A044 の明示的後続（PR #143/#144 スレッド裁定）/ DEC-SPEC-002 / AGENTS.md 原則6

## 実装要件

1. `change` 承認の decide 認可を細粒度化:
   - **PRF-G**: 全プロジェクトの change を承認可（現状維持）
   - **PRF-L**: 承認対象の `approvals.project_id` が、その承認者の**リクエスト時 active assignment
     のプロジェクト集合に含まれる場合のみ**承認可（データ側・毎リクエスト解決、キャッシュ禁止）
   - `project_id IS NULL` の承認は **PRF-G のみ**（fail-closed）
   - 拒否は 403 + 監査（既存パターン）
2. AGT_CHG が `project_id` を実際に設定していることを確認し、設定できないケースが
   あるなら（リンク不能な deployment）その承認は NULL → PRF-G 専用に落ちることをテストで固定
3. WebUI 承認一覧: 承認者が decide できない行の表示方針を決める——**一覧には出すが
   decide 操作を無効化し理由を表示**（可視性は列挙権限、操作は認可の問題として分離）。
   これが既存 UI 規約と衝突する場合は blocked
4. scope_mode=all の扱い: A050 で導入された recipients.scope_mode が approver 解決にも
   関与するなら整合させる（PRF-L + scope_mode=all は全プロジェクト承認可とするか否か——
   **DEC-SPEC-002 と spec の権限モデルから根拠を引いて決め、引けなければ blocked**）

## 品質要件

- 仕様IDヘッダ / describe に仕様ID / `mise run ci` green（実PG）/ matrix 再生成
- テスト: PRF-L 域内承認可・域外403・NULL は PRF-G のみ・毎リクエスト解決（assignment 変更が
  即反映）・監査記録
- 証跡5ファイルを PR に含める（本リポジトリ規約）
- PR（ai-generated）→ checks green（merge 前スレッドゲート込み）。merge はしない

## forbidden_actions

- allowed_files 外編集、封筒契約の変更、依存追加、merge、force push

## allowed_files（必要に応じ拡張要求可）

```
packages/server/src/http/routes/approvals.ts
packages/server/src/db/approvalsRepo.ts
packages/server/src/db/recipientsRepo.ts
packages/devops/src/agents/AGT_CHG.ts
packages/server/tests/approvalsRoutes.test.ts
packages/server/tests/approvalsRepo.test.ts
packages/server/tests/recipientsRepo.test.ts
packages/devops/tests/agtHumanReviewCards.test.ts
packages/web/src/app/approvals/**
packages/web/tests/approvals.test.tsx
packages/traceability/output/traceability_matrix.md
.orchestration/**（A051 証跡）
```

## 完了報告

```
AGMSG-RESULT v1 task_id=A051 status=ready_for_review|blocked report=.orchestration/reports/A051-report.md validation=.orchestration/validation/A051-validation.md sandbox=.orchestration/sandboxes/A051-sandbox.md learning=.orchestration/learning/A051-learning.md autoskill=.orchestration/autoskill/runs/A051-autoskill.md
```
