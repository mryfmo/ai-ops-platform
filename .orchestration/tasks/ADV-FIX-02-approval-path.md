# ADV-FIX-02: 人間承認決定パスの修復(C-1)

- 発注: claude-deep-dot(オーケストレータ)
- 根拠: `.orchestration/audit/2026-08-18-adversarial-full-review.md` C-1 / M-18。着手前に必読。
- ブランチ: `agent/ADV-FIX-02` を `origin/main` から作成(ADV-FIX-01 がマージ済みならその main から)。PR base=main、`ai-generated` ラベル、draft 禁止、テンプレート記入、自動マージ禁止。

## Objective

REQ-010 の根幹である承認決定パスの3ブロッカーを解消し、WebUI から `POST /approvals/:id/decision` まで正しいプロトコルで到達できるようにする。Temporal `signalApprovalDecision` の結線(P3 スコープ)は本タスク対象外 — 未結線時の 503 は「機能準備中」としてUIに明示する。

## 設計方針(この方向で実装。乖離が必要なら実装前に blocked で相談)

1. **create 時の CAS 前提列**: `ApprovalsRepo.create` が `expected_version = 1` と `expires_at` を必ず設定する。TTL は spec/TH-002(60分自動 expire)と schema コメントを確認して整合する値を採用し、根拠を report に記載。
2. **correlation の配布**: `GET /approvals` 応答の各 `canDecide: true` 行に `version`(= expected_version)と `correlation`(既存 `signApprovalCardCorrelation` を要求者の tenantId/objectId で署名)を含める。canDecide: false 行には含めない。
3. **web BFF**: `packages/web/src/server/approvalsClient.ts` の decision 送信 body を server 契約(`action:"approval_decision"`, `approvalId`, `version`, `correlation`, `decision`, `reason`)に一致させ、list 応答から version/correlation を伝搬。
4. **UI(ApprovalsPanel)**: (a) 初回ロード中は「読み込み中」を表示し、フェッチ完了まで「承認待ちの項目はありません。」を出さない(M-18)。(b) decision 失敗時は status 別メッセージを表示(400/401/403/409/503。503 は「承認機能は現在準備中です」)。無音失敗を残さない。
5. **既存の Teams カード経路・schema・状態機械は変更しない。**

## Allowed files

- packages/server/src/db/approvalsRepo.ts
- packages/server/src/http/routes/approvals.ts
- packages/server/tests/**
- packages/web/src/server/approvalsClient.ts
- packages/web/src/app/approvals/** (ApprovalsPanel 等)
- packages/web/src/app/api/** (approvals BFF ルートのみ)
- packages/web/tests/**
- .orchestration/{reports,validation,sandboxes,learning,autoskill/runs}/ADV-FIX-02*
- .agents/worklog/codex/**

## Forbidden actions

- schema.sql / migrations 変更(expected_version/expires_at 列は既存であることを確認して使う。無ければ blocked 報告); Temporal/composition root の変更; 依存追加; 権限モデル変更; 上記以外の編集; draft PR; merge; force push。

## Validation(exit code 明記・パイプで潰さない)

1. server テスト: `app.request()` による end-to-end — list→(version/correlation 取得)→decision POST が署名検証を通過し `signalApprovalDecision` スタブに到達するテスト、および correlation 改竄/他人 identity/version 不一致が拒否されるテスト。
2. web テスト: BFF body 契約テスト、Panel のローディング/エラー表示テスト。
3. `mise run lint` / `mise run typecheck` / `mise run traceability` / `mise run format`、対象3パッケージの `pnpm --filter ... run test`。
4. 新規テストのタイトルに検証仕様 ID(REQ-010 系 / 該当 AC)を含める。

## Expected artifacts

- report: .orchestration/reports/ADV-FIX-02-REPORT.md(PR URL、TTL 根拠、cost: 行、[memory:decision] マーカー)
- validation: .orchestration/validation/ADV-FIX-02-validation.md
- sandbox: .orchestration/sandboxes/ADV-FIX-02-SANDBOX.md
- learning: .orchestration/learning/ADV-FIX-02-learning.md
- autoskill: .orchestration/autoskill/runs/ADV-FIX-02.md
- CompactionDB: 完了前に `python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project` 実行、コマンドを report に併記。

## Done

`AGMSG-RESULT v1 task_id=ADV-FIX-02 status=ready_for_review ...`。max_turns=60。
