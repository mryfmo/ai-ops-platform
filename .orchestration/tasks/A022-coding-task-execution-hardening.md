# A022: coding-task 実行経路の安全化と CLI 導入

- task_id: A022
- repo: /Users/mryfmo/Workspace/ai-ops-platform (worktree は割当時に指定)
- 発行: orchestrator-fable5 (2026-08-05)
- 担当: (割当時に記入)
- max_turns: 60
- 根拠: `docs/audit/2026-08-05-adversarial-review/03-security-governance.md` ADV-SEC-001、
  `02-integration-seams.md` ADV-INT-002、ADR-0006（AIコーディングエージェント統合）、DevOps:SPEC-INT-011

## 背景（推測で補わないこと）

`.github/workflows/coding-task.yml` には現在 2 つの実証済み欠陥がある。

1. **ADV-SEC-001（High）**: `:81-85` の `actions/checkout@v7` が `token: ${{ secrets.AIOPS_PR_TOKEN }}` を渡し `persist-credentials` を指定していない（既定 true = `.git/config` に資格情報が永続化）。その後 `:108-115` で AI エージェントを `--permission-mode acceptEdits` で実行し、`:136` の `git commit` に `--no-verify` が無い。外部由来の指示（Teams 投稿）で `.git/hooks/pre-commit` を書かせれば、commit 時に contents:write トークンを使う任意コードが走り `agent/*` 外への push が成立する。
2. **ADV-INT-002（High）**: ワークフローの全ステップ（Checkout → Setup pnpm → Setup Node.js → `pnpm install --frozen-lockfile` → Run coding agent → …）に **claude / droid CLI をインストールするステップが無い**。`.github/actions/run-coding-agent/action.yml:37` は `claude -p ...`、`:50` は `droid exec ...` を直接呼ぶため、初回実行は必ず `command not found` で失敗する。

## 前提手順

1. `origin/main` から新ブランチ `agent/a022-coding-task-hardening` を作成。
2. 上記 2 ファイルと `docs/adr/0006-*.md` を全文読了してから編集に入る。
3. `.github/actions/run-coding-agent/action.yml:23-26, 39-41` の「実運用時要検証」コメントが何を未確定としているかを確認する。

## 実装要件

### 1. 資格情報の残留を断つ（ADV-SEC-001）

- `actions/checkout` に `persist-credentials: false` を指定する。
- push が必要なステップでのみ認証を与える（例: `git push https://x-access-token:${TOKEN}@github.com/...` の形、またはそのステップに限定した extraheader 設定）。トークンを再び `.git/config` へ永続化しないこと。
- エージェント実行ステップの**前**に `git config core.hooksPath /dev/null` 相当の無効化を行う。
- `git commit` に `--no-verify` を付ける。

### 2. CLI を導入して実行可能にする（ADV-INT-002）

- `agent` 入力値ごとに CLI を導入するステップを追加する。導入方法（公式 action / npm / インストールスクリプト）と**バージョン固定の方針**を report に明記すること。本リポジトリは `actions/checkout` 等を commit SHA でピン留めする方針なので、これに倣う。
- 認証に必要な secret 名を確定し、未設定時は `coding-task.yml:70-78` の `AIOPS_PR_TOKEN` と同様に **fail-fast** させる（silent 失敗にしない）。
- `action.yml:23-26, 39-41` の「実運用時要検証」コメントは、確定した内容に置き換えるか、未確定のまま残す場合は**何が未確定かを具体的に**書き直す。

### 3. 実行実績の自己申告を更新する

- `coding-task.yml:25-26` の「この開発環境では実行できない（構文的な妥当性のみ確認済み）」は、本タスクで検証できた範囲に合わせて記述を改める。**検証していないことを検証済みと書かない**。

## 判断が必要になったら

CLI の導入方法・認証方式・バージョン固定方針は本タスクの裁量範囲。ただし次に該当したら**推測せず `status=blocked` で報告**すること。

- ADR-0006 の決定（agent パラメータでの切替、`agent/*` ブランチ限定、自動マージ禁止）と矛盾する構成しか取れない場合
- 新しい GitHub secret の追加が必要で、その値をオーナーしか用意できない場合
- branch protection の有無に依存して安全性の結論が変わる場合（オーナー裁定 D-06 が未了）

## 品質要件

- `MISE_LOCKED=1 mise run ci` green。
- `mise run actionlint`（`.mise.toml:6-8` に定義済み）を実行し、出力を validation に貼ること。
- crit CLI で自己レビュー（resolved まで）。
- push → PR（base=main、`ai-generated` ラベル）→ checks green → AGMSG-RESULT。merge は受入後。

## 完了条件

- [ ] `grep -n "persist-credentials" .github/workflows/coding-task.yml` がヒットし、値が `false`
- [ ] `grep -n "no-verify" .github/workflows/coding-task.yml` がヒット
- [ ] エージェント実行前に hooks を無効化するステップが存在する
- [ ] `agent=claude-code` / `agent=droid` の双方について CLI 導入ステップが存在し、バージョンが固定されている
- [ ] CLI 認証 secret 未設定時に fail-fast する
- [ ] `mise run actionlint` exit 0
- [ ] `MISE_LOCKED=1 mise run ci` exit 0

## forbidden_actions

- `allowed_files` 以外の編集（下記 2 ファイルのみ）
- 依存追加、`pnpm-lock.yaml` の変更
- 実際の `workflow_dispatch` 実行、実 PR 作成以外の GitHub API 書き込み
- 秘密値の生成・コミット、`.env` 系ファイルの追加
- merge-before-acceptance、`docs/audit/` 配下の編集、ユーザーへのレビュー依頼

## allowed_files

```
.github/workflows/coding-task.yml
.github/actions/run-coding-agent/action.yml
```

## 完了報告

```
AGMSG-RESULT v1 task_id=A022 status=ready_for_review|blocked report=.orchestration/reports/A022-report.md validation=.orchestration/validation/A022-validation.md sandbox=.orchestration/sandboxes/A022-sandbox.md learning=.orchestration/learning/A022-learning.md autoskill=.orchestration/autoskill/runs/A022-autoskill.md
```
