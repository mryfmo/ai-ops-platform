# ADV-FIX-01: 敵対的レビュー指摘の確実系ホットフィックス(5件)

- 発注: claude-deep-dot(オーケストレータ)
- 根拠: `.orchestration/audit/2026-08-18-adversarial-full-review.md`(C-2 / H-1 / M-1 / M-2 / M-3)。着手前に該当節を必ず読むこと。
- ブランチ: `agent/ADV-FIX-01` を `origin/main` から作成。PR は base=main、Conventional Commit、`ai-generated` ラベル、**draft 禁止**、PRテンプレートのチェックリストを埋める。自動マージ禁止。

## Objective

本番到達時に確実に故障・流出する小規模欠陥5件を修正し、各修正に「壊れたら落ちるテスト」を追加する。設計変更・リファクタは行わない(最小差分)。

## 修正項目

### 1. C-2: WebUI プロキシの圧縮レスポンス破壊
- `packages/server/src/http/routes/webuiProxy.ts:73-75` — undici fetch は body を伸長済みで返すが、`content-encoding` / `content-length` ヘッダを元値のまま転送しているため、圧縮上流で全レスポンスが壊れる。
- 修正: 転送レスポンスヘッダから `content-encoding` / `content-length` / `transfer-encoding` を除去。
- テスト: 上流が `content-encoding: gzip` + 伸長済み body を返すケースで、クライアント応答に当該ヘッダが無く body が完全一致することを assert。

### 2. H-1: `agent_handoffs` の UPDATE grant 欠落
- `packages/devops/src/db/provision_database_roles.sql` の mutable_table 一覧に `agent_handoffs` が無く、`agentHandoffsRepo.transition` の UPDATE が本番提供 DB で permission denied になる。
- 修正: 一覧に `agent_handoffs` を追加。
- テスト: 既存の provision/監査系テストの検証方式に合わせ、UPDATE を発行する全テーブルが grant 一覧に含まれることを機械照合するテストを追加(可能なら「repo 層の `UPDATE <table>` 文字列抽出 ⇔ SQL 内一覧」の突合)。

### 3. M-1: secretSanitizer パターン網羅漏れ
- `packages/shared/src/secretSanitizer.ts` の `SECRET_PATTERNS` に追加(既存パターンの命名・構造・置換書式 `***REDACTED:<name>***` に厳密に合わせる):
  - GitHub fine-grained PAT: `github_pat_[A-Za-z0-9_]{22,}`
  - Slack: `xox[baprs]-[A-Za-z0-9-]{10,}`
  - URL 埋込資格情報(接続文字列): `[a-z][a-z0-9+.-]*:\/\/[^\/\s:@]+:[^\/\s@]+@`
  - OpenAI 系: `sk-[A-Za-z0-9_-]{20,}`
  - GCP: `AIza[0-9A-Za-z_-]{35}`
  - Azure SAS: `(\?|&)sig=[A-Za-z0-9%+/=]{16,}`
- 注意: 誤検知で正当な本文を壊さないか、既存テスト全通過+新規境界テスト(各パターンの検知/非検知例)で確認。特に URL 資格情報パターンが通常の `https://example.com/path` を誤爆しないこと。
- テスト: `packages/shared/tests/` に各パターンの redact/非 redact ケースを追加。

### 4. M-2: 署名失敗監査の E-AUD02 起因喪失(監査回避)
- `packages/server/src/http/routes/githubWebhook.ts:36-44` の `x-github-event` 由来文字列、`packages/server/src/http/routes/graphNotifications.ts:112-121` の `subscriptionId` 群、`packages/server/src/scheduler/tasks/eventsPollingTask.ts`(監査 append 周辺)の `err.message` を、監査 `append` の detail に入れる前に `sanitizeSecrets()` を通す(`packages/server/src/http/routes/codingTasks.ts:230` の既存方式に合わせる)。
- テスト: 秘密様文字列(例 `apikey=aaaaaaaaaaaaaaaaaa`)をヘッダ/ID/エラーメッセージに含めても監査レコードが書かれ、値が redact 済みであることを assert。

### 5. M-3: AGT-INC Sev1 Teams カードの fail-closed 非対称
- `packages/devops/src/agents/AGT_INC.ts:122` — カード本文の `classification.rationale` を、同ファイルの Issue 経路が使う `redactedOrFallback` 適用済みの値(safeRationale 相当)に差し替える。
- テスト: Sev1 カード経路で、サニタイズ後も秘密が残留する rationale がカード本文に到達しない(fallback 文言になる)ことを assert。

## Allowed files

- packages/server/src/http/routes/webuiProxy.ts
- packages/server/src/http/routes/githubWebhook.ts
- packages/server/src/http/routes/graphNotifications.ts
- packages/server/src/scheduler/tasks/eventsPollingTask.ts
- packages/server/tests/**
- packages/devops/src/db/provision_database_roles.sql
- packages/devops/src/agents/AGT_INC.ts
- packages/devops/tests/**
- packages/shared/src/secretSanitizer.ts
- packages/shared/tests/**
- .orchestration/reports/ADV-FIX-01-REPORT.md ほか本タスクの expected artifacts
- .agents/worklog/codex/**

## Forbidden actions

- 依存追加・更新; schema.sql / migrations の変更; 上記以外のファイル編集; 仕様・ゲート・権限モデルの変更; draft PR 作成; merge / 自動マージ; force push; LLM 実呼び出しを伴うテスト。

## Validation(結果を validation ファイルに全文記録、exit code 明記、パイプで exit code を潰さない)

1. `pnpm --filter @aiops/shared run test`
2. `pnpm --filter @aiops/devops run test`(パッケージ名は package.json で確認)
3. `pnpm --filter <server pkg> run test`
4. `mise run lint` / `mise run typecheck` / `mise run traceability` / `mise run format`
5. 新規ファイルには根拠IDヘッダ(該当 REQ/SPEC/ADR。レビュー報告書の各所見が引く ID を使用)

## Expected artifacts

- report: .orchestration/reports/ADV-FIX-01-REPORT.md(PR URL、変更概要、cost: 行、[memory:decision] マーカーで恒久事実を記録)
- validation: .orchestration/validation/ADV-FIX-01-validation.md
- sandbox: .orchestration/sandboxes/ADV-FIX-01-SANDBOX.md
- learning: .orchestration/learning/ADV-FIX-01-learning.md
- autoskill: .orchestration/autoskill/runs/ADV-FIX-01.md
- CompactionDB: 完了前に `python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project` で採用判断を記録し、実行コマンドを report に併記。

## Done

`AGMSG-RESULT v1 task_id=ADV-FIX-01 status=ready_for_review ...` を全 artifact パス付きで送信。max_turns=40。
