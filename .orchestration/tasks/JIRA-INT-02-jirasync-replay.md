# AGMSG-TASK JIRA-INT-02: jiraSync recorded-history replay テスト追加

- task_id: JIRA-INT-02
- repo: /Users/mryfmo/Workspace/ai-ops-platform
- 依頼者: claude-deep-dot（orchestrator）
- max_turns: 40

## Objective

JIRA-INT-01 のフォローアップ（learning / CompactionDB decision 6800c8cb）: `packages/control-plane/src/workflows/jiraSync.ts` に、他の coverage 除外 workflow と同水準の recorded-history replay 証跡を追加する。`planeSyncReplay.test.ts` が直接の類例。

## Background

- ブランチ: `agent/JIRA-INT-01`（d199b16 + 457b12b）から `git switch -c agent/JIRA-INT-02` を作成。push/PR は行わない（PR #280 の stack 上に積む）。
- `entry.ts` は jira workflow 5種（jiraEvent/jiraProjection/jiraPromotion/jiraSync/jiraTransition）を export 済み。
- 既存パターン: history fixture は `packages/control-plane/scripts/record-replay-history.mjs` で生成し `tests/fixtures/*.history.json` に保存、テストは `Worker.runReplayHistory({ workflowsPath: src/workflows/entry.ts }, history)` によるローカル replay（`replay.test.ts` / `planeSyncReplay.test.ts` 参照）。
- [memory:decision] jiraSync replay は planeSync replay と同じ fixture 命名（`jira-sync.<scenario>[.<child>].history.json`）と親+child 検証構成を踏襲する。

## Steps

1. `record-replay-history.mjs` に jira-sync シナリオ記録を追加（planeSync 記録部の踏襲。activity mock は jiraSyncState の契約に沿う）。
2. 最低限のシナリオ: complete（event/projection/promotion 含む親+child）、shadow、unknown-write-reconciled、promotion-stale（CAS）、promotion-not-eligible、transition の authorized/stale。planeSync fixture 一覧と同構成が目標だが、jiraSync の分岐に存在しない経路は不要・存在する固有経路（transition）は必須。
3. fixture を生成し `packages/control-plane/tests/fixtures/jira-sync.*.history.json` へ保存。
4. `packages/control-plane/tests/jiraSyncReplay.test.ts` を新規作成（根拠IDヘッダ: FinalArch:FR-CP-001 / TMP-001 / ADR-0030。describe/it に仕様ID）。親 history で orchestration、child history で activity schedule・retry・write 数を assert。
5. `packages/control-plane/vitest.config.ts` のコメント2行を更新: 「jiraSync.ts の recorded-history replay は follow-up」の記述を削除し、replay テスト列挙へ `tests/jiraSyncReplay.test.ts` を追記。exclude リスト・thresholds は変更禁止。
6. 検証 → Conventional Commit（例: `test(control-plane): add jiraSync recorded-history replay`）。
7. CompactionDB 決定記録: `python3` CLI が存在しない場合は JIRA-INT-01 REPORT 記載の手順（`compactiondb-install . --skip-instructions` → memory add → installer 生成物の revert）を再現し、コマンド全文を REPORT へ。

## 重要制約

- `src/**` の変更は一切禁止（`jiraSync.ts` 本体を含む）。replay が workflow 側の欠陥・非決定性を示した場合は修正せず `status=blocked` で報告する（PR #280 の審査済み内容を無断変更しない）。
- fixture は record script の実出力のみ。手書き・手編集の history は禁止。

## Validation（verbatim出力を validation ファイルへ貼付）

- `pnpm --filter @aiops/control-plane exec vitest run tests/jiraSyncReplay.test.ts`
- `mise run ci`
- `git log -1 --format='%H %s'` / `git status --porcelain`

## allowed_files

- packages/control-plane/scripts/record-replay-history.mjs
- packages/control-plane/tests/jiraSyncReplay.test.ts（新規）
- packages/control-plane/tests/fixtures/jira-sync.*.history.json（新規）
- packages/control-plane/vitest.config.ts（Step 5 のコメントのみ）
- .orchestration/reports/JIRA-INT-02-REPORT.md
- .orchestration/validation/JIRA-INT-02-validation.md
- .orchestration/sandboxes/JIRA-INT-02-SANDBOX.md
- .orchestration/learning/JIRA-INT-02-learning.md
- .orchestration/autoskill/runs/JIRA-INT-02.md
- .agents/worklog/codex/**

## forbidden_actions

- git push / PR作成 / 既存ブランチの変更（agent/JIRA-INT-01 への追記を含む）
- src/** の変更、依存追加、pnpm-lock.yaml・.mise.toml・mise.lock の変更
- vitest.config.ts の exclude/thresholds 変更、history fixture の手書き
- LLM API 呼び出し、外部サービス登録（Temporal test-server の既存キャッシュ利用は可）

## Expected artifacts

- report / validation / sandbox / learning / autoskill: 上記パス（cost: 行必須、[memory:decision]/[memory:failure] マーカー）
- done_signal: AGMSG-RESULT v1
