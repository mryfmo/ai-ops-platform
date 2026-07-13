# 02. 外部連携・耐障害性 監査レポート

- 監査日: 2026-07-11 / 監査対象コミット: `39b95944e9f17dffce500c21f40989f6fa86092d`
- 監査観点: 「実装は存在するが、本番の負荷・遅延・部分障害の下で壊れるもの」。未実装そのものは [01-unimplemented](01-unimplemented.md)。

## 1. 対象範囲と監査観点

packages/shared の外部クライアント 4 種（GitHub / Microsoft Graph / Anthropic / Claude Agent SDK）、web のデータアクセス、監査ログ実装、決定的ロジックの重複を対象に、タイムアウト・リトライ・レート制限・並行安全性・リソースリークを精査。

## 2. あるべき姿（出典付き）

- GitHub API: `x-ratelimit-remaining/reset` の監視、429/403 の `retry-after` 準拠、セカンダリリミット対策として mutation は直列 + 1 秒以上間隔、即時リトライ禁止（出典: https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api 、確認日 2026-07-11）
- Microsoft Graph: 429 は `Retry-After` 尊重（実装済み）、通知応答は 3 秒以内に 2xx（出典: https://learn.microsoft.com/en-us/graph/throttling 、https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks 、確認日 2026-07-11）
- Anthropic API: 公式 SDK デフォルトは自動リトライ 2 回（408/429/5xx、指数バックオフ）+ タイムアウト 10 分。429 の `retry-after` ヘッダ尊重、`anthropic-ratelimit-*-remaining` 監視による事前シェディング、大出力はストリーミング（出典: https://platform.claude.com/docs/en/api/rate-limits 、https://platform.claude.com/docs/en/api/errors 、確認日 2026-07-11）
- すべての外部 HTTP 呼び出しに上限時間（AbortSignal）を設けることは Node.js サービスの一般的最低線（fetch はデフォルト無期限）。

## 3. 指摘事項サマリ

| ID          | タイトル                                                                     | Severity | 工数 |
| ----------- | ---------------------------------------------------------------------------- | -------- | ---- |
| AUD-REL-001 | web API ルートがリクエスト毎に pg.Pool を生成し解放しない                    | Critical | S    |
| AUD-REL-002 | 全外部クライアントにリクエストタイムアウトが存在しない                       | High     | M    |
| AUD-REL-003 | GitHubClient にリトライ/バックオフ/レート制限対応が皆無（SPEC-INT-080 違反） | High     | M    |
| AUD-REL-004 | Anthropic 呼び出しがストリーミング・prompt caching・レート制限ヘッダを未活用 | Medium   | M    |
| AUD-REL-005 | JsonlAuditLog が並行安全でない（read-all-then-append）                       | Medium   | S    |
| AUD-REL-006 | LLM 価格表・トークン見積りのハードコード                                     | Medium   | S    |
| AUD-REL-007 | JST +9h のオフセット手計算が複数ファイルに重複                               | Low      | S    |

## 4. 個別指摘

### AUD-REL-001: web API ルートがリクエスト毎に pg.Pool を生成し解放しない

| Severity | 工数 | 関連仕様                           | 関連指摘    |
| -------- | ---- | ---------------------------------- | ----------- |
| Critical | S    | 仕様不在（接続管理の仕様 ID なし） | AUD-OPS-005 |

**現状**: chat + data 系の全 7 ルートが handler 内で `const pool = new pg.Pool({...})` を実行し、`pool.end()` を呼ばない。`force-dynamic` のためリクエスト毎に新規プールが生成され、接続はアイドルタイムアウトまで残留する。
**根拠**: `packages/web/src/app/api/chat/route.ts:33`、`packages/web/src/app/api/data/{investor-summary:22,agent-activity:24,manager-summary:36,executive-summary:29,projects:26,timeseries:24}/route.ts`（grep で 7 箇所確認済み）
**あるべき姿**: プロセス単位のシングルトンプール（Next.js ではモジュールスコープ or globalThis キャッシュが定石）。PostgreSQL はプロセス/接続モデルのため接続増加が直接サーバ資源を食う。
**ギャップ**: 少数ユーザーでも連続閲覧で `max_connections` を枯渇させ、server 側常駐プールも巻き添えで接続不能になる。負荷試験なしでは顕在化せず、本番で最初に踏む障害。
**推奨対応**: 最小是正 = `lib/dbPool.ts` にモジュールスコープのプールを 1 つ作り全ルートで共有（数行の差分）。恒久策 = インスタンス数が増えたら PgBouncer（transaction mode）を前段に（出典: https://www.percona.com/blog/pgbouncer-for-postgresql-how-connection-pooling-solves-enterprise-slowdowns/ 、確認日 2026-07-11）。

### AUD-REL-002: 全外部クライアントにリクエストタイムアウトが存在しない

| Severity | 工数 | 関連仕様                                                        | 関連指摘    |
| -------- | ---- | --------------------------------------------------------------- | ----------- |
| High     | M    | 仕様不在（タイムアウト要求の仕様 ID なし — それ自体が仕様の穴） | AUD-REL-003 |

**現状**: `packages/shared/src/clients/` 全体で `AbortController` / `AbortSignal` の使用が 0 件（grep 確認済み）。githubClient / graphClient / claudeAgentClient は素の `fetchImpl` で、ハングしたソケットを打ち切る手段がない。graphClient のバックオフは最大 15 分待つが、その間ソケットは開きっぱなし。anthropicClient は注入された公式 SDK のデフォルト（10 分）に暗黙依存し、明示設定がない。
**根拠**: `packages/shared/src/clients/*.ts`（grep 0 件）、`graphClient.ts:159-160`
**あるべき姿**: 全 HTTP 呼び出しに用途別の明示タイムアウト（Webhook 応答系は秒単位、レポート配信系は数十秒、LLM は SDK の timeout オプションを明示）。公式 Anthropic SDK は timeout/maxRetries をコンストラクタで受ける。
**ギャップ**: 上流 1 系統のハングが常駐スケジューラのタスク（直列実行）を無期限に塞ぎ、SLO「scheduler task success 99.5%」を静かに割る。
**推奨対応**: FetchLike 注入パターンを活かし、`AbortSignal.timeout(ms)` を付与するラッパ fetch を共通化して全クライアントに注入。デフォルト値は config 化。

### AUD-REL-003: GitHubClient にリトライ/バックオフ/レート制限対応が皆無

| Severity | 工数 | 関連仕様                                                                                                                                                   | 関連指摘    |
| -------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| High     | M    | **SPEC-INT-080 違反**（「GitHub/Graph API レート制限（429）は指数バックオフ（初期 30 秒、最大 15 分）」— graphClient.ts:13 に引用あり。GitHub 側は未実装） | AUD-TRC-004 |

**現状**: githubClient.ts に backoff / Retry-After の処理が 0 件（grep 確認済み）。全メソッドが素の fetch + `if(!res.ok) throw`。`getGraphqlRateLimit` は存在するが誰も消費しない。セカンダリリミット対策（mutation 直列 + 間隔）もない。
**根拠**: `packages/shared/src/clients/githubClient.ts` 全体、対比: `graphClient.ts:242`（fetchWithBackoff）
**あるべき姿**: 仕様（SPEC-INT-080）どおり GitHub にも指数バックオフ。公式ガイダンスは retry-after 準拠 + 即時リトライ禁止 + mutation 直列化（出典: https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api 、確認日 2026-07-11）。
**ギャップ**: Projects v2 スナップショットのページング取得や配信バーストで 429/secondary limit を踏むと即時失敗し、リトライなしでタスク失敗が確定する。仕様に対する明確な実装漏れ。
**推奨対応**: graphClient の `fetchWithBackoff` を shared 共通ユーティリティに昇格して githubClient に適用（既存実装の再利用で足りる）。x-ratelimit-remaining の事前チェックは pmSnapshotReconcileTask の既存予算チェックを共通化。

### AUD-REL-004: Anthropic 呼び出しがストリーミング・prompt caching・レート制限ヘッダを未活用

| Severity | 工数 | 関連仕様                                            | 関連指摘    |
| -------- | ---- | --------------------------------------------------- | ----------- |
| Medium   | M    | ADR-0002 の範囲内だが運用最適化が仕様化されていない | AUD-DEP-006 |

**現状**: AnthropicStructuredClient は非ストリーミング固定・prompt caching 未使用・`anthropic-ratelimit-*` ヘッダ未監視。リトライは論理 attempt ループ（maxAttempts=2）+ SDK 内蔵リトライへの暗黙依存の二重構造で、429 の retry-after 待機は SDK 任せ。
**根拠**: `packages/shared/src/clients/anthropicClient.ts:114-150`
**あるべき姿**: システムプロンプト/ツール定義の prefix caching（読み取りは約 0.1 倍課金かつ ITPM 制限に不算入）、レート制限ヘッダによる事前シェディング（出典: https://platform.claude.com/docs/en/build-with-claude/prompt-caching 、https://platform.claude.com/docs/en/api/rate-limits 、確認日 2026-07-11）。
**ギャップ**: コストガードは精緻（reserve/reconcile）だがコスト削減側の手段が未使用。構造化出力は小出力なのでストリーミングは必須ではない — caching とヘッダ監視が実利。
**推奨対応**: system/tools ブロックへ `cache_control` 付与（数行）。usage の cache\_\* フィールドを llm_usage に記録。

### AUD-REL-005: JsonlAuditLog が並行安全でない

| Severity | 工数 | 関連仕様                                               | 関連指摘    |
| -------- | ---- | ------------------------------------------------------ | ----------- |
| Medium   | S    | 設計原則 5（監査ログ追記専用）の完全性が並行時に破れる | AUD-SEC-004 |

**現状**: `JsonlAuditLog.append` が log_id 採番のため毎回全行を読み直してから追記する（read-then-append の競合窓 + O(n)/write）。並行 append で ID 重複・欠番が起こり得る。
**根拠**: `packages/shared/src/auditLog.ts`（JsonlAuditLog 実装）
**あるべき姿**: 本番は PgAuditLog（シーケンス採番、確認済み）を使う前提を明文化し、JsonlAuditLog は開発用と宣言する。または採番を uuid/時刻+乱数にして追記のみで完結させる。
**推奨対応**: 最小是正 = ヘッダに「開発・検証用。本番禁止」を明記 + server 側で誤結線できない型に。恒久策不要（本番経路は Pg 実装で問題なし）。

### AUD-REL-006: LLM 価格表・トークン見積りのハードコード

| Severity | 工数 | 関連仕様 | 関連指摘    |
| -------- | ---- | -------- | ----------- |
| Medium   | S    | —        | AUD-DEP-006 |

**現状**: `PRICING_USD_PER_MTOK` が 2026-07 時点の値でハードコードされ、未知モデルは Sonnet 価格に silent fallback。トークン見積りは `ceil(len/4)+256` の文字数ヒューリスティック。価格改定・モデル追加で予算制御が静かに狂う。
**根拠**: `packages/shared/src/clients/anthropicClient.ts:80-87`
**あるべき姿**: 価格は設定ファイル化し、レスポンスの `usage` 実測値で reconcile する現行方式を正とする（reserve 時の見積り誤差は許容）。未知モデルは fallback ではなく監査ログ付き警告。
**推奨対応**: 価格表を config/yaml へ外出し + 未知モデル時に warn ログ。reconcile は実装済みなので実害は reserve 側の予約精度のみ。

### AUD-REL-007: JST +9h のオフセット手計算が複数ファイルに重複

| Severity | 工数 | 関連仕様 | 関連指摘 |
| -------- | ---- | -------- | -------- |
| Low      | S    | —        | —        |

**現状**: `+9h` の日時計算が ids.ts:118 / businessCalendar.ts / pgCostGuard.ts に重複。JST は DST がないため現状は正しいが、単一箇所に集約されていないと将来の変更が漏れる。
**推奨対応**: shared に `jstNow()/jstDayRange()` 系を集約（pgCostGuard の実装を正として他が参照）。

## 5. 良好事項

- graphClient の `fetchWithBackoff`（指数バックオフ + ジッタ + Retry-After 尊重 + 冪等/非冪等の区別）は公式ガイダンスに合致し、SPEC-INT-080 を満たす。AUD-REL-003 の是正はこの実装の横展開で済む。
- Graph webhook は validationToken ハンドシェイク・clientState 検証・即時 202 応答・delta query 併用と、公式の推奨形どおり。
- PgCostGuard の advisory lock + reserve/reconcile はレースに強く、web チャットの 429 応答（予算超過時）まで結線済み。
- server の pg.Pool は接続タイムアウト・statement_timeout・idle_in_transaction タイムアウトを config で持つ（web 側 AUD-REL-001 との対比で、正しい形がリポジトリ内に既にある）。
