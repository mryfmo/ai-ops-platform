# AGMSG-TASK JIRA-COMP-02: PR #285 P1 是正（composition entry の配布形+telemetry bootstrap）

- task_id: JIRA-COMP-02
- repo: /Users/mryfmo/Workspace/ai-ops-platform
- 依頼者: claude-deep-dot（orchestrator）
- max_turns: 40

## Objective

PR #285 の bot P1 指摘2件（orchestrator裁定済み・妥当）を是正する。方針は「**@aiops/composition を server コンテナの唯一の production entry にする**」で両指摘を一貫解決する: JIRA_* 未設定時は jira seam 無しで従来挙動（server 側既存ゲート）のまま、設定時のみ Temporal 結線が有効になるため、entry を分岐させる必要がない。

## Branch

`git fetch origin agent/JIRA-COMP-01 && git switch agent/JIRA-COMP-01`（origin追従、現 head 979d4e5）。直接コミット、push禁止。

## Fix 1（comment 3888603342: telemetry bootstrap の移植）

`packages/composition/src/main.ts` を `packages/server/src/main.ts:16-29` と同じ順序へ:
1. `loadConfig()` → `createLogger()` → `startTelemetry()` を**instrumented module の import 前**に実行（server の該当関数を re-export 経由で利用。不足 export は index からの再 export 追加のみ可）
2. その後に composition 結線モジュールと server index を **dynamic import** し、`serverMain({ config, logger, telemetry, jira })` へ handle を渡す
3. 順序（telemetry 開始が server import より先であること）を検証する networkless テストを追加（module モック/DI）

## Fix 2（comment 3888603338: server image への同梱）

- `packages/server/Dockerfile`: `@aiops/composition`（と推移 workspace 依存 control-plane / @temporalio ランタイム依存）を build・copy し、既存のイメージ構成パターン（pnpm workspace の deploy/prune 方式）に揃える
- `packages/server/scripts/start-container.mjs`: 起動対象を composition の `dist/main.js` へ変更
- 既存のコンテナ起動テスト/検証スクリプトがあれば追随。Docker build 実行は不可環境なら、Dockerfile の COPY/RUN 対象と pnpm filter の静的検証（例: 対象 package の列挙チェック）を validation に含め、実 build 不能の旨を sandbox record に記載
- `runbooks/jira-github-cutover.md` の該当節を「イメージ同梱済み entry」前提へ更新

## Validation（verbatim）

- `pnpm --filter @aiops/composition run test`
- `mise run ci`
- Dockerfile/start-container の変更内容 diff 全文と、可能なら docker build（不能なら理由と静的検証）
- `git log -1 --format='%H %s'` / `git status --porcelain`

## allowed_files

- packages/composition/**（src/tests/package.json/tsconfig）
- packages/server/src/index.ts（再 export 追加のみ。実装変更禁止）
- packages/server/src/bootstrap.ts（新規・AGMSG-QUESTION 裁定: loadConfig/createLogger/startTelemetry の**再 export のみ**を含む軽量 bootstrap モジュール。instrumented module を import しないこと）
- packages/server/package.json（同裁定: `exports` に `./bootstrap` subpath を追加。既存の `.` 解決（main/types）を**完全に維持**する形で exports map を構成し、既存 import が壊れないことを ci で確認。依存・script の変更は不可）
- packages/server/Dockerfile / packages/server/scripts/start-container.mjs（+同 scripts の関連テストがあれば）
- runbooks/jira-github-cutover.md
- .orchestration/{reports,validation,sandboxes,learning,autoskill/runs}/JIRA-COMP-02*
- .agents/worklog/codex/**

## forbidden_actions

- git push / PR 操作 / 他ブランチ変更
- 外部依存の追加・version 変更、lock の外部差分、.mise.toml/mise.lock 変更
- server/control-plane の実装ロジック変更、contracts/**・.github/** の変更
- 実 Temporal/Jira/GitHub 接続・イメージの registry push
- LLM API 呼び出し

## Expected artifacts

- report / validation / sandbox / learning / autoskill: .orchestration 配下 JIRA-COMP-02*（cost: 行、[memory:decision]/[memory:failure]、CompactionDB decision コマンド全文）
- done_signal: AGMSG-RESULT v1

## 注意

GOV-PR-02 完了後に着手（inbox 順）。
