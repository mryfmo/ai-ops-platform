# AGMSG-TASK JIRA-INT-01: Jira × GitHub governed integration の取り込み

- task_id: JIRA-INT-01
- repo: /Users/mryfmo/Workspace/ai-ops-platform
- 依頼者: claude-deep-dot（orchestrator）
- max_turns: 40

## Objective

`references/ai-ops-platform-jira-fixed.zip` に含まれる Jira × GitHub governed integration パッチ（追加17 / 修正19 / 削除0）を、現行ブランチ系列（ADV-FIX-04 manifest authority を含む）へ取り込み、`mise run ci` green の状態でブランチ `agent/JIRA-INT-01` にコミットする。

## Background（検証済み事実）

[memory:decision] references/ai-ops-platform-jira-fixed.zip はコミット c8704c5 + Jiraパッチ（追加17/修正19/削除0）であり、ADV-FIX-04 (9f7c1af) を含まない。取り込みは agent/ADV-FIX-04 を親ブランチとし、両者の重複は packages/devops/src/db/schema.sql のみ。

- 完全な差分分解レポート（必読）: `.agents/worklog/claude/references-ai-ops-platform-jira-fixed-z-pure-zebra.md`
- zip の修正19ファイルのうち schema.sql 以外の18ファイルは、現行ブランチでは c8704c5 から未変更であることを検証済み → **zip版をそのままコピーしてよい**。
- schema.sql のみ手マージ: 現行版（coding_tasks の manifest 列 + trigger を含む）を正とし、zip 側の変更 `events.source` CHECK への `'jira'` 追加**だけ**を反映する。

## Steps

1. `git switch agent/ADV-FIX-04` を確認のうえ `git switch -c agent/JIRA-INT-01` を作成（親=agent/ADV-FIX-04, 9f7c1af）。
2. `mktemp -d` した一時ディレクトリ（リポジトリ外）へ `unzip references/ai-ops-platform-jira-fixed.zip` を展開。内容ルートは `ai-ops-platform-jira-20260828/`。
3. 追加17ファイルを zip からリポジトリの同一相対パスへコピー（**`MODIFICATION_VERIFICATION.md` はコピー禁止**。パック用メタでリポジトリ成果物ではない）:
   - docs/adr/0030-jira-github-governed-integration.md
   - docs/contracts/schema/jira-environment-mapping.schema.json
   - docs/contracts/fixtures/jira-environment-mapping.dev.json
   - packages/control-plane/src/lib/jiraSyncState.ts
   - packages/control-plane/src/workflows/jiraSync.ts
   - packages/control-plane/tests/jiraSyncState.test.ts
   - packages/devops/src/db/migrations/202608280001_jira_event_source.sql
   - packages/integrations/src/jira/client.ts
   - packages/integrations/tests/jiraClient.test.ts
   - packages/server/src/http/routes/jiraWebhook.ts
   - packages/server/src/lib/jiraEventRouter.ts
   - packages/server/src/scheduler/tasks/jiraSnapshotReconcileTask.ts
   - packages/server/tests/jiraWebhook.test.ts
   - packages/server/tests/jiraSnapshotReconcileTask.test.ts
   - runbooks/jira-github-cutover.md
   - scripts/validate-jira-environment-mapping.mjs
   - tests/validate-jira-environment-mapping.test.mjs
   （17ファイル。上記リストの通り）
4. 修正対象のうち以下18ファイルは zip 版で**そのまま上書き**（現行ブランチで c8704c5 から未変更のため安全。上書き後 `git diff` で意図どおりのJira差分のみか確認すること）:
   - .env.example / README.md / docs/README.md / package.json
   - packages/control-plane/src/index.ts
   - packages/control-plane/src/lib/temporalProfile.ts
   - packages/control-plane/src/workflows/entry.ts
   - packages/control-plane/tests/temporalProfile.test.ts
   - packages/integrations/src/adapters/index.ts
   - packages/integrations/src/adapters/types.ts
   - packages/integrations/src/index.ts
   - packages/integrations/src/lib/operationBoundary.ts
   - packages/integrations/tests/operationBoundary.test.ts
   - packages/server/src/db/eventsRepo.ts
   - packages/server/src/http/app.ts
   - packages/server/src/index.ts
   - packages/server/src/scheduler/tasks/eventsPollingTask.ts
   - packages/server/tests/eventsPollingTask.test.ts
5. `packages/devops/src/db/schema.sql` は上書き禁止・手マージ: 現行ファイルの `events.source` CHECK を `('github', 'jira', 'monitor', 'inbound')` へ変更するのみ。coding_tasks の manifest/manifest_sha256 列と `coding_tasks_block_manifest_mutation` trigger は**維持**。
6. 既存 tracked ファイルの削除は一切禁止（zip は削除0。`.orchestration/validation/P0-T02-probes.log` は zip に無いが削除しない）。
7. 検証（下記 Validation）→ Conventional Commit でコミット（例: `feat(jira): import Jira x GitHub governed integration pack`）。push/PR作成はしない。
8. CompactionDB へ決定を記録: `python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project` を実行し、実行コマンド全文を REPORT に記載。

## Validation（verbatim出力を validation ファイルへ貼付）

- `mise run ci`（Definition of Done。全出力貼付）
- `pnpm run jira-mapping:validate`
- `pnpm run governance:check`
- `git log -1 --format='%H %s'`（コミットハッシュを validation に含める）
- `git status --porcelain`（allowed外の変更・消し忘れがないこと）

## allowed_files

- Steps 3–5 に列挙した全ファイル（追加17 + 上書き18 + schema.sql）
- packages/control-plane/vitest.config.ts（AGMSG-QUESTION 裁定 2026-08-30: coverage.exclude へ `src/workflows/jiraSync.ts` を1行追加するのみ。既存 workflow 除外パターンと整合。隣接コメントの整合修正は可。thresholds の変更は不可。なお jiraSync には他 workflow のような recorded-history replay テストが無い点を REPORT の learning に記載すること）
- .orchestration/reports/JIRA-INT-01-REPORT.md
- .orchestration/validation/JIRA-INT-01-validation.md
- .orchestration/sandboxes/JIRA-INT-01-SANDBOX.md
- .orchestration/learning/JIRA-INT-01-learning.md
- .orchestration/autoskill/runs/JIRA-INT-01.md
- .agents/worklog/codex/**（plan/todo/learn）

## forbidden_actions

- git push / PR作成 / main への操作 / ブランチ削除
- 新規 npm 依存の追加、pnpm-lock.yaml・.mise.toml・mise.lock の変更
- .github/workflows/**、contracts/**、scripts/collect-agent-review.mjs、packages/server/src/lib/codingTaskManifest.ts の変更（ADV-FIX-04 領域。zip側にこれらの変更は存在しない）
- tracked ファイルの削除、MODIFICATION_VERIFICATION.md の追加
- LLM API 呼び出し、外部サービス登録

## Expected artifacts

- report: .orchestration/reports/JIRA-INT-01-REPORT.md（cost: 行必須。[memory:decision]/[memory:failure] マーカーで恒久事実を記載）
- validation: .orchestration/validation/JIRA-INT-01-validation.md
- sandbox: .orchestration/sandboxes/JIRA-INT-01-SANDBOX.md
- learning: .orchestration/learning/JIRA-INT-01-learning.md
- autoskill: .orchestration/autoskill/runs/JIRA-INT-01.md
- done_signal: AGMSG-RESULT v1
