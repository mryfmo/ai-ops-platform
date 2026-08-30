# AGMSG-TASK JIRA-COMP-01: Jira deployment composition package の新設（本質対処）

- task_id: JIRA-COMP-01
- repo: /Users/mryfmo/Workspace/ai-ops-platform
- 依頼者: claude-deep-dot（orchestrator）
- max_turns: 40

## Objective

BOT-FIX-280 で導入した server の DI seam（`main({ jira: { dispatchJiraEvent, commitCompleteSnapshot } })`、未注入+JIRA_* 設定時は startup fail-closed）に対し、**注入する側**を恒久実装する。server の依存境界（control-plane 非依存）を保ったまま、両者に依存する薄い composition package を新設し、ADR-0030 の Temporal `jira-sync` 経路へ接続する。

## Branch

`git switch -c agent/JIRA-COMP-01 origin/main`。直接コミット、push禁止。

## Design constraints（orchestrator 決定事項）

1. **新規 package `packages/composition`（@aiops/composition）**: dependencies は `@aiops/server` + `@aiops/control-plane`（+必要なら `@aiops/integrations` の型）。workspace:* のみで外部依存追加禁止。`pnpm-workspace.yaml` は `packages/*` で自動包含
2. **entry**: `src/main.ts` — server の `loadConfig()` 相当の環境から Temporal 接続（`buildConnectionProfile` + `createTemporalConnection`、taskQueue は internal `jira-sync`）を構成し、以下を組み立てて server `main({ jira: {...} })` を呼ぶ実行専用エントリ:
   - `dispatchJiraEvent(event, traceId)`: `QueuedJiraWebhookEvent` から `JiraSyncRequest` を忠実に構成（issueKey/projectId/mappingVersion/revision、origin は webhook 経路の allowlist 値、operations は ADR-0030 のイベント駆動経路に一致させる）し、`buildJiraSyncWorkflowId` の workflowId で `jiraSyncWorkflow` を start（既存 workflow-id 再利用ポリシーで冪等）。**executionMode は env `JIRA_SYNC_EXECUTION_MODE`（`shadow` | `live`）で制御し、既定は `shadow`**（cutover runbook の段階移行に一致）
   - `commitCompleteSnapshot(project, snapshot)`: ADR-0030 §8（captureComplete=true のみ commit）の reconcile 経路として、snapshot 内の各 issue を同じ Temporal 経路へ投入する（revision は `deriveJiraRevision(updated, fieldHash)` 相当で導出）。既存 `jiraSync.ts` の workflow/activity 契約に忠実に。契約上どうしても曖昧な点は実装で発明せず AGMSG-QUESTION で照会
3. **fail-closed**: Temporal 接続設定（address/environment/mTLS 資格）欠落時は明確なエラーで起動拒否。server 側の既存ゲートは不変更
4. **既存コード変更は最小**: `packages/server` `packages/control-plane` の src は原則不変更。export 不足が判明した場合のみ、既存 index からの再 export 追加に限定（実装変更禁止）
5. mTLS/接続資格は control-plane の既存 `TemporalConnectionProfile` / `TemporalMtlsCredentials` パターンを踏襲し、鍵は env のファイルパス参照

## Deliverables

- packages/composition/{package.json, tsconfig.json, src/main.ts, src/lib/*.ts（純粋な request 変換は lib/ へ）}
- tests: `packages/composition/tests/*.test.ts` — Temporal client と server main を DI モックで注入し、(a) event→JiraSyncRequest 変換（revision/origin/operations/executionMode）、(b) workflowId 構成、(c) snapshot→issue 毎投入、(d) 設定欠落 fail-closed、(e) server main へ渡る seam の形、をネットワークなしで検証
- runbooks/jira-github-cutover.md へ「composition entry の起動方法・shadow→live 切替」を追記
- docs/reference/configuration.md: 新 env が server Zod schema 外なら表変更不要。composition 用 env は runbook + .env.example コメントで記録
- 根拠IDヘッダ: ADR-0030 / ADR-0005 / FinalArch:FR-CP-001

## Validation（verbatim）

- `pnpm --filter @aiops/composition run test`（または vitest run）
- `mise run ci`
- `git log -1 --format='%H %s'` / `git status --porcelain`

## allowed_files

- packages/composition/**（新規）
- packages/server/src/index.ts / packages/control-plane/src/index.ts（不足 export の再 export 追加のみ。実装変更禁止）
- runbooks/jira-github-cutover.md / .env.example
- pnpm-lock.yaml（新 workspace package の register 差分のみ。外部依存の追加・更新は禁止）
- .orchestration/{reports,validation,sandboxes,learning,autoskill/runs}/JIRA-COMP-01*
- .agents/worklog/codex/**

## forbidden_actions

- git push / PR 操作 / 他ブランチ変更
- 外部依存の追加・version 変更、.mise.toml/mise.lock 変更
- server/control-plane の実装ロジック変更、contracts/**・.github/** の変更
- 実 Temporal/Jira/GitHub への接続（テストは DI モックのみ。Temporal test-server の既存キャッシュ利用は可）
- LLM API 呼び出し

## Expected artifacts

- report / validation / sandbox / learning / autoskill: .orchestration 配下 JIRA-COMP-01*（cost: 行、[memory:decision]/[memory:failure]、CompactionDB decision コマンド全文）
- done_signal: AGMSG-RESULT v1
