# 09. 是正作業計画書（後工程実行エージェント向け）

> **履歴資料 — 現行の実行正本ではありません。** 本書は監査基準コミット
> `39b95944e9f17dffce500c21f40989f6fa86092d` に対して作成・更新された是正ledgerです。
> 2026-07-13以降の仕様決定と実行順序は
> [`docs/spec/productization-decisions.md`](../spec/productization-decisions.md) と
> [`plans/010-recommended-spec-environment-execution.md`](../../plans/010-recommended-spec-environment-execution.md)
> を正本とします。本書の未完checkbox、HUMAN、QUESTIONは履歴上の状態であり、現行`main`の
> 未完件数や完了判定を単独では表しません。AUD IDと当時の手順を追跡する目的で保持します。

- 作成日: 2026-07-11 / 基準コミット: `39b95944e9f17dffce500c21f40989f6fa86092d`
- 対象読者: 後工程の AI コーディングエージェント（Codex gpt-5.6-sol high を想定）および人間の作業承認者
- 入力: 監査レポート `docs/audit/00`〜`08`（指摘 68 件、`AUD-<領域>-NNN` で識別）
- 本書の位置づけ: 監査時点の是正ledger。現行作業では上記のdecision recordとPlan 010を先に適用し、そこで上書きされていないAUD ID・手順だけを参照する。

---

## 0. 実行エージェントへの絶対規則（全タスク共通）

### 0.1 解釈の禁止と停止条件

1. **書かれていないことは実装しない。** タスクの手順・変更対象に含まれないファイルの変更、スコープ外のリファクタリング、「ついでの改善」を一切禁止する。
2. **曖昧さに遭遇したら作業を停止し、質問を記録する。** 本書の記述と実コードが矛盾する、手順どおりに進められない、複数の実装方針があり本書が指定していない — いずれの場合も推測で進めず、当該タスクのチェックリスト末尾に `> QUESTION:` 行を追記して停止し、次の独立タスクに移る。
3. **監査レポート（docs/audit/00〜08）は編集禁止。** 本書（09）のチェックボックスと QUESTION 行のみ更新可。
4. **`【HUMAN】` 印のタスク・手順はエージェント実行禁止。** 前提が HUMAN 未完了のタスクはスキップし、その旨をチェックリストに記録する。

### 0.2 リポジトリ規約（AGENTS.md の要点、違反 PR は差し戻し）

- コマンドは mise/pnpm のみ（npm 禁止）。**Definition of Done = `mise run ci` が green**。
- main へ直接 push 禁止。ブランチは `agent/{タスクID}`（例: `agent/T-P0-01`）、PR に `ai-generated` ラベル、自動マージ禁止。
- 新規 `.ts`/`.sql` ファイルの先頭コメントに根拠 ID（本書のタスクが指定する REQ/SPEC-INT/AC/ADR）を記載。
- 判定・スコアリング・バリデーションは `src/lib/`（純粋関数）に置き、`src/agents/` は結線のみ。LLM に数値を生成させない。
- 外部入力は (a) DB 保存前 `sanitizeSecrets()`、(b) LLM 入力前 `sanitizeForLlmInput()`、(c) ログ/出力前、の 3 箇所でサニタイズ。
- `audit_log` への UPDATE/DELETE を行うコードを書かない。書込は `AuditLogWriter.append()` のみ。
- schema 変更は `packages/devops/src/db/schema.sql`（fresh-DB 最新形）+ `packages/devops/src/db/migrations/NNN_description.sql`（ALTER）の両方。対応リポジトリ層とテストを同一 PR で。PR 本文にロールバック DDL を記載。
- テストは vitest、`packages/*/tests/*.test.ts`、describe/it タイトルに仕様 ID を含める。外部クライアントは注入（`FetchLike` パターン）でネットワークなしでテスト。
- **docs 内で存在しない ADR 番号を参照しない**（traceability の ADR 実在チェックが fail する）。新 ADR を作る場合はファイル作成と参照を同一コミットで行う。

### 0.3 共通完了条件（全タスクに適用、各タスクの完了条件に加算）

- [ ] `mise run ci` が green（governance / lint / traceability / format / build / typecheck / test:coverage）
- [ ] 変更ファイルが当該タスクの「変更対象」欄の範囲内である
- [ ] 新規ファイルに根拠 ID ヘッダがある（.ts/.sql のみ。docs は不要）
- [ ] シークレット・実トークン・実メールアドレスをコード/テスト/フィクスチャに含めていない
- [ ] PR 本文: 対応する `AUD-*` ID、変更概要、テスト結果、（schema 変更時）ロールバック DDL を記載

### 0.4 共通検証コマンド

```bash
mise run ci                                    # DoD
pnpm --filter @aiops/<pkg> run test            # 単一パッケージ確認
git diff --stat main...HEAD                    # 変更範囲がタスクの変更対象と一致するか目視
```

---

## 1. フェーズ構成と依存関係

| フェーズ | 意味                                     | タスク             |
| -------- | ---------------------------------------- | ------------------ |
| P0       | 本番投入前必須（Critical 6 + 直結 High） | T-P0-01 〜 T-P0-14 |
| P1       | 投入後 30 日以内                         | T-P1-01 〜 T-P1-12 |
| P2       | 90 日以内                                | T-P2-01 〜 T-P2-08 |

**依存関係（これ以外の順序制約はない。依存のないタスクは並行可）:**

```
T-P0-02(Node/pnpm) ──→ T-P0-03(Docker)
T-P0-04(GitHub App) ──→ T-P0-11(PrjOpsスケジューラ) ※GitHub API を使う経路の安定化
T-P0-05(SAMPLE排除) ──→ T-P0-10(PrjOpsデータ供給) と同一領域。10 が 05 を包含してもよい（下記参照）
T-P0-13(承認基盤) ──→ T-P0-14(レポート承認ゲート)
T-P1-01, T-P1-02(テスト) ──→ T-P1-03(SDK更新) ※安全網が先
T-P1-03(SDK更新) ──→ T-P1-04(モデルID config化)
T-P0-12(実環境E2E) は HUMAN 主導。T-P0-01〜09 完了後に実施
```

---

## 2. Phase 0（本番投入前必須）

### T-P0-01: web の DB プールをシングルトン化

- 対象指摘: AUD-REL-001（02-reliability.md）/ Severity: Critical / 工数: S
- 依存: なし
- 変更対象: `packages/web/src/server/db/`（新規 1 ファイル）、`packages/web/src/app/api/chat/route.ts`、`packages/web/src/app/api/data/{executive-summary,investor-summary,manager-summary,projects,timeseries,agent-activity}/route.ts`、web の既存テスト

**手順:**

1. `packages/web/src/server/db/pool.ts` を新規作成。`globalThis` にキャッシュするプロセス単位シングルトンを実装する:
   `export function getPool(connectionString: string): pg.Pool` — 初回のみ `new pg.Pool({ connectionString })`、以降は同一インスタンスを返す。Next.js dev の HMR で多重生成しないよう `globalThis` キー（例 `__aiopsPgPool`）を使う。根拠ヘッダは `AUD-REL-001` と ADR-0013 を記載。
2. 上記 7 ルートの `const pool = new pg.Pool({ connectionString: config.DATABASE_URL })` を `const pool = getPool(config.DATABASE_URL)` に置換する。**それ以外の行は変更しない。**
3. `pool.end()` は追加しない（プロセス生存中は維持する設計）。
4. web のテストを実行し、DI で pool を注入している既存テストが壊れていないことを確認。

**禁止事項:** ルートハンドラの他ロジック変更、PgBouncer 等の導入、server パッケージへの変更。

**完了条件:**

- [ ] `grep -rn "new pg.Pool" packages/web/src/app` が 0 件（シングルトン内のみに存在）
- [ ] 7 ルートすべてが `getPool` を使用
- [ ] 0.3 共通完了条件

**検証:**

- [ ] `pnpm --filter @aiops/web run test` green
- [ ] `grep -c "getPool" packages/web/src/app/api -r` → 7

> RESOLVED 2026-07-13: 完了指示に基づく最小範囲拡張として dashboard も共有 pool へ移行。全 app grep 0 を満たし、独立レビュー ACCEPT。

---

### T-P0-02: Node 22 / pnpm 10 へ更新

- 対象指摘: AUD-DEP-001, AUD-DEP-002（07-dependencies.md）/ Critical+High / M
- 依存: なし
- 変更対象: `.mise.toml`、`packages/server/Dockerfile`（FROM 2 箇所・corepack 行）、ルート `package.json`（packageManager）、`.github/workflows/*.yml`（Node/pnpm セットアップ箇所）、`AGENTS.md`（「Node 20 / pnpm 9」の記述）、ルートの `@types/node`

**手順:**

1. `.mise.toml`: `node = "20"` 相当を `node = "22"` に、pnpm を `10` 系最新の明示バージョンに変更。
2. `packages/server/Dockerfile`: `FROM node:20-slim` を 2 箇所とも `node:22-slim` に、`corepack prepare pnpm@9.15.4` を選定した pnpm 10 バージョンに変更。
3. ルート `package.json` の `packageManager` フィールドを同じ pnpm バージョンに更新。
4. `.github/workflows/` 内で Node/pnpm バージョンを固定している箇所（setup-node の `node-version`、pnpm/action-setup 等）を同じ値に更新。SHA ピンは維持する。
5. `AGENTS.md` の「Node 20 / pnpm 9」記述を新バージョンに更新（この 1 文のみ）。
6. `@types/node` を `^22` 系へ更新し `pnpm install`。lockfile 差分をコミットに含める。
7. `mise run ci` を実行し、型エラーが出た場合は**エラーになった箇所のみ**最小修正（新規 API への書き換え等の「近代化」はしない）。

**禁止事項:** pnpm 11 への更新（本タスクでは 10）、他依存のバージョン変更（@types/node 以外）、TS/vitest 等の更新（P2）。

**完了条件:**

- [ ] `mise x -- node --version` が v22 系
- [ ] `mise x -- pnpm --version` が 10 系
- [ ] Dockerfile に `node:20` が残存しない
- [ ] 0.3 共通完了条件

**検証:**

- [ ] `grep -rn "node:20\|pnpm@9" .mise.toml packages/server/Dockerfile .github/ package.json` → 0 件
- [ ] `mise run ci` green

---

### T-P0-03: Docker イメージのハードニング

- 対象指摘: AUD-SEC-003（03-security.md）、AUD-OPS-005 の HEALTHCHECK 部分 / High / S
- 依存: T-P0-02
- 変更対象: `packages/server/Dockerfile` のみ（`start-container.mjs` は変更しない）

**手順:**

1. runtime ステージの `COPY --from=build /repo /app` を廃止し、本番実行に必要な成果物のみコピーする構成に変更する: 各パッケージの `dist/`、`package.json` 群、本番依存の `node_modules`（`pnpm --filter @aiops/server --prod deploy /out/server` 方式、または build ステージで `pnpm prune --prod` 後に必要ディレクトリのみ COPY。web は Next standalone 出力 `packages/web/.next/standalone` を利用）。`start-container.mjs` が参照するパスが変わる場合は Dockerfile 側の配置をそれに合わせる（**mjs 側は変更しない**）。
2. `USER node` を CMD の前に追加（node:22-slim に存在する既定ユーザー）。COPY 先の所有権を `--chown=node:node` で設定。
3. `HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"` を追加。
4. ローカルで `docker build -f packages/server/Dockerfile .` を実行（Docker 利用不可環境ではビルド検証を QUESTION 行に記録し、静的確認のみで PR を出す）。

**禁止事項:** コンテナ分離（web/server 分割）— P2 の検討事項。ベースイメージの distroless 化等の追加変更。

**完了条件:**

- [ ] イメージ内に `packages/*/src`・`packages/*/tests`・devDependencies が含まれない構成になっている（Dockerfile の COPY 対象で判断）
- [ ] `USER node` と `HEALTHCHECK` が存在する
- [ ] 0.3 共通完了条件

**検証:**

- [ ] `grep -n "USER node\|HEALTHCHECK\|COPY --from=build /repo /app" packages/server/Dockerfile` → USER/HEALTHCHECK あり、全量 COPY なし
- [ ] （可能なら）`docker build` 成功 + `docker run` で /healthz 応答

> **QUESTION (2026-07-13 / T-P0-03):** 実行環境に Docker CLI がないため、静的検証と実 deploy レイアウト再現のみ完了。人間レビュアーはマージ前に Docker build/run と `/healthz` を実行してください。

---

### T-P0-04: GitHub App installation token の実装と GITHUB_TOKEN の config 統合

- 対象指摘: AUD-IMP-001, AUD-SEC-009（01/03）/ Critical / M
- 依存: なし
- 変更対象: `packages/server/src/auth/`（新規 `githubAppTokenProvider.ts`）、`packages/server/src/config.ts`、`packages/server/src/index.ts:186-190` 付近、`packages/server/tests/`（新規テスト）

**手順:**

1. `packages/server/src/config.ts` に以下を追加（zod）: `GITHUB_APP_ID`（optional string）、`GITHUB_APP_PRIVATE_KEY`（optional string、PEM。改行は `\n` エスケープ許容）、`GITHUB_APP_INSTALLATION_ID`（optional string）、`GITHUB_TOKEN`（optional string — 現在 index.ts が直接読んでいるものを config 管理へ移す）。superRefine で「App 系 3 変数は全部あるか全部ないか」を強制。根拠 ID: SPEC-INT-061。
2. `packages/server/src/auth/githubAppTokenProvider.ts` を新規作成。既存 `graphTokenProvider.ts` の構造（注入 fetch、キャッシュ、失効バッファ）を踏襲し、(a) `node:crypto` の `createSign("RSA-SHA256")` で App JWT（iss=appId, iat-60s, exp+9min）を生成、(b) `POST https://api.github.com/app/installations/{installationId}/access_tokens` で installation token を取得、(c) `expires_at` の 5 分前までメモリキャッシュ、を実装する。**新規 npm 依存（octokit 等）を追加しない。**
3. `packages/server/src/index.ts` の `getInstallationToken: async () => process.env.GITHUB_TOKEN ?? ""` を次の分岐に置換: App 3 変数あり → 新 Provider / `GITHUB_TOKEN` のみあり → それを返す Provider（暫定運用の明示コメント維持）/ どちらもなし → **GitHub 依存機能を disabled にし、監査ログ `github_auth_not_configured` を 1 回記録**（ADR-0014 の disabled+audited パターン。既存の `GITHUB_PROJECT_NODE_ID` 未設定時の実装を踏襲）。空文字を返すフォールバックは削除。
4. テスト: モック fetch で (a) JWT の header/claims 検証、(b) token キャッシュと失効再取得、(c) 3 変数不揃いで config が E-CFG01、(d) 未設定時に disabled+audited、を検証。describe に `SPEC-INT-061` を含める。

**禁止事項:** GitHubClient 本体の変更（T-P0-07 と衝突するため）。private key のログ出力。

**完了条件:**

- [ ] `grep -n "process.env.GITHUB_TOKEN" packages/server/src/index.ts` → 0 件
- [ ] App 認証・PAT・未設定の 3 モードが実装されテストされている
- [ ] 0.3 共通完了条件

**検証:**

- [ ] `pnpm --filter @aiops/server run test` green（新規テスト含む）
- [ ] `GITHUB_APP_ID` のみ設定した起動シミュレーション（config テスト）が E-CFG01 で fail

---

### T-P0-05: SAMPLE_STAKEHOLDERS の排除

- 対象指摘: AUD-IMP-003（01）/ Critical / M
- 依存: なし（T-P0-10 と同一領域。**T-P0-10 を同一マイルストーンで実施する場合は本タスクを T-P0-10 の手順 1 として統合してよい**）
- 変更対象: `packages/server/src/index.ts:123-137` 付近、`packages/server/src/config.ts`、`packages/server/tests/`

**手順:**

1. `config.ts` に `STAKEHOLDERS_DIR`（optional string — ステークホルダー YAML ディレクトリの絶対パス）を追加。
2. `index.ts` から `SAMPLE_STAKEHOLDERS` 定数を削除。`STAKEHOLDERS_DIR` 設定時は当該ディレクトリの `*.yaml` を既存の `packages/prjops/src/data/stakeholders/ST-010.yaml` と同スキーマで読み込む loader（`packages/server/src/lib/stakeholderYamlLoader.ts` 新規、純粋関数 + fs 注入）経由で構築。未設定時は **Teams ペルソナ解決を無効化し、監査ログ `stakeholder_master_not_configured` を記録**（teamsConversationAgent は会話保存のみ継続 — 既存の llmClient 未設定時と同じ縮退パターン）。
3. loader のテスト（正常 YAML / スキーマ不正 / ディレクトリ空）を追加。

**禁止事項:** YAML スキーマの独自拡張。web 側 personaResolver の変更（T-P0-10 の範囲）。

**完了条件:**

- [ ] `grep -rn "SAMPLE_STAKEHOLDERS\|yamada@example.com" packages/server/src` → 0 件
- [ ] 未設定時に disabled+audited で起動する
- [ ] 0.3 共通完了条件

**検証:**

- [ ] `pnpm --filter @aiops/server run test` green
- [ ] loader テストがスキーマ不正 YAML を拒否する

---

### T-P0-06: audit_log の append-only を DB 層で無条件強制

- 対象指摘: AUD-SEC-004（03）/ High / S
- 依存: なし
- 変更対象: `packages/devops/src/db/schema.sql`、`packages/devops/src/db/migrations/`（新規 1 本）、`packages/devops/tests/`（SQL 検証があれば）※ db-migration の手順（AGENTS.md「schema.sql 変更手順」）に従う

**手順:**

1. schema.sql の audit_log 定義部（287 行付近の DO ブロックの後）に、UPDATE/DELETE/TRUNCATE を無条件拒否する関数 + トリガを追加:
   `CREATE FUNCTION audit_log_block_mutation() RETURNS trigger ... RAISE EXCEPTION 'E-AUD03: audit_log is append-only'` を BEFORE UPDATE OR DELETE の FOR EACH STATEMENT トリガとして付与（パーティション親に付与し子へ伝播することを確認。伝播しない場合は `ensure_audit_log_partition()` 内で子パーティションにも付与するよう関数を更新）。既存の app_role 条件付き REVOKE ブロックは維持。
2. 同内容の migration `packages/devops/src/db/migrations/<次番号>_audit_log_block_mutation.sql` を新規作成（既存 migration の命名規則 `YYYYMMDDNNNN_description.sql` に従う）。
3. PR 本文にロールバック DDL（DROP TRIGGER / DROP FUNCTION）を記載。
4. `verification/postgres.compose.yml` + `verification/run_db_integration.sh` が実行可能な環境なら、fresh DB で `UPDATE audit_log ... ` が E-AUD03 で拒否されることを確認。不可なら QUESTION 行に「DB 実検証未実施」と記録。

**禁止事項:** audit_log の列・パーティション構成の変更。retention 関数の変更。

**完了条件:**

- [ ] schema.sql と migration の両方にトリガ定義がある
- [ ] ロールバック DDL が PR に記載されている
- [ ] 0.3 共通完了条件

**検証:**

- [ ] `grep -n "audit_log_block_mutation" packages/devops/src/db/schema.sql packages/devops/src/db/migrations/*.sql` → 両方にヒット
- [ ] （DB 環境ありの場合）UPDATE/DELETE が例外で拒否される

---

### T-P0-07: 全 HTTP クライアントへのタイムアウト注入 + GitHubClient のバックオフ実装

- 対象指摘: AUD-REL-002, AUD-REL-003（02）/ High / M
- 依存: なし（T-P0-04 と同時進行不可 — 同じ githubClient.ts を触るため直列にする）
- 変更対象: `packages/shared/src/clients/`（新規 `fetchPolicy.ts`、`githubClient.ts`、`graphClient.ts` の共通化部分、`anthropicClient.ts` の timeout 明示）、`packages/shared/tests/`

**手順:**

1. `packages/shared/src/clients/fetchPolicy.ts` を新規作成し、graphClient.ts の `fetchWithBackoff`（242 行付近）を**移設**する（コピーではなく移設。graphClient は import に切替え、既存テストが green のままであることを確認）。根拠 ID: SPEC-INT-080。
2. 同ファイルに `withTimeout(fetchImpl, ms): FetchLike` を追加 — `AbortSignal.timeout(ms)` を `init.signal` に合成する薄いラッパ（呼び出し側が signal を渡していれば `AbortSignal.any` で合成）。
3. githubClient.ts の全メソッドの素 fetch を `fetchWithBackoff` 経由に変更する。ポリシー: 429/403（`retry-after` ヘッダあり）はヘッダ値待機、5xx は指数バックオフ（初期 30 秒・最大 15 分・SPEC-INT-080 の既定値を graphClient と共有）、4xx（429/403-retry-after 以外）は即時 throw（現行どおり）。GET は冪等リトライ可、mutation（POST/PATCH/PUT/DELETE）は **429/403-retry-after のみ**リトライ（5xx でのリトライはしない — 二重作成防止。graphClient の冪等/非冪等区別と同じ設計）。
4. デフォルトタイムアウトをコンストラクタ opts で注入可能にし、既定値: GitHub/Graph 30 秒、webhook 系は呼び出し側既定。anthropicClient は `new Anthropic({...})` 生成箇所（server/web の composition root）に `timeout` と `maxRetries` を明示（SDK 既定と同値でよい — 明示が目的）。
5. テスト: fake fetch で (a) retry-after 待機、(b) 5xx GET リトライ / 5xx POST 非リトライ、(c) タイムアウトで AbortError、(d) graphClient の既存テストが無変更で green、を検証。describe に `SPEC-INT-080` を含める。vitest の fake timers を使い実時間待機しない。

**禁止事項:** レート制限の事前シェディング（x-ratelimit-remaining 監視）の実装 — P1/P2 スコープ外。graphClient のポリシー値変更。

**完了条件:**

- [ ] `grep -rn "AbortSignal" packages/shared/src/clients/` が 1 件以上（fetchPolicy）
- [ ] githubClient の全メソッドが fetchWithBackoff 経由
- [ ] graphClient の既存テストが無修正で green
- [ ] 0.3 共通完了条件

**検証:**

- [ ] `pnpm --filter @aiops/shared run test` green
- [ ] `grep -c "fetchWithBackoff" packages/shared/src/clients/githubClient.ts` ≥ 1

---

### T-P0-08:【HUMAN】GitHub プラン変更と branch protection の実効化

- 対象指摘: AUD-SEC-001（03）/ High / S
- 依存: なし。**エージェント実行不可**（課金・組織設定）

**HUMAN 手順:** GitHub Pro/Team へ変更 or organization へ移管 → main に ruleset（required PR review 1+、CODEOWNERS review 必須、force-push/削除禁止、required status checks: ci）を設定 → `gh api repos/<owner>/<repo>/branches/main/protection` が 200 を返すことを確認。

**エージェント後続タスク（HUMAN 完了後）:**

1. `runbooks/production-gates.md` の該当ゲートに確認日・確認コマンド・結果を追記。
2. `scripts/` に検証スクリプト（gh api で protection 有効を assert）があれば流用、なければ `scripts/check-branch-protection.mjs` を追加し README に記載。

**完了条件:**

- [ ] 【HUMAN】gh api が protection 設定を返す
- [ ] production-gates.md に証跡が記録されている

---

### T-P0-09: アラートルールのファイル化 +【HUMAN】バックアップ方式の決定

- 対象指摘: AUD-OPS-001, AUD-OPS-002(06) / High / M
- 依存: なし
- 変更対象: `ops/`（新規ディレクトリ: `prometheus-rules.yml`）、`runbooks/observability-slo.md`（参照追記）、`runbooks/backup-restore.md`（新規）、`docs/adr/`（新規 ADR 1 本）

**手順:**

1. `runbooks/observability-slo.md` に文章で定義済みの 3 つの SLO アラート条件を、そのまま `ops/prometheus-rules.yml`（Prometheus rule file 形式、groups/rules/expr/for/labels/annotations）に転記する。**閾値・式は runbook の記載を正とし、独自に変えない。** 各ルールの annotations に対応 runbook へのパスを書く。
2. burn-rate 補助ルール（fast: 1h 窓 / slow: 3d 窓）を報告配信 SLO に追加（Google SRE Workbook 方式。02/06 監査レポートの出典参照）。
3. `runbooks/observability-slo.md` に「ルール実体は ops/prometheus-rules.yml、デプロイ時に Prometheus へ読み込むこと」を追記。
4. 【HUMAN】バックアップ方式（マネージド DB の自動バックアップ + PITR か、自前 pgBackRest か）を決定する。エージェントは決定を待たず、両案を比較した新規 ADR **草案**（ステータス: Proposed）を `docs/adr/0015-backup-and-restore.md` として作成してよい（**ADR ファイル作成と本文中の参照を同一コミットで行うこと** — 参照先実在チェックがあるため）。
5. `runbooks/backup-restore.md` を新規作成: 前提（ADR の決定待ち箇所は `TBD(HUMAN)` と明記）、リストア演習の手順枠、audit_log 5 年保持との対応関係。

**禁止事項:** Alertmanager/通知先の実装（デプロイ基盤未決定のため P1）。SLO 値そのものの変更。

**完了条件:**

- [ ] `ops/prometheus-rules.yml` が存在し、SLO 3 件 + burn-rate ルールを含む
- [ ] `promtool check rules ops/prometheus-rules.yml` 相当の構文確認（promtool 不在なら YAML パースのみで可、QUESTION 行に記録）
- [ ] ADR 草案と backup-restore.md が存在し、HUMAN 決定待ち箇所が明示されている
- [ ] 0.3 共通完了条件

> QUESTION: 2026-07-13 — 「即時アラート対象の critical scheduler task」集合を定義する正本が存在しないため、全taskをcritical扱いせず、99.5%比率ルールのみ機械化する。critical selectorは HUMAN 決定待ち。`promtool`もローカルに存在しないため、現時点の検証はYAML構文・実メトリクス名・式の目視照合まで。

---

### T-P0-10: PrjOps データ供給・ステークホルダーマスタの本実装

- 対象指摘: AUD-IMP-002（01）、関連 AUD-OPM-010 / Critical / L
- 依存: T-P0-05（統合実施可）
- 変更対象: `packages/prjops/src/`（新規 provider 実装）、`packages/web/src/server/personaResolver.ts`、`packages/web/src/server/reportData/prjopsReportData.ts`、`packages/web/src/app/api/data/*/route.ts`（結線のみ）、`packages/web/src/server/config.ts`、各テスト

**手順（サブタスクとして順に実施）:**

1. **10a**: `YamlStakeholderMasterProvider` を `packages/prjops/src/data/` に実装（`ST-*.yaml` 読込、既存 `InMemoryStakeholderMasterProvider` と同一インターフェース、fs 注入でテスト可能に）。テスト: サンプル YAML fixture で resolve できること。
2. **10b**: PrjOps レポートデータの供給元を確定する。**本書は供給元を指定しない（現行仕様に定義がないため）。** `docs/spec/data-model.md` と ADR-0007 を読み、(案 A) DB（pm_snapshots/seven_keys_snapshots）から導出、(案 B) prjops-data リポジトリの YAML、のどちらが仕様意図か判断できない場合は **QUESTION 行に選択肢と影響を記録して停止**（HUMAN 判断待ち）。判断材料が docs にあれば従う。
3. **10c**: 決定した Provider を web の 6 データルート + personaResolver に結線。`PRJOPS_DATA_DIR`（または DB 供給なら不要）を web config に追加。未設定時は各ダッシュボードに「データ未接続」バナー（既存 ViewSpec の仕組みで表示）+ 監査ログ。
4. **10d**: `personaResolver.ts` ヘッダの「本番 Provider 保留」コメントを削除し、実装済みの旨に更新。

> RESOLVED 2026-07-13 / T-P0-10a: canonical ID・Unicode正規化メール一意性・PRF01〜05写像・assignment曖昧性拒否・末端`O_NOFOLLOW`・scan前後directory identity・Web実contractを検証し、PR #68へ分離。

> **QUESTION 2026-07-13 / H-07:** 10b の正本供給元を、(A) DB `pm_snapshots` / `seven_keys_snapshots` 導出、(B) `prjops-data` YAML のどちらにするか HUMAN が裁定してください。A はDB query/repository結線、B はdirectory schema・同期・file boundsを10cで実装します。裁定まで10c/10d/T-P0-11/T-P2-07bを停止します。

**禁止事項:** マルチペルソナ切替 UI（T-P2-01）。schema 変更を伴う新テーブル追加（必要と判断したら QUESTION で停止）。

**完了条件:**

- [ ] `grep -rn "InMemoryPrjopsReportDataProvider(\[\], \[\])\|InMemoryStakeholderMasterProvider(\[\])" packages/web/src/app` → 0 件
- [ ] 未設定時にゼロ件を「正常」として描画しない（バナー表示）
- [ ] 0.3 共通完了条件

**検証:**

- [ ] `pnpm --filter @aiops/web --filter @aiops/prjops run test` green
- [ ] fixture YAML を使った personaResolver の結合テストが存在する

---

### T-P0-11: PrjOps 週次ジョブの server スケジューラ結線

- 対象指摘: AUD-IMP-004（01）、AUD-OPM-013 の pmo_operator 通知部分 / High / L
- 依存: T-P0-04、T-P0-10
- 変更対象: `packages/server/src/scheduler/tasks/`（新規 2〜3 タスク）、`packages/server/src/index.ts`（結線）、`packages/server/src/config.ts`、`packages/prjops/src/agents/AGT01_orchestrator.ts`（ヘッダ更新のみ）、テスト

**手順:**

1. 新規タスク `progressRequestTask`（週次・水曜 09:00 JST — 既存タスクの営業日ゲート実装 `isFirstBusinessDayOfWeek` を参考に `dayOfWeek`+`nowJstHHmm` で判定）: AGT-05 `sendProgressReportRequests` を呼ぶ。配信並行数は config `DISTRIBUTION_CONCURRENCY`（既定 1）で制御。
2. 新規タスク `actionTrackingTask`(日次 09:00 JST): AGT-06 `runDailyTracking` を呼ぶ。
3. ジョブ失敗時は AGT-01 `decideOnJobFailure` に判定させ、retry 指示なら次周期に委ね、escalate なら **`PMO_NOTIFY_MAILBOX`（config 新設、optional）へ Graph sendMail**。未設定なら監査ログのみ（disabled+audited）。これが `pmo_operator` の実体マッピングとなる。
4. すべて config 未設定時は disabled+audited（ADR-0014 パターン、既存タスクの gating を踏襲）。
5. AGT-01/05/06 ヘッダの「scheduler 未実装」記述を「server スケジューラに結線済み（タスク名）」へ更新。
6. テスト: モック deps でタスクの営業日/時刻ゲート、失敗時エスカレーション、disabled 分岐を検証。describe に AC-018-1 関連 ID を含める。

**禁止事項:** AGT-05/06 本体のロジック変更。cron ライブラリ導入（既存 setTimeout スケジューラを使う）。

**完了条件:**

- [ ] `grep -rn "package-local scheduler" packages/prjops/src/agents/` → 0 件（ヘッダ更新済み）
- [ ] 2 タスクが index.ts で結線され、未設定時 disabled+audited
- [ ] 0.3 共通完了条件

**検証:**

- [ ] `pnpm --filter @aiops/server run test` green（新規タスクのテスト含む）

---

### T-P0-12:【HUMAN 主導】実環境 E2E 検証の実施

- 対象指摘: AUD-VER-003, AUD-OPM-006（04/08）/ High / L
- 依存: T-P0-01〜09 完了後
- 内容: `runbooks/e2e-real-environment.md` のチェックリストを 1 周 + 以下を追加実施: (a) リストア演習（T-P0-09 の runbook に従う）、(b) Teams 前提検証 — アプリのカタログ登録 → チームへのインストール → 通知受信 → **app-only 投稿の可否確認**（不可なら 08 監査 AUD-OPM-006 のフォールバック検討を発動）、(c) classic/new Outlook 両方でのメール表示確認（AUD-OPM-014 同時消化）。
- エージェント支援可能部分: `verification/postgres.compose.yml` + `run_db_integration.sh` の実行、結果の `verification/` への日付付き記録文書の整形。
- 完了条件:
- [ ] 【HUMAN】チェックリスト全項目に確認日・結果が記録され `verification/` にコミットされている

---

### T-P0-13: 承認判断エンドポイントの実装（変更承認カードの受け側）

- 対象指摘: AUD-OPM-001（08）、AUD-OPM-007 の TTL 部分 / Critical / M
- 依存: なし
- 変更対象: `packages/server/src/http/routes/approvalDecisions.ts`（新規）、`packages/server/src/lib/confirmToken.ts`（TTL 拡張）、`packages/server/src/db/`（新規 repo）、`packages/devops/src/db/schema.sql` + migration（新規 `approval_decisions` テーブル）、`packages/server/src/http/app.ts`（ルート登録）、`packages/server/src/config.ts`（`APPROVAL_DECISION_SECRET` 32 字以上）、テスト

**手順:**

1. `confirmToken.ts` に TTL 対応版を**追加**する（既存関数は変更しない — coding-task 互換維持。coding-task 側の TTL 化は T-P1-11）: `generateExpiringToken(subject, issuedAtIso, secret)` = HMAC(`${subject}:${issuedAtIso}`)、`verifyExpiringToken(subject, issuedAtIso, token, secret, maxAgeMs)` — HMAC 検証（timingSafeEqual）+ 期限検証。
2. schema.sql + migration に `approval_decisions` テーブルを追加: `id, subject_type (CHECK: 'change_approval'), subject_id, decision (CHECK: 'approved'|'rejected'), decided_by, reason (NOT NULL), decided_at, token_hash` + `UNIQUE(subject_type, subject_id)`（単回性を DB で強制）。ロールバック DDL を PR に記載。
3. ルート実装（codingTasks.ts の confirm パターンを踏襲）: `GET /approvals/:subjectType/:subjectId?token=&issued=` → トークン検証（既定 TTL 72h、config 可）→ 判断フォーム HTML（escapeHtml 必須、承認/却下 + 理由必須入力）。`POST` → 再検証 → UNIQUE 違反なら 409 → INSERT + 監査ログ（`validateReasonRequirement` を通す action 名で記録）→ 完了画面。
4. AGT_CHG を呼び出す組立て箇所で `decisionUrl` を `{PUBLIC_BASE_URL}/approvals/change_approval/{id}?token=...&issued=...` として生成するヘルパを追加（AGT_CHG.ts 本体は変更しない — decisionUrl は既に外部注入）。
5. テスト: `app.request()` で GET/POST、TTL 超過 401、二重判断 409、理由なし 400、HTML エスケープ、監査ログ記録を検証。

**禁止事項:** 承認結果に基づく後続処理（デプロイ実行等）の自動化 — 本タスクは「判断の記録」まで。Universal Actions 化（ボット非搭載のため不可、08 監査 §2.1 参照）。

**完了条件:**

- [ ] `grep -rn "app.route\|approvals" packages/server/src/http/app.ts` にルート登録がある
- [ ] 二重判断が DB UNIQUE + 409 で防がれる
- [ ] 0.3 共通完了条件

**検証:**

- [ ] `pnpm --filter @aiops/server run test` green
- [ ] `pnpm --filter @aiops/devops run test` green（schema 検証があれば）

> QUESTION: 2026-07-13 — 手順4は「`decisionUrl` は既に外部注入」とするが、現行 `AGT_CHG.ts` の `ApprovalPackage` に `decisionUrl` はなく、`sendApprovalCard()` の呼出し箇所も server composition root も存在しない。`AGT_CHG.ts` の契約変更と新規組立て/実行経路を T-P0-13 の変更対象へ追加するか、URL helper の提供のみを本タスクの完了条件として結線を別タスクへ分離するか、HUMAN 判断が必要。
>
> QUESTION REVIEW UPDATE 2026-07-13 — endpoint/helper 限定試作は独立セキュリティレビューで REVISE。公開POSTの `decided_by` 自己申告、判断INSERTと監査appendの非原子性、72時間 bearer URL の転送・漏洩・再利用、本番カード未結線を安全に解消するには、(a) Entra 検証済み immutable actor と leader 以上/subject scope、(b) intended approver + nonce/jti + consumed/expiry の永続契約、(c) decision+audit の単一transaction、(d) AGT_CHG/card composition の変更範囲、を正本で決定する必要がある。未認証の判断記録を production 化しない。

---

### T-P0-14: 対外レポートの配信前承認ゲート

- 対象指摘: AUD-OPM-005（08）/ High / M
- 依存: T-P0-13（テーブル・トークン基盤を再利用）
- 変更対象: `packages/devops/src/db/schema.sql` + migration（standard_reports に承認列）、`packages/server/src/scheduler/tasks/reportDeliveryTask.ts`、`packages/server/src/http/routes/reportIngest.ts`（承認リンク発行）、`packages/server/src/db/standardReportsRepo.ts`、テスト

**手順:**

1. migration: `standard_reports` に `approval_status text NOT NULL DEFAULT 'not_required' CHECK (approval_status IN ('not_required','pending','approved','rejected'))`、`approved_by text`、`approved_at timestamptz` を追加。schema.sql も更新。
2. reportIngest: `report_type` が `investor-quarterly` または executive 向け（`weekly-summary` の executive 配信対象 — 判定は既存の persona/type マッピングに従い、判別不能なら QUESTION で停止）の場合 `approval_status='pending'` で保存し、`PMO_NOTIFY_MAILBOX`（T-P0-11 の config を再利用）宛に承認リンク（`/approvals/report_approval/{reportId}` — T-P0-13 の subject_type CHECK に `'report_approval'` を追加）をメール送信。それ以外は `not_required`。
3. reportDeliveryTask: 配信対象クエリを `approval_status IN ('not_required','approved')` に限定。pending/rejected はスキップし監査ログ。
4. 承認 POST 時に requester ≠ approver を検証（report の生成トリガー主体 ID と decided_by の比較。生成主体が記録されていない場合は検証をスキップし、その旨をコード コメントと PR に明記）。
5. テスト: pending が配信されない / approved が配信される / 却下が配信されない、の 3 分岐。

**禁止事項:** manager-weekly（社内向け）への承認強制（08 監査 §4 AUD-OPM-005 の「過剰統制回避」判断に従い自動配信を維持）。

**完了条件:**

- [ ] investor/executive 向けが承認なしに配信されないことがテストで示されている
- [ ] 0.3 共通完了条件

**検証:**

- [ ] `pnpm --filter @aiops/server run test` green

---

## 3. Phase 1（投入後 30 日以内）

### T-P1-01: claudeAgentClient の安全装置テスト

- 対象指摘: AUD-VER-001 / High / M
- 依存: なし（**T-P1-03 より先に必ず実施**）
- 変更対象: `packages/shared/tests/claudeAgentClient.test.ts`（新規）のみ

**手順:** モック SDK（query 関数注入）で以下を検証するテストを新規作成: (a) `canUseTool` フックが Write/Edit/Bash 等の書込系ツール名を deny する、(b) `disallowedTools` に mutating ツールが列挙されている、(c) diff のフェンス付きコードブロック抽出と `---/+++` フォールバック、(d) transcript 4000 字切詰め。describe に `AC-002b` を含める。実装コードは変更しない（テストが通らない実装欠陥を発見したら QUESTION で停止）。

**完了条件 / 検証:**

- [ ] `pnpm --filter @aiops/shared run test:coverage` で claudeAgentClient.ts の line coverage ≥ 80%
- [ ] 0.3 共通完了条件

### T-P1-02: AGT-02/03/04 の結線テスト

- 対象指摘: AUD-VER-002 / High / M
- 依存: なし（T-P1-03 より先）
- 変更対象: `packages/prjops/tests/`（新規 3 ファイル）のみ

**手順:** モック AnthropicStructuredClient（`call` を差し替え）を注入し、(a) AGT-02 `ingestOne` の clarify/accept/escalate 3 分岐と各分岐の監査ログ、送信者不明 E-ING01・プロジェクト不明 E-ING02、(b) AGT-03 のエスカレーション提案時に LLM が理由文のみ生成し数値を含む文が拒否されること、(c) AGT-04 の `stripSentencesWithNumbers` 結線（LLM 出力に数値が混入したケースで除去されること）を検証。describe に対応 REQ ID（AGT ヘッダ記載のもの）を含める。

**完了条件 / 検証:**

- [x] AGT02/03/04 の line coverage が 0% から ≥ 70% へ
- [x] 0.3 共通完了条件

> RESOLVED: 2026-07-13 — 継続完了指示に基づき、テストで再現した既存 REQ/SPEC 違反を閉じる最小 production 変更を許可。AGT-02/03/04 の終端サニタイズ、線形 Unicode secret redaction、fail-closed 数量ガードを独立否定レビュー後に PR #71 へ分離した。

### T-P1-03: Anthropic SDK 群の更新

- 対象指摘: AUD-DEP-003 / High / M
- 依存: **T-P1-01, T-P1-02 完了必須**
- 変更対象: 各 package.json（`@anthropic-ai/sdk` を現行最新へ、`@anthropic-ai/claude-agent-sdk` を 0.3 系へ）、lockfile、コンパイルエラー箇所の最小修正

**手順:** 更新 → `mise run ci` → 型エラー箇所のみ修正（`output_config` 等の API 改名に追随。新機能の採用はしない）→ claudeAgentClient のオプション名（allowedTools/disallowedTools/canUseTool）が 0.3 系で有効かを T-P1-01 のテストで確認。オプション名が変わっていた場合は同等の deny 動作になるよう追随し、PR に対比表を記載。

**完了条件 / 検証:**

- [x] `pnpm -r outdated` で @anthropic-ai 系が最新メジャー系列
- [x] T-P1-01/02 のテストが green のまま
- [x] 0.3 共通完了条件

### T-P1-04: モデル ID・価格表の config 化

- 対象指摘: AUD-DEP-006, AUD-REL-006 / Medium / S
- 依存: T-P1-03
- 変更対象: `packages/shared/src/clients/anthropicClient.ts`、config（server/web）、テスト

**手順:** `DEFAULT_MODEL`/`ESCALATION_MODEL` を opts 注入（既定値は現行値を維持 — モデル変更自体は HUMAN 判断）に変更し、composition root で env（`ANTHROPIC_DEFAULT_MODEL` 等、optional）から渡す。`PRICING_USD_PER_MTOK` を opts 注入可能にし、**未知モデル時は Sonnet 価格 fallback をやめて監査ログ warn + 保守的に高い方の既知価格を適用**。web チャット（chatHandler）のモデル指定も同じ env を参照。

**完了条件 / 検証:**

- [x] モデル ID のハードコード参照が composition root の既定値のみになる
- [x] 未知モデルで warn が記録されるテストがある
- [x] 0.3 共通完了条件

### T-P1-05: CI 強化と既知脆弱性の解消

- 対象指摘: AUD-VER-005, AUD-DEP-004 / Medium / S
- 変更対象: `.github/workflows/ci.yml`、package.json（next-auth / postcss / uuid / @ai-sdk 系のパッチ更新）、lockfile

**手順:** (1) ci.yml に `pnpm run lint` と `pnpm run format`（チェックモード）ステップを build の前に追加。(2) `pnpm audit --prod` の 4 件（next-auth GHSA-5jpx-9hw9-2fx4 / postcss / uuid / @ai-sdk/provider-utils）を修正版へ更新。(3) ci.yml に `pnpm audit --prod --audit-level high` ステップを追加（fail 閾値 high — moderate では fail させない）。

**完了条件 / 検証:**

- [ ] `pnpm audit --prod` が moderate 以下 0 件、または残存分の理由を PR に記載
- [ ] CI に lint/format/audit ステップが存在
- [ ] 0.3 共通完了条件

### T-P1-06: 旧仕様 ID のカタログ移植 + トレーサビリティ実効性改善

- 対象指摘: AUD-TRC-001, AUD-TRC-002 / High / M
- 依存: 【解消済み】旧仕様の原本文書は `docs/spec/prjops/` / `docs/spec/devops/` に配置済み。6aを実施可能
- 変更対象: `docs/spec/spec-id-catalog.md`、`packages/traceability/src/verifyTraceability.ts`、`.github/PULL_REQUEST_TEMPLATE.md`

**手順:** (6a) 配置済み原本から REQ-001..035 / TH-001..007 / 旧 AC / 旧 SPEC-INT（SPEC-INT-080 含む）の定義文を新 ID と同じ表形式でカタログへ移植。(6b) verifyTraceability の出力ヘッダと README に「本ゲートは参照存在チェックであり実装保証ではない」を明記し、PR テンプレートのチェック項目を「根拠 ID の要求内容を満たすことをテストで示した」に変更。カタログ未定義 ID の warn 出力を追加（fail 化は P2）。

**完了条件 / 検証:**

- [ ] `grep -c "SPEC-INT-080" docs/spec/spec-id-catalog.md` ≥ 1（6a 完了時）
- [ ] traceability 出力に免責文が含まれる
- [ ] 0.3 共通完了条件

> QUESTION: 2026-07-13 — 6b は `AUD-TRC-001/002` のみを根拠とし、新規 source/test に要求される正規 REQ/SPEC-INT/TH/AC ID が計画・現行カタログにない。旧ID定義は H-04 原本待ちで、ADR-0001/0004 も免責・未定義warningを規定しない。6b用の正規要件/ACを採番してカタログ定義するか、AGENTS.mdでAUD remediation IDをこの種の保守テスト根拠として明示許可するか、HUMAN判断が必要。

### T-P1-07: セキュリティヘッダ / metrics 保護 / レート制限方針

- 対象指摘: AUD-SEC-002, 005, 006 / High+Medium / M
- 変更対象: `packages/web/next.config.mjs`、`packages/server/src/http/app.ts`（/metrics）、`packages/server/src/config.ts`、`runbooks/`（デプロイ要件追記）、テスト

**手順:** (1) next.config.mjs の `headers()` で全ルートに CSP（`default-src 'self'`; Next.js の要求に応じ script-src へ 'unsafe-inline' 等最小限の緩和 — 緩和理由をコメントで明記）、`Strict-Transport-Security`、`X-Content-Type-Options: nosniff`、`frame-ancestors 'none'` 相当を付与。(2) /metrics に `METRICS_TOKEN`（optional config）による Bearer 認証を追加 — 未設定時は現状維持 + 起動時 warn ログ。(3) レート制限は実装せず、`runbooks/production-gates.md` に「前段 LB/WAF でのレート制限必須」をゲート項目として明文化（実装は基盤決定後）。

**完了条件 / 検証:**

- [ ] `curl -s -D- http://localhost:3100/app/login | grep -i content-security-policy` 相当（テストで headers を検証）
- [ ] METRICS_TOKEN 設定時に 401/200 が切り替わるテスト
- [ ] 0.3 共通完了条件

### T-P1-08: .env.example とデプロイパイプライン

- 対象指摘: AUD-OPS-003, 004 / Medium / M
- 依存: 【HUMAN】デプロイ基盤の決定（ADR）。8a は決定前に実施可
- 変更対象: `.env.example`（新規）、`docs/reference/configuration.md`、`.github/workflows/release-image.yml`（新規）

**手順:** (8a) server/web の zod スキーマから全環境変数を必須/任意・説明付きで `.env.example` に書き出し（値はプレースホルダ、実値禁止）、configuration.md と突合して欠落を補完。(8b)【HUMAN 決定後】tag push で `docker build` → ghcr.io へ push するワークフローを追加（Actions は SHA ピン、provenance/attestation 付与）。

**完了条件 / 検証:**

- [ ] config.ts の zod キーと .env.example の項目が 1:1（レビューで突合）
- [ ] 0.3 共通完了条件

### T-P1-09: 脅威モデル文書の新設

- 対象指摘: AUD-SEC-007 / Medium / M
- 変更対象: `docs/spec/threat-model.md`（新規）のみ

**手順:** OWASP LLM Top 10 **v2025** の 10 項目 × 本システムの LLM 経路（AGT-02/03/04/BLD/INC/CHG/page-agent/teamsConversationAgent）の対応表を作成。各セルに「既存対策（実装ファイル参照）/ 対策なし（新規 AUD 候補として列挙）」を記入。加えて外部入力経路（Teams/webhook/xlsx/ingest）の STRIDE 簡易表。**実装変更はしない。** 対策なしセルは文書末尾に「今後の検討」として列挙。

**完了条件 / 検証:**

- [ ] 10×8 の対応表が埋まっている（「該当なし」も可、空欄は不可）
- [ ] 0.3 共通完了条件

### T-P1-10: Excel 取込の運用是正（文書 → UI）

- 対象指摘: AUD-OPM-002, AUD-OPM-015 / High / M
- 変更対象: `docs/guide/excel-import.md`、`packages/web/src/app/dashboard/`（新規アップロード画面）、`packages/web/src/app/api/`（新規プロキシルート）、テスト

**手順:** (10a) 即日: excel-import.md に現行の正確な手順（HMAC 署名が必要でエンジニアが代行する）を明記。(10b) web ダッシュボードに認証必須のアップロード画面を追加: ファイル選択 → サーバサイドで `XLSX_IMPORT_SECRET` により HMAC を付けて server の dry-run へ転送 → エラー全件（sheet/row/column/message）をテーブル表示 → 確認ボタンで execute 転送。web→server 間は既存 HMAC を流用（シークレットは web サーバサイドのみが保持、ブラウザへ渡さない）。(10c) `GET /xlsx-import/template` の公開ルートを廃止し、ダッシュボード内ダウンロードに移設。

**完了条件 / 検証:**

- [ ] 非認証で /xlsx-import/template にアクセスすると 404/401
- [ ] アップロード画面のハンドラテスト（dry-run 表示 → execute）が green
- [ ] 0.3 共通完了条件

### T-P1-11: investor-quarterly ケイデンス + coding-agent ガード + confirm TTL

- 対象指摘: AUD-OPM-004, 003, 007 / High+Medium / M
- 依存: T-P0-13（TTL 関数）
- 変更対象: `.github/workflows/report-generation.yml`、`packages/server/src/scheduler/tasks/reportDeliveryTask.ts`、`.github/actions/run-coding-agent/action.yml`、`.github/workflows/coding-task.yml`、`packages/server/src/http/routes/codingTasks.ts`、`packages/server/src/agents/teamsConversationAgent.ts`（リンク生成）、runbooks/observability-slo.md、テスト

**手順:** (11a) report-generation.yml に四半期 cron（1/4/7/10 月の 1 日 22:00 UTC = JST 翌 07:00）+ `investor-quarterly` 生成入力を追加。配信側は `isQuarterStartMonth` + `isNthBusinessDayOfMonth(cal, today, 1)`（businessCalendar 実装済み）で四半期初営業日に investor-quarterly を配信対象化。SLO「四半期末 +45 日以内」を observability-slo.md に追記。(11b) coding-task.yml の agent 実行ステップに job `timeout-minutes: 30` と `concurrency: coding-task-${{ inputs.task_id }}` を追加。action.yml の claude 呼び出しへ `--max-turns 50` と `--allowedTools` の明示（Read/Grep/Glob/Edit/Write/Bash を作業ディレクトリ限定で許可 — claude CLI の現行フラグ仕様を確認し、確認できない場合は QUESTION で停止）。instruction は dispatch 前に `sanitizeForLlmInput` 済みであることを teamsConversationAgent 側で確認（未実施なら追加）。(11c) coding-task の確認リンクを T-P0-13 の `generateExpiringToken`（TTL 24h）に切替え。既存 `verifyConfirmToken` は互換のため残すが新規発行は expiring のみ。

> QUESTION 2026-07-13 / T-P1-11a: 指定 cron `0 22 1 1,4,7,10 *` は JST では四半期初月の 2 日 07:00 であり、厳密な第1営業日が1日の場合は生成前に配信 gate を逃す。さらに現行 `reportIngest.ts` / `index.ts` は scheduler gate を経ず即時配信するため、scheduler だけの営業日判定では契約を強制できない。生成を前日 UTC へ移すか、配信を「生成後最初の営業日」とするか、全 delivery entry point をどの境界へ統合するか HUMAN が裁定するまで 11a を停止する。
>
> QUESTION 2026-07-13 / T-P1-11b: ローカル Claude Code 2.1.206 は `--allowedTools` / `--tools` / `--add-dir` を公開するが、計画記載の `--max-turns` と generic Bash を現在作業ディレクトリ内へ閉じ込める path rule を公開していない。`--add-dir` は権限を拡張するため代替にならない。CLI/version または sandbox 契約が確定するまで action.yml のフラグ変更を停止し、concurrency と dispatch 前サニタイズだけを独立適用する。

**完了条件 / 検証:**

- [ ] 四半期初営業日の配信ゲートのユニットテストが green
- [ ] coding-task.yml に timeout/concurrency、action.yml に max-turns/allowedTools が存在
- [ ] TTL 超過リンクで 401 になるテスト
- [ ] 0.3 共通完了条件

### T-P1-12:【HUMAN】Exchange RBAC for Applications の適用

- 対象指摘: AUD-OPM-008 / Medium / S
- 内容:【HUMAN】Exchange Online 管理で管理スコープを FROM_MAILBOX のサービスメールボックスに限定する role assignment を作成。エージェント支援: `runbooks/report-delivery.md` に設定手順（New-ManagementScope / New-ManagementRoleAssignment のコマンド例と検証方法）を追記する（これはエージェント実行可）。
- 完了条件:
- [x] runbook に手順が追記されている — PR: https://github.com/mryfmo/ai-ops-platform/pull/62（immutable mailbox ID scope、unscoped Mail.Send 個別除去、正負テスト・rollback・証跡。独立レビュー ACCEPT）
- [ ] 【HUMAN】テナントで適用され、確認日が runbook に記録されている

---

## 4. Phase 2（90 日以内）

### T-P2-01: マルチペルソナ切替と検証

- 対象指摘: AUD-IMP-006 / Medium / M
- 変更対象: `packages/web/src/server/chat/chatHandler.ts`、`tools.ts`、`dashboard/page.tsx`、`authGuard`/`dataApiSupport`、テスト
- 手順: セッションに選択ペルソナを保持する UI（ヘッダのセレクタ）を追加し、サーバ側で「申告ペルソナ ∈ 保有ペルソナ」を全 API で検証（不一致は 403）。`personas[0]!` の 3 箇所を選択値参照に置換。
- 完了条件:
- [ ] `grep -rn "personas\[0\]" packages/web/src` → 0 件
- [ ] 不正ペルソナ申告が 403 になるテスト
- [ ] 0.3 共通完了条件

### T-P2-02: LLM コスト最適化（prompt caching）と JST 集約

- 対象指摘: AUD-REL-004, AUD-REL-007 / Medium / M
- 手順: anthropicClient の system/tools ブロックへ `cache_control` を付与し、usage の cache\_\* フィールドを llm_usage 記録に追加。JST 計算（ids.ts:118 等の +9h 手計算）を pgCostGuard の実装を正として shared の 1 モジュールに集約し、他は参照に置換。
- 完了条件:
- [ ] cache_read/cache_creation が記録されるテスト
- [ ] `grep -rn "9 \* 60 \* 60 \* 1000\|+9" packages/shared/src --include="*.ts"` の日時演算が 1 モジュールのみ
- [ ] 0.3 共通完了条件

### T-P2-03: テストフレームワーク・zod の段階更新

- 対象指摘: AUD-DEP-005 / Medium / M
- 手順: vitest 2→3 を全パッケージで更新し ci green を確認、その後 3→4。zod は `zod/v3` サブパス併用の公式段階移行で v4 へ（パッケージ毎に PR 分割可）。**1 PR で複数メジャーを跨がない。**
- 完了条件:
- [x] vitest 4 系 / zod 4 系で `mise run ci` green — PR #65〜#69 の段階stack。最終段で全workspace Zod 4.4.3単一解決、109 files / 885 tests green、独立否定レビューACCEPT

### T-P2-04: トレーサビリティのゲート強化

- 対象指摘: AUD-TRC-003, 004, 005 / Medium / M
- 依存: T-P1-06
- 手順: (a) 現状の missingFromTest を棚卸しして 0 にする（テスト追加 or 免除リスト+理由）、(b) AC をゲート対象に追加、(c) matrix を CI アーティファクト生成にし、コミット版に生成コミット SHA を埋める、(d) カタログ未定義 ID の fail 化（T-P1-06 の warn を昇格）。
- 完了条件:
- [ ] missingFromTest ゲートが有効で ci green
- [ ] 0.3 共通完了条件

### T-P2-05: 負荷測定と検証文書の整備

- 対象指摘: AUD-VER-004, 006, 007 / Medium / M
- 手順: (a) k6 等で「配信 2000 通/2h 相当」（送信はモック SMTP/Graph スタブ環境）と「ingest→dispatch 5 分以内」を単発測定し `verification/` に記録、(b) web データ API へ 500 リクエスト連投し DB 接続数が一定であることを確認（T-P0-01 の実測検証）、(c) VERIFICATION_REPORT の 359/750 の関係を定義し直し件数を生成物参照に変更、(d) traceability パッケージに fail 系テスト 2 件を追加。
- 完了条件:
- [x] 測定結果が verification/ にコミットされている
- [x] 0.3 共通完了条件

### T-P2-06: 秘密検出・サプライチェーンの強化

- 対象指摘: AUD-SEC-008, 010 / Medium+Low / M
- 手順: (a) secretSanitizer の SECRET_PATTERNS を注入拡張可能にし（既定は現行 10 パターン）、長さ 32 以上の連続 base64/hex への警告マスクをオプションで追加、(b) `.gitleaks.toml` を新設し既存 allowlist を集約、pre-commit フック（gitleaks protect --staged、バージョンは CI と同一固定）を導入し README に記載。
- 完了条件:
- [ ] 既存テストが green のまま拡張ポイントが存在
- [ ] pre-commit で疑似シークレットがブロックされる手動確認を PR に記録
- [ ] 0.3 共通完了条件

### T-P2-07: 運用モデルの残整備

- 対象指摘: AUD-OPM-009, 010, 011, 012, 013, AUD-OPS-006 / Medium / L（サブタスク分割で実施）
- 手順（各サブタスクを独立 PR で）:
  - **07a** 配信 heartbeat: 配信サイクル成功時に `HEARTBEAT_URL`（optional config）へ GET する 1 フック + 未設定時 no-op。恒久失敗配信の再送 runbook を追加。
  - **07b** recipients 運用: 追加/無効化の SQL 手順 runbook 化 → ステークホルダーマスタ（T-P0-10 の供給元）から recipients を一方向同期するスケジューラタスク（disabled+audited パターン）。
  - **07c** Excel EUC 統制: テンプレートに版数セル（生成時埋込・取込時検証・不一致は全件拒否 E-XLS 系新コード）、dry-run/execute 結果の人間可読サマリ、提出ファイルの保管（audit ログに SHA-256 記録）。
  - **07d** レポート保持: standard_reports への UPDATE/DELETE を T-P0-06 と同型のトリガで禁止（承認列の UPDATE は T-P0-14 の列のみ許可する列指定トリガ）、保持年限（投資家向け 7 年基準）を `docs/spec/data-model.md` に規定、report JSON に生成時テンプレート版（git SHA）を埋込。
  - **07e** RACI: `runbooks/roles.md` を新設（08 監査 §2.6 の 4 役割 + 実名/グループは `TBD(HUMAN)`）。
  - **07f** シークレットローテーション: 全 secret（Graph client secret / Anthropic key / 各 HMAC secret / AUTH_SECRET）のローテーション手順と周期を runbook 化（AUD-OPS-006。基盤依存箇所は `TBD(HUMAN)`）。

> **QUESTION (2026-07-13 / T-P2-07c):** Excel テンプレート版数の採番規則と更新承認者が正本に未定義。実装は初期技術スキーマ版 `1` とするが、次回以降の版上げ判断主体・互換期間は HUMAN が確定してください。

- 完了条件:
- [ ] 07a〜07e 各サブタスクの PR が個別に ci green
- [ ] 0.3 共通完了条件

### T-P2-08: AGT-04 プロファイル横断化・週次デルタ・残件

- 対象指摘: AUD-IMP-005, 007, 008, 009 / Medium+Low / L
- 手順: (a) AGT-04 の文章スロット結線をプロファイル定義データ駆動に一般化（narrativeSanitizer は無変更で再利用）、(b) AGT_RPT の `deltaVsPrevWeek` を report_snapshots の前週値から算出し、算出不能時は 0 でなく N/A 表示に変更、(c) incidentBurndown のレポート表示に「暫定集計」注記、(d) viewSpec の未実装データ種別を zod スキーマから除外。
- 完了条件:
- [ ] `grep -n "deltaVsPrevWeek" packages/devops/src/agents/AGT_RPT.ts` がハードコード 0 でない
- [ ] 0.3 共通完了条件

> QUESTION: 2026-07-13 — `report_snapshots` はDDLだけで、metrics shape・scope/key・期間境界・repository・producer・AGT_RPT本番callerが存在しない。「前週値から算出」には (A) 正本となるsnapshot契約/producer/repository/callerを本タスクへ追加し各semanticsを定義するか、(B) agent境界へtyped optional prior-week snapshotを注入して現時点はN/Aとするか、HUMAN裁定が必要。
>
> QUESTION: 2026-07-13 — 現行ViewSpecはzod discriminated unionではなくTS unionで、6 kindすべてがDashboardClient/tool/UIに実装・テスト済み。削除対象の未実装 kind/tool の正確な一覧が必要。
>
> QUESTION: 2026-07-13 — `incidentBurndown` はDevOps Web dataでのみ使用されAGT_RPT/templateに経路がない。「暫定集計」注記をDevOps Web manager summaryだけへ付けるのか、AGT_RPTへburndown field/sectionを新設するのか決定が必要。
>
> QUESTION: 2026-07-13 — AGT-04はPRF-04実装だけで本番callerもなく、PRF-01..05のprofile別narrative slot/prompt/fallback定義が正本にない。既存narrative-bearing PRF-03/04/05だけの最小configを許可するか、全profileのslot定義を提供する必要がある。

---

## 5. HUMAN タスク一覧（エージェント実行不可、ブロッカー）

| ID   | 内容                                                            | ブロックされるタスク                   |
| ---- | --------------------------------------------------------------- | -------------------------------------- |
| H-01 | GitHub プラン変更/org 移管 + branch protection 設定             | T-P0-08 後続、パイロット開始           |
| H-02 | バックアップ方式の決定（ADR 承認）                              | T-P0-09 の確定、T-P0-12 のリストア演習 |
| H-03 | 実環境 E2E の実施主体・環境準備（テナント、DB、Teams 管理権限） | T-P0-12                                |
| H-04 | 旧仕様 ID 原本文書の提供                                        | T-P1-06a                               |
| H-05 | デプロイ基盤の決定（ADR 承認）                                  | T-P1-08b、T-P1-07 のレート制限実装     |
| H-06 | Exchange RBAC for Applications のテナント適用                   | T-P1-12                                |
| H-07 | T-P0-10b の PrjOps データ供給元の裁定（QUESTION 発生時）        | T-P0-10c 以降                          |
| H-08 | 各 PR のレビューとマージ（自動マージ禁止）                      | 全タスク                               |

---

## 6. 進捗トラッキング（総覧チェックリスト）

実行エージェントは各タスク完了時に本節のボックスを更新し、PR URL を追記すること。

### Phase 0

- [x] T-P0-01 web プールシングルトン化（AUD-REL-001） — PR: https://github.com/mryfmo/ai-ops-platform/pull/63
- [x] T-P0-02 Node 22 / pnpm 10（AUD-DEP-001, 002） — PR: https://github.com/mryfmo/ai-ops-platform/pull/41（#40 上の draft stack）
- [x] T-P0-03 Docker ハードニング（AUD-SEC-003） — PR: https://github.com/mryfmo/ai-ops-platform/pull/53（#41 上の draft stack。Docker build/run は QUESTION）
- [x] T-P0-04 GitHub App 認証（AUD-IMP-001, SEC-009） — PR: https://github.com/mryfmo/ai-ops-platform/pull/43（#40 上の draft stack）
- [x] T-P0-05 SAMPLE_STAKEHOLDERS 排除（AUD-IMP-003） — PR: https://github.com/mryfmo/ai-ops-platform/pull/45（#43 上の draft stack）
- [x] T-P0-06 audit_log トリガ強制（AUD-SEC-004） — PR: https://github.com/mryfmo/ai-ops-platform/pull/42（#40 上の draft stack）
- [x] T-P0-07 タイムアウト + GitHub バックオフ（AUD-REL-002, 003） — PR: https://github.com/mryfmo/ai-ops-platform/pull/52（#43 上の draft stack）
- [ ] T-P0-08 【HUMAN】branch protection（AUD-SEC-001） — 証跡:
- [x] T-P0-09 アラートルール + バックアップ ADR 草案（AUD-OPS-001, 002） — PR: https://github.com/mryfmo/ai-ops-platform/pull/44（実方式・値の確定は HUMAN gate）
- [ ] T-P0-10 PrjOps データ供給（AUD-IMP-002） — PR: https://github.com/mryfmo/ai-ops-platform/pull/68（10a YAML stakeholder provider完了。10b〜10dはH-07待ち）
- [ ] T-P0-11 PrjOps スケジューラ結線（AUD-IMP-004） — PR:
- [ ] T-P0-12 【HUMAN 主導】実環境 E2E（AUD-VER-003, OPM-006, OPM-014） — 証跡:
- [ ] T-P0-13 承認判断エンドポイント（AUD-OPM-001） — PR:
- [ ] T-P0-14 レポート承認ゲート（AUD-OPM-005） — PR:

### Phase 1

- [x] T-P1-01 claudeAgentClient テスト（AUD-VER-001） — PR: https://github.com/mryfmo/ai-ops-platform/pull/46
- [x] T-P1-02 AGT-02/03/04 テスト（AUD-VER-002） — PR: https://github.com/mryfmo/ai-ops-platform/pull/71（Unicode/秘密/数量/監査境界と線形性能を複数回の独立否定レビュー後に ACCEPT）
- [x] T-P1-03 Anthropic SDK 更新（AUD-DEP-003） — PR: https://github.com/mryfmo/ai-ops-platform/pull/72（PR #69 上の draft。Agent SDK 0.3 の `tools` 意味変更を fail-closed 修正。PR #46/#71 統合後の再 gate を merge 条件として明記）
- [x] T-P1-04 モデル/価格 config 化（AUD-DEP-006, REL-006） — PR: https://github.com/mryfmo/ai-ops-platform/pull/73（PR #72 上の draft。未知モデル監査 fail-closed、UTF-8/件数/価格/算術境界を独立否定レビュー済み）
- [x] T-P1-05 CI 強化 + 脆弱性 4 件（AUD-VER-005, DEP-004） — PR: https://github.com/mryfmo/ai-ops-platform/pull/60（4件→2件、high/critical 0。uuid moderate / provider-utils lowは互換修正版不在の理由をPR記録）
- [ ] T-P1-06 仕様カタログ移植 + ゲート免責（AUD-TRC-001, 002） — PR:
- [x] T-P1-07 ヘッダ/CSP/metrics 保護（AUD-SEC-002, 005, 006） — PR: https://github.com/mryfmo/ai-ops-platform/pull/50（LB/WAF 実設定は HUMAN gate）
- [ ] T-P1-08 .env.example + リリース WF（AUD-OPS-003, 004） — PR: https://github.com/mryfmo/ai-ops-platform/pull/48（`.env.example` 完了、release WF はデプロイ基盤決定待ち）
- [x] T-P1-09 脅威モデル文書（AUD-SEC-007） — PR: https://github.com/mryfmo/ai-ops-platform/pull/47
- [x] T-P1-10 Excel 文書是正 + アップロード UI（AUD-OPM-002, 015） — PR: https://github.com/mryfmo/ai-ops-platform/pull/59（#56 上の draft stack）
- [ ] T-P1-11 四半期ケイデンス + agent ガード + TTL（AUD-OPM-003, 004, 007） — PR: https://github.com/mryfmo/ai-ops-platform/pull/74（11b partial: task-id concurrency + dispatch 前サニタイズ、hosted CI green。11a/CLI flags/11c は上記 QUESTION と T-P0-13 待ち）
- [ ] T-P1-12 【HUMAN】Exchange RBAC + runbook（AUD-OPM-008） — PR: https://github.com/mryfmo/ai-ops-platform/pull/62（runbook 完了。実テナント適用・確認日は HUMAN gate）

### Phase 2

- [x] T-P2-01 マルチペルソナ（AUD-IMP-006） — PR: https://github.com/mryfmo/ai-ops-platform/pull/58
- [x] T-P2-02 prompt caching + JST 集約（AUD-REL-004, 007） — PR: https://github.com/mryfmo/ai-ops-platform/pull/57（実 PostgreSQL migration 適用は merge 前の human/environment gate）
- [x] T-P2-03 vitest/zod 更新（AUD-DEP-005） — PR: https://github.com/mryfmo/ai-ops-platform/pull/61（段階1 Vitest 2→3）、https://github.com/mryfmo/ai-ops-platform/pull/64（段階2 Vite 5→6準備）、https://github.com/mryfmo/ai-ops-platform/pull/65（段階3 Vitest 3→4）、https://github.com/mryfmo/ai-ops-platform/pull/66（段階4 server Zod 4.4.3）、https://github.com/mryfmo/ai-ops-platform/pull/67（段階5 web Zod 4.4.3）、https://github.com/mryfmo/ai-ops-platform/pull/69（段階6 shared/prjops/devops Zod 4.4.3、#67 上の draft）
- [ ] T-P2-04 トレーサビリティ強化（AUD-TRC-003, 004, 005） — PR:
- [x] T-P2-05 負荷測定 + 検証文書（AUD-VER-004, 006, 007） — PR: https://github.com/mryfmo/ai-ops-platform/pull/70（PR #63 上の draft。実 PostgreSQL 500 リクエスト、接続数、DDL 確認ゲート、traceability 負系、SHA 証跡を独立レビュー済み）
- [x] T-P2-06 秘密検出 + gitleaks 強化（AUD-SEC-008, 010） — PR: https://github.com/mryfmo/ai-ops-platform/pull/54
- [ ] T-P2-07 運用残整備 07a〜07f（AUD-OPM-009〜013, AUD-OPS-006） — PR: https://github.com/mryfmo/ai-ops-platform/pull/55（07a）、https://github.com/mryfmo/ai-ops-platform/pull/56（07c）、https://github.com/mryfmo/ai-ops-platform/pull/49（07e）、https://github.com/mryfmo/ai-ops-platform/pull/51（07f。T-P1-07 統合時に METRICS_TOKEN 追記必須）、07b・07d 未完
- [ ] T-P2-08 AGT-04 横断化ほか（AUD-IMP-005, 007, 008, 009） — PR:

### 対応しない指摘（明示的スコープ外 — 実装しないこと）

- AUD-REL-005（JsonlAuditLog）: 本番経路は PgAuditLog で問題なし。ヘッダに「開発・検証用」を明記する軽微対応は T-P2-07 のいずれかに同乗可。
- AUD-DEP-007（exceljs）: 乗り換えは行わない。ADR-0008 への前提劣化の追記のみ（T-P2-07c に同乗）。
- AUD-DEP-008 の ai SDK v7 / next-auth 正式版 / TS 6: 四半期棚卸しの定例判断に委ねる（本計画では更新しない）。
- AUD-OPS-005 のコンテナ分離: ADR-0005 への制約追記のみ（T-P0-03 の PR に同乗可）。分離実装は行わない。
- AUD-OPS-007（パイロット運用）: 開発作業ではなく運用イベント。P0 完了後に HUMAN が開始する。

---

## 7. 全体完了の定義

- [ ] Phase 0 全タスク完了 + H-01〜H-03 完了 → 「本番投入可能」
- [ ] Phase 1 全タスク完了 → 「安心して運用可能」
- [ ] Phase 2 全タスク完了 + パイロット開始 → 「持続的に維持可能」
- [ ] 最終確認: `docs/audit/00-summary.md` の Critical/High 全 27 件に対応 PR/証跡が紐づいている
