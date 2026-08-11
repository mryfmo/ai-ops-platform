# A027: coding-task 台帳の原子性と回収

- task_id: A027
- repo: /Users/mryfmo/Workspace/ai-ops-platform (worktree は割当時に指定)
- 発行: orchestrator-fable5 (2026-08-05)
- 担当: (割当時に記入)
- max_turns: 50
- 根拠: `docs/audit/2026-08-05-adversarial-review/02-integration-seams.md` ADV-INT-004 / 005 / 012、
  ADR-0006、DevOps:SPEC-INT-011

## 背景（推測で補わないこと）

コーディングタスク台帳に 3 つの欠陥がある。いずれも実測済み。

1. **ADV-INT-004（Medium）TOCTOU による二重ディスパッチ**
   `packages/server/src/http/routes/codingTasks.ts:134-147` の status チェック、`:169` の `dispatchWorkflow`、`:184` の `markConfirmedAndDispatched` が非原子。`packages/server/src/db/codingTasksRepo.ts:115-121` は **WHERE に status 条件が無い無条件 UPDATE**。同一トークンで confirm POST を並行 2 本送ると双方が dispatch し得る。`.github/workflows/coding-task.yml:68` の `concurrency: coding-task-${{ inputs.task_id }}` はキャンセルせずキューするため 2 回実行され、2 本目は同名ブランチ push で衝突する。
   - 対照（既に正しい実装）: 同ファイル `:131-135` の callback 側は `WHERE status='running'` を持つ。**confirm 側だけが緩い**。

2. **ADV-INT-005（Medium）callback 喪失で台帳が running のまま滞留**
   `coding-task.yml:183, 200, 216` の 3 つの callback は `curl -sS` で `-f/--fail` もリトライも無く、サーバが 409/500 を返しても exit 0 でジョブは成功扱い。逆にサーバ到達不能なら成功側 callback が fail し、続く failure callback も同じ理由で fail する。いずれの場合も `coding_tasks` は running のまま残る。`packages/server/src/scheduler/tasks/` に回収タスクは無く、`workflow_run` webhook もスタブ（ADV-WIR-001）なので台帳を更新しない。

3. **ADV-INT-012（Low）confirm トークンに期限が無い**
   `packages/server/src/lib/confirmToken.ts:17-19` は HMAC(taskId) のみで期限も nonce も無い。queued 放置のタスクの確認リンクは永久に有効。

## 前提手順

1. `origin/main` から新ブランチ `agent/a027-coding-task-ledger` を作成。
2. `codingTasks.ts`、`codingTasksRepo.ts`、`confirmToken.ts`、`packages/server/src/scheduler/scheduler.ts` と既存タスク 1 本（例: `jitRevocationTask.ts`）を読了し、スケジューラタスクの登録様式を把握する。
3. `.github/workflows/coding-task.yml` は**読むだけ**（編集は A022 の担当。衝突禁止）。

## 実装要件

### 1. confirm の原子的 claim 化（ADV-INT-004）

- `dispatchWorkflow` の**前**に、条件付き UPDATE で claim する:
  `UPDATE coding_tasks SET status='running', ... WHERE task_id=$1 AND status='queued' RETURNING ...`
- 更新行数 0 なら dispatch せず、既に処理済みである旨を返す（HTTP ステータスと本文は既存の慣例に合わせる）。
- dispatch 自体が失敗した場合の台帳状態をどうするか（queued へ戻す / failed にする）を決め、**理由を report に明記**する。

### 2. 滞留タスクの回収（ADV-INT-005）

- running のまま一定時間を超えたタスクを検出し、監査ログを残したうえで終端状態へ遷移させる scheduler タスクを追加する。
- **タイムアウト値は設定可能にし、既定値の根拠を report に書くこと**（GitHub Actions ジョブの最大実行時間を上回る値であるべき）。
- 既存タスクと同じ様式で登録する（`guardFailsafeTask` / `instrumentScheduledTask` の適用有無を既存に倣う）。
- 回収時の監査 action 名と `basis` を既存の慣例に合わせる。

### 3. confirm トークンの有効期限（ADV-INT-012）

- トークンに発行時刻を含め、検証時に期限を確認する。期限値は設定可能にする。
- **既存の署名検証は timingSafeEqual を使っている（`confirmToken.ts:51-57`）。この性質を壊さないこと。**
- 期限切れトークンは拒否し、利用者に再依頼を促すメッセージを返す。

## テスト

- 並行 confirm 2 本で dispatch が 1 回しか起きないこと（claim の更新行数で検証）。
- claim 失敗時に dispatch が呼ばれないこと。
- 回収タスク: 期限内の running は触らない / 期限超過の running のみ遷移する / 監査ログが残る。
- トークン: 期限内は通る / 期限切れは拒否される / 署名不正は従来どおり拒否される。
- describe/it タイトルに検証対象の仕様 ID を含める（AGENTS.md テスト規約）。

## 判断が必要になったら

タイムアウト既定値、dispatch 失敗時の台帳状態、HTTP レスポンス形は本タスクの裁量。ただし次は**推測せず `status=blocked`**。

- confirm 鍵と callback 鍵の分離（ADV-SEC-002 / ADV-INT-003）に踏み込む必要が生じた場合 → **第 2 波 S-1 の担当範囲**。`config.ts` / `index.ts` には触らないこと。
- `coding-task.yml` 側の callback に `--fail` やリトライを足したくなった場合 → **A022 の担当範囲**。本タスクはサーバ側の回収で対処する。
- 新しい DB 列が必要になった場合（schema.sql 変更は AGENTS.md の手順に従う必要があり、migration 新規作成を伴う。可能なら既存列で完結させ、不可能なら blocked で相談）

## 品質要件

- 根拠 ID ヘッダの規約を維持。
- 使い捨て PostgreSQL（Homebrew postgresql@16 / port 55432 / DB 名に `p001` または `test` を含む / 完全破棄）での実測を行い、validation に記録する。
- `MISE_LOCKED=1 mise run ci` green。
- crit CLI で自己レビュー（resolved まで）。
- push → PR（base=main、`ai-generated` ラベル）→ checks green → AGMSG-RESULT。merge は受入後。

## 完了条件

- [ ] confirm が条件付き UPDATE で claim してから dispatch する
- [ ] `codingTasksRepo` の該当 UPDATE に status 条件がある
- [ ] running 滞留を回収する scheduler タスクが登録され、タイムアウトが設定可能
- [ ] confirm トークンに期限があり、timingSafeEqual 検証が保たれている
- [ ] 上記 4 点それぞれにテストがあり、仕様 ID がタイトルに含まれる
- [ ] `MISE_LOCKED=1 mise run ci` exit 0

## forbidden_actions

- `allowed_files` 以外の編集
- `.github/workflows/coding-task.yml` の編集（A022 の担当）
- `packages/server/src/index.ts` / `config.ts` の編集（第 2 波 S-1 の担当）
- `packages/server/src/agents/teamsConversationAgent.ts` の編集（A026 の担当）
- 本番 DB 接続、55432 以外での常設 listen、一時 DB の残置
- 実 GitHub API 呼び出し（`dispatchWorkflow` は必ずテストダブルで）
- merge-before-acceptance、`docs/audit/` 配下の編集、ユーザーへのレビュー依頼

## allowed_files

```
packages/server/src/http/routes/codingTasks.ts
packages/server/src/db/codingTasksRepo.ts
packages/server/src/lib/confirmToken.ts
packages/server/src/scheduler/tasks/<新規回収タスク>.ts
packages/server/tests/codingTaskRoutes.test.ts
packages/server/tests/codingTasksRepo.test.ts
packages/server/tests/confirmToken.test.ts
```

**注**: テストファイルは上記の実名のみ。他タスクと並列実行されるため、ワイルドカードで確保しないこと。新規回収タスクのテストは `packages/server/tests/a027-<taskname>.test.ts` として新規作成し、report に列挙する。`schedulerTasks.test.ts` は既存タスク一覧を検証している可能性があるため、変更が必要になったら `status=blocked` で報告すること（composition root への登録は第 2 波 S-2 の担当）。

**注**: 新規 scheduler タスクの登録には通常 `index.ts` の編集が必要だが、本タスクでは `index.ts` を触れない（第 2 波と衝突するため）。タスク関数と単体テストまでを本タスクの範囲とし、**composition root への登録は第 2 波 S-2 に引き継ぐ**。report にその旨を明記し、登録に必要な情報（エクスポート名・引数・推奨間隔）を残すこと。

## 完了報告

```
AGMSG-RESULT v1 task_id=A027 status=ready_for_review|blocked report=.orchestration/reports/A027-report.md validation=.orchestration/validation/A027-validation.md sandbox=.orchestration/sandboxes/A027-sandbox.md learning=.orchestration/learning/A027-learning.md autoskill=.orchestration/autoskill/runs/A027-autoskill.md
```
