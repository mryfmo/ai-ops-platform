# A044: approvals 基盤（Critical AUD-OPM-001 の解消）

- task_id: A044
- repo: /Users/mryfmo/Workspace/ai-ops-platform（main worktree。`git checkout main && git pull --ff-only origin main`、ブランチ `agent/a044-approvals-foundation`）
- 発行: claude-deep-dot（orchestrator）2026-08-08
- 担当: codex-deep-dot（herdr pane w1D:p4, `codex --profile deep` = gpt-5.6-sol high）
- レビュー・受入: claude-deep-dot
- max_turns: 40
- 根拠: AUD-OPM-001（旧監査 Critical・2026-07-11 から未変化）/ ADV-WIR-007 / ADV-SEC-010 /
  DEC-SPEC-002 / 委任裁定 R-01-1〜4・R-02-5（`00-owner-decisions.md` 委任裁定記録）

## 現状

`AGT_CHG.ts:88` が承認 URL 付きカードを送るが、**受け口のルートも DB テーブルも存在しない**。
承認という行為そのものがシステムに存在しない（Critical）。

## 実装要件（委任裁定に従う）

1. **調査を先に行う**: packages/web の Entra 認証（`auth.ts` / `server/authGuard.ts` /
   `server/entraClaims.ts`）と server の WebUI プロキシ（ADR-0005）の間で、
   **認証済み `(entra_tenant_id, entra_object_id)` を server 側 API までどう伝搬するのが
   既存契約に整合するか**を確定し validation に記録する。既存に伝搬契約が無く新設が
   必要で、その設計が複数解釈可能なら **blocked**。
2. **`approvals` テーブル**（新規。R-01-2）: `approval_id` PK / `approval_type`
   （`change|report|jit_grant`。CHECK 制約）/ `target_id` / `status`
   （`pending|approved|rejected`）/ `requested_by` / `approver_tenant_id` /
   `approver_object_id` / `decided_at` / `reason` / created 系。schema.sql は fresh 形 +
   migration 新規作成。**状態遷移のたびに追記専用監査ログへ記録**（reject は
   `validateReasonRequirement` で理由必須）。
3. **repo 層** `packages/server/src/db/approvalsRepo.ts`: create / listPending /
   decide（pending→approved|rejected の CAS。二重承認は no-op でなく明示エラー）。
   実 PG テスト（既存 eventsRepo テストのパターン踏襲）。
4. **server ルート**: 承認一覧と decide。**認証済み Entra identity 必須**（R-01-3。
   identity が取れないリクエストは 401。表示名では受けない）。決定は repo の CAS 経由。
5. **WebUI 承認画面**（R-01-1）: authGuard 配下に pending 一覧 + approve/reject（reject は
   理由必須）。既存 web の UI/テスト規約に従う。
6. **AGT_CHG の decisionUrl** を WebUI 承認画面の URL へ変更（`AGT_CHG.ts`）。
7. report / jit_grant タイプは**テーブル・API のレベルで受けられる**ようにするだけでよい
   （配信承認ワークフロー・JIT 書き手の結線は後続タスク。R-01-4 / R-02-5 の受け皿）。

## 判断が必要になったら（blocked）

- identity 伝搬の既存契約が無く、新設設計が一意に決まらない場合
- web と server の間で新しい共有 secret / トークンが必要になる場合（secrets 追加は operator 事項）

## 品質要件

- 仕様IDヘッダ（衝突IDは namespace）/ describe に仕様ID / `mise run ci` green（実PG）/
  matrix 再生成 / audit_log への UPDATE/DELETE を書かない（原則5）
- schema 変更は repo 層 + テスト + ロールバック DDL コメント同梱（AGENTS.md）
- ブランチ → push → PR（ai-generated）→ checks green → `git checkout main`。merge はしない

## forbidden_actions

- allowed_files 外編集、依存追加、新規 secret の導入、merge、force push

## allowed_files

```
packages/devops/src/db/schema.sql
packages/devops/src/db/migrations/202608080000_approvals.sql
packages/server/src/db/approvalsRepo.ts
packages/server/src/http/routes/approvals.ts
packages/server/src/http/app.ts
packages/server/src/index.ts
packages/server/tests/approvalsRepo.test.ts
packages/server/tests/approvalsRoutes.test.ts
packages/devops/src/agents/AGT_CHG.ts
packages/devops/tests/agtChg.test.ts
packages/web/src/app/approvals/**
packages/web/src/server/approvalsClient.ts
packages/web/tests/approvals.test.tsx
packages/traceability/output/traceability_matrix.md
```

（web 側のファイル名は既存規約に合わせて調整可。逸脱する場合は report で明示）

## 完了報告

```
AGMSG-RESULT v1 task_id=A044 status=ready_for_review|blocked report=.orchestration/reports/A044-report.md validation=.orchestration/validation/A044-validation.md sandbox=.orchestration/sandboxes/A044-sandbox.md learning=.orchestration/learning/A044-learning.md autoskill=.orchestration/autoskill/runs/A044-autoskill.md
```
