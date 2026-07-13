# 06. 運用・デプロイ 監査レポート

- 監査日: 2026-07-11 / 監査対象コミット: `39b95944e9f17dffce500c21f40989f6fa86092d`
- 監査観点: 「デプロイして、壊れたことに気づき、直し、データを失わない」ための装備が揃っているか。

## 1. 対象範囲と監査観点

Dockerfile / デプロイ経路 / 環境変数管理 / バックアップ / アラート / 可用性構成 / リリース基準。Docker のセキュリティ属性（root・全ソース同梱）は [03-security](03-security.md) AUD-SEC-003 に置き、ここでは運用属性のみ扱う。

## 2. あるべき姿（出典付き）

- バックアップ: base backup + WAL 継続アーカイブによる PITR が本番 PostgreSQL の最低線。リストア演習込み（出典: https://www.postgresql.org/docs/current/continuous-archiving.html 、確認日 2026-07-11）
- アラート: SLO を定義したらエラーバジェットの burn-rate（multi-window multi-burn-rate）で symptom に対して発報する（出典: https://sre.google/workbook/alerting-on-slos/ 、確認日 2026-07-11）
- デプロイ: ビルド → イメージ発行 → 配備が再現可能なパイプラインであること（手元ビルドの持ち込みは事故時に再現不能）
- 設定: 必須環境変数の一覧が実行可能な形（.env.example / 検証スクリプト）で提供されること

## 3. 指摘事項サマリ

| ID          | タイトル                                                    | Severity | 工数 |
| ----------- | ----------------------------------------------------------- | -------- | ---- |
| AUD-OPS-001 | バックアップ / PITR / リストア手順が存在しない              | High     | M    |
| AUD-OPS-002 | SLO 3 件に対しアラートルール実体が 0 件                     | High     | S    |
| AUD-OPS-003 | デプロイパイプライン・イメージ発行・IaC が存在しない        | Medium   | M    |
| AUD-OPS-004 | .env.example がなく必須環境変数 30 個超がコード内にのみ存在 | Medium   | S    |
| AUD-OPS-005 | 単一コンテナ 2 プロセス構成が可用性の単一障害点             | Medium   | M    |
| AUD-OPS-006 | シークレットマネージャ統合がなく env 直渡しのみ             | Low      | S    |
| AUD-OPS-007 | リリース基準（パイロット運用・90 日メトリクス）が未着手     | Medium   | L    |

## 4. 個別指摘

### AUD-OPS-001: バックアップ / PITR / リストア手順が存在しない

| Severity | 工数 | 関連仕様                                            | 関連指摘    |
| -------- | ---- | --------------------------------------------------- | ----------- |
| High     | M    | 設計原則 5（監査ログ 5 年保持）の物理的裏付けが不在 | AUD-SEC-004 |

**現状**: リポジトリ・runbooks のどこにもバックアップ設定・スクリプト・リストア手順がない。audit_log は 5 年保持を掲げ retention 関数まで実装されているのに、DB 消失時に守る手段がない。監査証跡は「絶対に失えないデータ」の筆頭であり、保持ポリシーとバックアップ不在は矛盾する。
**根拠**: リポジトリ全体 grep（backup/pg_basebackup/pgbackrest 0 件）、`runbooks/` 一覧
**あるべき姿**: マネージド DB なら自動バックアップ + PITR 有効化を要件として明記、自前運用なら pgBackRest 等の構成。いずれもリストア演習の記録が必要。
**推奨対応**: 最小是正 = runbooks/backup-restore.md を新設し、想定 DB 基盤（マネージド前提か否か）の決定と要件を明文化（ADR 化推奨）。恒久策 = リストア演習を e2e 実環境検証（AUD-VER-003）と同時に 1 回実施。

### AUD-OPS-002: SLO 3 件に対しアラートルール実体が 0 件

| Severity | 工数 | 関連仕様                                              | 関連指摘    |
| -------- | ---- | ----------------------------------------------------- | ----------- |
| High     | S    | runbooks/observability-slo.md（SLO 定義済み）との乖離 | AUD-SEC-005 |

**現状**: observability-slo.md は 3 つの SLO と各 Prometheus アラート条件を**文章で**定義しているが、Prometheus ルールファイル・Alertmanager 設定・通知先がリポジトリに存在しない。メトリクスは出ているが誰にも届かない。
**根拠**: `runbooks/observability-slo.md`、リポジトリ全体（\*.rules.yml / alertmanager 0 件）
**あるべき姿**: SLO 文書のアラート条件を機械可読なルールファイルとしてコミットし、デプロイ手順に組み込む。burn-rate 型（fast 6×/1h + slow 1×/3d 等）が公式推奨（出典: https://sre.google/workbook/alerting-on-slos/ 、確認日 2026-07-11）。
**推奨対応**: observability-slo.md 記載の 3 条件をそのまま `ops/prometheus-rules.yml` に書き起こす（文書に条件があるので転記作業に近い）。通知先（Teams webhook が自然）を 1 つ決めて配線。

### AUD-OPS-003: デプロイパイプライン・イメージ発行・IaC が存在しない

| Severity | 工数 | 関連仕様                                            | 関連指摘    |
| -------- | ---- | --------------------------------------------------- | ----------- |
| Medium   | M    | ADR-0003/0005（常駐コンテナ運用）の実現手段が手作業 | AUD-SEC-003 |

**現状**: .github/workflows に docker build / イメージレジストリ push / デプロイのワークフローがない。docker-compose・K8s マニフェスト・Terraform も皆無で、ターゲット環境（どのオーケストレータか）自体が未決定。「コンテナオーケストレータの再起動ポリシーに委ねる」設計だが、そのオーケストレータが指定されていない。
**根拠**: `.github/workflows/`（ci / coding-task / report-generation のみ）、リポジトリ全体
**推奨対応**: 最小是正 = ターゲット基盤を ADR で決定（1 台 VM + compose でも十分。決めることが先）。恒久策 = tag push でイメージビルド →ghcr.io 発行のワークフロー追加（SHA ピン留め・provenance 付き）。

### AUD-OPS-004: .env.example がなく必須環境変数 30 個超がコード内にのみ存在

| Severity | 工数 | 関連仕様                                       | 関連指摘    |
| -------- | ---- | ---------------------------------------------- | ----------- |
| Medium   | S    | docs/reference/configuration.md との突合が必要 | AUD-IMP-001 |

**現状**: server の zod config は約 30 個の環境変数（うち secret 6 種は最小長 32 検証付き）、web はさらに AUTH\_\* 系を要求するが、.env.example が存在しない。加えて `GITHUB_TOKEN` と `WEB_FORCE_STANDALONE` は zod 管理外で、コードを読まないと全量が分からない。
**根拠**: `packages/server/src/config.ts`、`packages/web/src/server/config.ts`、リポジトリルート（.env.example なし）
**推奨対応**: config.ts の zod スキーマから .env.example を生成するワンショットスクリプト（または手書き 1 回 + スキーマ変更時の CI 突合）。設定リファレンス（docs/reference/configuration.md）との同期も同時に確認。

### AUD-OPS-005: 単一コンテナ 2 プロセス構成が可用性の単一障害点

| Severity | 工数 | 関連仕様                                                           | 関連指摘    |
| -------- | ---- | ------------------------------------------------------------------ | ----------- |
| Medium   | M    | ADR-0005 の意図（公開エンドポイント 1 つ）とのトレードオフ未文書化 | AUD-REL-001 |

**現状**: Hono と Next.js を 1 コンテナ内 supervisor（start-container.mjs）で並走させ、片方の異常終了で**コンテナ全体**を落とす設計。WebUI のクラッシュが webhook 受信・スケジューラ（配信・JIT 失効・購読更新）まで巻き添えにする。水平スケールも 2 プロセス束ねのため粒度が粗い。スケジューラの多重起動防止機構がないため、現状はレプリカ 1 固定が暗黙の前提になっている（この制約も未文書化）。
**根拠**: `packages/server/Dockerfile:28-31`、`packages/server/scripts/start-container.mjs`
**あるべき姿**: 少なくとも「レプリカ 1 前提」「WebUI 障害がスケジューラを道連れにする」というトレードオフが ADR-0005 に明記され、運用者が知って選べる状態。理想は web/server のコンテナ分離 + スケジューラのリーダー選出（advisory lock で実装容易）。
**推奨対応**: 最小是正 = ADR-0005 への制約追記 + supervisor を「WebUI 死亡時は server 継続 + readiness 低下」に変更する選択肢の検討。恒久策 = コンテナ分離（Dockerfile 2 分割）。

### AUD-OPS-006: シークレットマネージャ統合がなく env 直渡しのみ

| Severity | 工数 | 関連仕様 | 関連指摘    |
| -------- | ---- | -------- | ----------- |
| Low      | S    | —        | AUD-OPS-003 |

**現状**: 全 secret（Graph client secret、Anthropic key、各 HMAC secret 等）が環境変数直渡し前提。12-factor 準拠ではあるが、ローテーション手順が runbook にない。
**推奨対応**: デプロイ基盤決定（AUD-OPS-003）とセットで、基盤のシークレット機構（compose なら env_file + ファイル権限、K8s なら Secret）とローテーション手順を runbook 化。

### AUD-OPS-007: リリース基準が未着手

| Severity | 工数 | 関連仕様                                                                  | 関連指摘                 |
| -------- | ---- | ------------------------------------------------------------------------- | ------------------------ |
| Medium   | L    | リリース基準: パイロット 5 プロジェクト × 2 週間 / DevOps 90 日メトリクス | AUD-VER-003, AUD-SEC-001 |

**現状**: VERIFICATION_REPORT が明記するとおり、リリース基準（パイロット運用・90 日ポストローンチメトリクス）は検証スコープ外のまま。かつ production-gates.md の go-live ゲート（CODEOWNERS 検証・AIOPS_PR_TOKEN・branch protection）のうち branch protection は現行プランで実現不能（AUD-SEC-001）。
**根拠**: `verification/VERIFICATION_REPORT.md`、`runbooks/production-gates.md`
**推奨対応**: 本監査の P0 是正（00-summary 参照）完了後にパイロットを開始し、go-live ゲートの各項目に「確認日・確認者・証跡リンク」を記録する運用にする。

## 5. 良好事項

- graceful shutdown（SIGTERM → readiness 低下 → HTTP ドレイン → スケジューラ停止 → pool.end → telemetry flush、25 秒レース）は公式推奨パターンに正確に一致。exec-form CMD で PID 1 問題も回避済み。
- liveness / readiness の分離、readiness の failsafe・shutdown 連動は Kubernetes 等どの基盤でもそのまま使える形。
- pino 構造化ログ + 手製 Prometheus レジストリ + OTel（opt-in、起動順も正しい）で、計装自体は本番水準。欠けているのは「その先」（アラート・ダッシュボード）のみ。
- runbook 11 本は障害対応・購読復旧・手動運用まで具体的で、同規模プロジェクトの水準を大きく超える。
