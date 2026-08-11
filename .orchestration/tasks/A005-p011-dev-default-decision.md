# A005: Plan 011 P011-F00-T01 decision record を開発用既定値で確定する

- task_id: A005
- repo: /Users/mryfmo/Workspace/ai-ops-platform(worktree /private/tmp/ai-ops-platform-A001)
- 発行: orchestrator-fable5 (2026-07-18)
- 担当: codex-gpt56sol-high
- max_turns: 20
- 根拠: 操作者指示(2026-07-18、.orchestration/acceptance/ADR-0018-owner-approval.md に記録):
  「Plan 011 の HUMAN 入力(Enterprise Org slug / policy admin 2名 / 別人 reviewer)…は、開発用既定値を設定すること」。
  これは Plan 011 P011-F00-T01 の Negative 基準(架空 account・後日入力の不受理)に対する
  **操作者による dev-phase 上書き**である。go-live 前に実値への差し替えが必須。

## 前提手順

1. A004 完了後の最新 origin/main を fetch し、worktree を新ブランチ `agent/A005-p011-dev-defaults` へ
   切り替え(origin/main 起点)。

## 作業内容

1. `docs/decisions/acceptance-trust-bootstrap.md` を新規作成(P011-F00-T01 の Allowed files 準拠):
   - 冒頭に明示バナー: 「**DEV-DEFAULT record** — 本記録は操作者指示(2026-07-18)による開発用既定値であり、
     Plan 011 の Complete/Negative 基準を本番用途では満たさない。P011-F00-T02 以降の実環境整備と
     実値差し替えが完了するまで、本記録に基づく受入証跡は development 限定である。」
   - required fields(全て記入、DEV-DEFAULT は明示タグ付き):
     - Organization slug: `aiops-dev-org`(DEV-DEFAULT・未作成)
     - Enterprise Cloud 契約 owner / 請求承認: mryfmo(DEV-DEFAULT: 契約なし・開発フェーズにつき保留)
     - 移管日時: TBD-at-go-live(DEV-DEFAULT)/ rollback window: 24h(DEV-DEFAULT)
     - named reviewer: `DEV-REVIEWER-1`(DEV-DEFAULT・架空 placeholder)
     - policy admin 2名: `DEV-ADMIN-1` / `DEV-ADMIN-2`(DEV-DEFAULT・架空 placeholder)
     - Apps/Secrets/Actions/Pages/Packages 影響 owner: mryfmo(DEV-DEFAULT)
     - human decision maker: mryfmo、決定日時: 2026-07-18(実承認 — 本セッション)
   - 逸脱と差し替え条件の節: 実値化されるまで P011-F00-T02〜 は本番 BLOCKED のまま、という宣言。
2. `plans/README.md` の Current notes へ 1 行追加:
   「Plan 011: dev-phase の DEV-DEFAULT decision record を docs/decisions/ に確立(操作者指示 2026-07-18)。本番 go-live 前に実値差し替え必須。表の Status は本番基準のため BLOCKED: HUMAN/ENV を維持」
   (表の Status 行は変更しない)
3. format / `MISE_LOCKED=1 mise run ci` green、crit CLI 自己レビュー(resolved まで)。
4. Conventional Commit(docs(decisions): record dev-default trust bootstrap values)→ push →
   PR 作成(base=main、ai-generated ラベル、DEV-DEFAULT の趣旨と差し替え条件を本文へ明記)→
   hosted checks green を確認して RESULT 送信。**merge は orchestrator の受入(AGMSG-ACCEPTANCE)後の
   next_action 指示で実施する。受入前にマージしない。**

## allowed_files

- docs/decisions/acceptance-trust-bootstrap.md(新規)
- plans/README.md(Current notes 1 行のみ)
- .orchestration/reports/A005-report.md
- .orchestration/validation/A005-validation.md
- .orchestration/sandboxes/A005-sandbox.md
- .orchestration/learning/A005-learning.md
- .orchestration/autoskill/runs/A005-autoskill.md

## forbidden_actions

- 実在の第三者 GitHub アカウント名を placeholder に使うこと(架空名は DEV- prefix 必須)
- Plan 011 本文・他 plan の編集、製品コード変更、checks red でのマージ
- worklog・docs/audit の編集、LLM API、ブラウザ Crit、ユーザーへのレビュー依頼

## 完了報告

```
AGMSG-RESULT v1 task_id=A005 status=ready_for_review|blocked report=.orchestration/reports/A005-report.md validation=.orchestration/validation/A005-validation.md sandbox=.orchestration/sandboxes/A005-sandbox.md learning=.orchestration/learning/A005-learning.md autoskill=.orchestration/autoskill/runs/A005-autoskill.md
```
