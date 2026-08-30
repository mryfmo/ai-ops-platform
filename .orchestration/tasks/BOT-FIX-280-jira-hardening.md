# AGMSG-TASK BOT-FIX-280: PR #280 bot指摘4件の是正（Jira統合の実運用強化）

- task_id: BOT-FIX-280
- repo: /Users/mryfmo/Workspace/ai-ops-platform
- 依頼者: claude-deep-dot（orchestrator）
- max_turns: 40

## Objective

PR #280 への Codex bot P1 指摘4件（orchestrator裁定済み・全文は `gh api repos/mryfmo/ai-ops-platform/pulls/280/comments`）を是正し、`mise run ci` green でコミットする。

## Branch

`git switch agent/JIRA-INT-01`（現HEAD e6f360f。BOT-FIX-279 の binding fix と main #281 を統合済み）。直接コミット、push禁止。

## Fix 1（comment 3887867714: composition root に Jira 未結線）

`packages/server/src/main.ts`（+必要なら `config.ts`）で Jira 依存を **env-gated fail-closed** で結線する:

- `JIRA_ENVIRONMENT_MAPPING_PATH` + `JIRA_WEBHOOK_BEARER_SECRET` が設定されている場合のみ: mapping 読込（検証込み）+ `createBearerJiraWebhookAuthenticator` を構成し `buildApp` の `jira` deps へ渡す。未設定なら現行どおり deps 無し（route は 503 fail-closed）
- 同条件で `createEventsPollingTask` に `dispatchJiraEvent` を結線
- `JIRA_SITE_BASE_URL` + OAuth token（`JIRA_OAUTH_ACCESS_TOKEN` 等）設定時のみ `jiraSnapshotReconcileTask` を scheduler へ登録
- 既存 GitHub webhook 結線の構成パターンを踏襲。DI注入でネットワークなしのテストを追加（`packages/server/tests/`）
- 【AGMSG-QUESTION 裁定 2026-08-30】`dispatchJiraEvent` と snapshot commit の production backend は ADR-0030 の Temporal `jira-sync` 経路が正本だが、server は control-plane/Temporal 依存を持たず依存追加は禁止。よって **main() の DI seam として注入可能にし、JIRA_* env が設定されているのに backend 未注入なら startup を fail-closed**（明確なエラーで起動拒否）とするワーカー提案を承認。env 未設定時は現行どおり（503/未登録）。deployment composition が backend を注入する go-live 前提は learning と runbook に記載
- `.env.example` の JIRA_* コメントを実結線と一致させる

## Fix 2（comment 3887867716: idempotency key に revision 欠落 — 実欠陥）

`JiraSyncIdentity` が {issueKey, projectId, mappingVersion} のみのため、同一 issue の2回目以降のイベントが `findJiraSyncWrite`=written で dedupe され writer が呼ばれない。是正:

- identity/request に不変の per-event `revision` を追加し `identityKey`/workflow businessKey/idempotencyKey に含める
- revision は webhook 経路（`QueuedJiraWebhookEvent` の updated/fieldHash/payloadDigest）と snapshot reconcile 経路（JiraSnapshotIssue の updated/fieldHash）の**双方から決定的に導出可能**な値にすること（例: `updated` + fieldHash の合成）。選定理由を REPORT に記載
- businessKey 制約（500文字以内・`/`禁止）を維持
- `jiraSyncState.ts` の parser 群・`jiraEventRouter.ts`・関連テストを更新
- **replay fixture は recorder で全再生成**（手書き禁止）。`jiraSyncReplay.test.ts` の期待値も追随

## Fix 3（comment 3887867717: JQL page 完全性）

`packages/integrations/src/jira/client.ts` `captureJqlSnapshot`: 完了判定を fail-closed 化 — `body.isLast === true` の場合のみ最終ページ。有効な `nextPageToken` があれば継続。それ以外（`isLast` が false/欠落で token 無し等）は `E-JIRA-MALFORMED` で throw し、切詰め snapshot の commit を防ぐ。正負テスト追加。

## Fix 4（comment 3887867719: 本番 mapping 署名の暗号検証）

`scripts/validate-jira-environment-mapping.mjs`: production mapping の `signature` を実検証する:

- 検証方式: Ed25519（`node:crypto` の `verify`）。署名対象は signature フィールドを除いた mapping 内容の決定的 canonical JSON（キーソート）
- owner 公開鍵は env `JIRA_MAPPING_OWNER_PUBLIC_KEY`（PEM または base64-SPKI）で供給。production 検証時に鍵未設定・署名不一致は fail
- development fixture の既存ゲート（DEV-DEFAULT-unsigned + replace_before_go_live）は不変更
- 正負テスト（テスト内で一時鍵ペア生成し署名した fixture を検証）+ `runbooks/jira-github-cutover.md` へ鍵供給・署名手順の追記
- schema（`docs/contracts/schema/jira-environment-mapping.schema.json`）の変更が必要な場合は最小限

## Validation（verbatim）

- focused: 変更パッケージの `vitest run`（server / control-plane / integrations 該当テスト）+ `node --test tests/validate-jira-environment-mapping.test.mjs`
- `pnpm --filter @aiops/control-plane exec vitest run tests/jiraSyncReplay.test.ts`
- `mise run ci`
- `git log -1 --format='%H %s'` / `git status --porcelain`

## allowed_files

- packages/server/src/main.ts / packages/server/src/config.ts
- packages/server/src/index.ts（AGMSG-QUESTION 裁定 2026-08-30: 実 composition root は index.ts の main()/buildApp 呼出しと確認。Fix 1 の結線に必要な範囲のみ。export 面の削除・無関係変更は不可）
- packages/server/src/lib/jiraEventRouter.ts / src/http/routes/jiraWebhook.ts / src/scheduler/tasks/jiraSnapshotReconcileTask.ts
- packages/server/tests/**（Jira/composition 関連）
- packages/control-plane/src/lib/jiraSyncState.ts / src/workflows/jiraSync.ts
- packages/control-plane/tests/jiraSyncState.test.ts / tests/jiraSyncReplay.test.ts / tests/fixtures/jira-sync.* / scripts/record-replay-history.mjs
- packages/integrations/src/jira/client.ts / tests/jiraClient.test.ts
- scripts/validate-jira-environment-mapping.mjs / tests/validate-jira-environment-mapping.test.mjs
- docs/contracts/schema/jira-environment-mapping.schema.json / docs/contracts/fixtures/jira-environment-mapping.dev.json
- runbooks/jira-github-cutover.md / .env.example
- docs/reference/configuration.md（AGMSG-QUESTION 裁定 fix1-config-inventory: verifyTraceability.ts:318,460 が server Zod キーと server 表の一致を強制するため、新規 JIRA_* 5 変数の行追加のみ許可。既存行の変更不可。runbooks/configuration.md が同表を鏡写しする場合は同じ最小行の追加も可）
- .orchestration/{reports,validation,sandboxes,learning,autoskill/runs}/BOT-FIX-280*
- .agents/worklog/codex/**

## forbidden_actions

- git push / PR 操作 / 他ブランチ変更
- 依存追加・pnpm-lock/.mise.toml/mise.lock 変更・coverage thresholds 変更
- contracts/agent-*・.github/workflows/** の変更
- replay fixture の手書き・手編集
- LLM API 呼び出し・実 Jira/GitHub への接続

## Expected artifacts

- report / validation / sandbox / learning / autoskill: .orchestration 配下 BOT-FIX-280*（cost: 行、[memory:decision]/[memory:failure]、CompactionDB decision 追加コマンド全文）
- done_signal: AGMSG-RESULT v1
