# A024: 検証ゲートの実効化（実 DB テスト・カバレッジ閾値・壊れた入口）

- task_id: A024
- repo: /Users/mryfmo/Workspace/ai-ops-platform (worktree は割当時に指定)
- 発行: orchestrator-fable5 (2026-08-05)
- 担当: (割当時に記入)
- max_turns: 60
- 根拠: `docs/audit/2026-08-05-adversarial-review/04-verification-infra.md` ADV-VER-007 / 009 / 010 / 011、
  `06-dynamic-verification-log.md` D1・D5、DOC-05 §11

## 背景（推測で補わないこと）

2026-08-05 時点で `mise run ci` は green（exit 0、1,764+ テスト合格）。しかしその green には 4 つの空洞がある。

1. **ADV-VER-009（Medium）**: skip されている 7 件はすべて実 PostgreSQL 経路。ゲート env は実測済みで
   - `packages/devops/tests/reportSnapshotsSchema.test.ts:16-17`、`recipientsStableSubjectSchema.test.ts:30-31`、`recipientBackfill.test.ts:383-384` → `AIOPS_TEST_DATABASE_NAME`（+ `AIOPS_TEST_DATABASE_HOST` 既定 `127.0.0.1`、`AIOPS_TEST_DATABASE_PORT` 既定 `55432`）
   - `packages/web/tests/dataApiPoolRealPgLoad.test.ts:11-12,66` → `AIOPS_LOAD_TEST_DATABASE_URL` + `AIOPS_LOAD_TEST_CONFIRM_DATABASE`
   `.github/workflows/ci.yml` に Postgres service も env 設定も無いため、**CI で一度も実行されず skip のまま green に合算される**。スキーマ・migration・backfill・接続数上限という回帰が最も痛い層が対象。
2. **ADV-VER-010（Medium）**: `verification/run_db_integration.sh` はどの workflow / mise task からも呼ばれていない。**2026-08-05 のレビューで初めて実行し PASS することを確認済み**（実 PostgreSQL 16 で追記専用の UPDATE/DELETE 拒否、パーティション隔離、migration 冪等性を検証）。また `package.json:22` の `"verify:all": "bash verification/run_verification.sh"` が指すスクリプトは**存在しない**。
3. **ADV-VER-007（High）**: どの `vitest.config.ts` にも `thresholds` が無く、カバレッジが低下しても CI は fail しない。`packages/web/vitest.config.ts` は coverage 設定自体が無く `coverage-summary.json` を出力しない。
4. **ADV-VER-011（Low）**: `mise run actionlint` は `.mise.toml:6-8` に定義済みだが、`ci.yml` にも `mise run ci` にも組み込まれていない。また `pnpm audit --prod --audit-level high` は GH CI のみで `mise run ci` に無く、「ローカル DoD = CI」が成立していない。

## 前提手順

1. `origin/main` から新ブランチ `agent/a024-verification-gate` を作成。
2. `.github/workflows/ci.yml`、`.mise.toml`、各 `packages/*/vitest.config.ts`、`verification/run_db_integration.sh` を全文読了。
3. 上記の skip テスト 4 ファイルを読み、必要な DB 状態（schema 適用の要否、DB 名の制約）を確認する。

## 実装要件

### 1. CI に PostgreSQL を用意し、実 DB テストを実行させる（ADV-VER-009）

- `ci.yml` の `build-test` ジョブに PostgreSQL 16 の service コンテナを追加する（バージョンは `verification/postgres.compose.yml` に合わせる）。
- 上記の env（`AIOPS_TEST_DATABASE_NAME` 等）を設定し、現在 skip されている 7 件が**実際に実行される**ようにする。
- DB 名は `verification/run_db_integration.sh:19-23` の安全ゲート（`p001` または `test` を含むこと）と整合させる。
- テストが schema 適用済み DB を要求する場合は、適用ステップを CI に追加する（`packages/devops/src/db/schema.sql` + `migrations/`）。**2026-08-05 に全適用が成功することは確認済み**。

### 2. `run_db_integration.sh` を CI に接続する（ADV-VER-010）

- 同ジョブ（または専用ジョブ）から `P001_ALLOW_DISPOSABLE_DB=1 TEST_DATABASE_URL=... verification/run_db_integration.sh` を実行する。
- **既知の前提**: このスクリプトは内部で `pnpm --filter @aiops/devops db:migrate` を呼ぶ（`:174`）ため、pnpm が PATH にある環境で実行すること。素の bash で実行すると `pnpm: command not found` で落ちる。
- スクリプト本体の書き換えは行わない（呼び出しを足すだけ）。

### 3. 壊れた入口の修復（ADV-VER-010）

- `package.json` の `verify:all` を、実在するスクリプトを指すように修正するか、エントリ自体を削除する。**どちらにするかを report で理由付きで述べること**（存在しない入口を残さないことが目的）。

### 4. カバレッジ閾値の導入（ADV-VER-007）

- 各パッケージの `vitest.config.ts` に `coverage.thresholds` を設定する。
- **閾値は「現状値をわずかに下回る水準」に設定する**（回帰検知が目的であり、本タスクでカバレッジを上げることは目的ではない）。設定した数値と、その根拠となった現状の実測値を report に対応表で示すこと。
- `packages/web/vitest.config.ts` には coverage 設定と `json-summary` reporter を追加し、他パッケージと比較可能にする。

### 5. ローカル DoD と CI の一致（ADV-VER-011）

- `mise run ci` に `actionlint` と `pnpm audit --prod --audit-level high` を追加し、`ci.yml` と同じ検証内容にする。
- 追加により既存の green が壊れる場合は、**壊れた事実を report に記載**し、修正が本タスクの範囲外なら `status=blocked` で報告する（勝手に検証を緩めない）。

## 判断が必要になったら

閾値の具体的数値、service コンテナの構成、`verify:all` の去就は本タスクの裁量。ただし次は**推測せず `status=blocked`**。

- `actionlint` または `pnpm audit` を CI に足すと既存 main が fail し、その修正が `allowed_files` の外に及ぶ場合
- 実 DB テストを有効化した結果テストが fail し、原因が本番コードの欠陥である場合（**テストを skip に戻して隠さないこと**。fail を報告する）

## 品質要件

- `MISE_LOCKED=1 mise run ci` green（本タスクで追加した検証を含めて）。
- CI の変更は PR 上で実際に green になることを確認する。**ローカルだけの確認で完了としない**。
- crit CLI で自己レビュー（resolved まで）。
- push → PR（base=main、`ai-generated` ラベル）→ checks green → AGMSG-RESULT。merge は受入後。

## 完了条件

- [ ] CI で PostgreSQL service が起動し、従来 skip の 7 件が実行される（PR の checks ログで skip 件数が減っていることを validation に貼る）
- [ ] `verification/run_db_integration.sh` が CI から実行され exit 0
- [ ] `package.json` の `verify:all` が実在スクリプトを指す、または削除されている
- [ ] 全パッケージの `vitest.config.ts` に `thresholds` があり、`packages/web` は coverage + json-summary を出力する
- [ ] `mise run ci` に actionlint と pnpm audit が含まれる
- [ ] `MISE_LOCKED=1 mise run ci` exit 0、かつ PR checks green

## forbidden_actions

- `allowed_files` 以外の編集
- **テストの skip 化・削除・閾値の引き下げによる green の演出**
- `verification/run_db_integration.sh` 本体の書き換え
- 本番 DB への接続、55432 以外での常設 listen、一時 DB の残置
- 依存追加（service コンテナの image 指定は依存追加に当たらない）
- merge-before-acceptance、`docs/audit/` 配下の編集、ユーザーへのレビュー依頼

## allowed_files

```
.github/workflows/ci.yml
.mise.toml
package.json
packages/shared/vitest.config.ts
packages/prjops/vitest.config.ts
packages/devops/vitest.config.ts
packages/server/vitest.config.ts
packages/web/vitest.config.ts
packages/traceability/vitest.config.ts
```

## 完了報告

```
AGMSG-RESULT v1 task_id=A024 status=ready_for_review|blocked report=.orchestration/reports/A024-report.md validation=.orchestration/validation/A024-validation.md sandbox=.orchestration/sandboxes/A024-sandbox.md learning=.orchestration/learning/A024-learning.md autoskill=.orchestration/autoskill/runs/A024-autoskill.md
```
