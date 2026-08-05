<!-- 根拠: DevOps:REQ-029, DevOps:AC-029a, ADR-0003, ADR-0015, ADR-0016 -->

# 05 運用即応性（ADV-OPS）

反証対象の主張: 「デプロイ・復旧・監視・バックアップの面で運用可能な状態にある（ADR-0016 Azure Container Apps 採用、RPO≤5min / RTO≤60min、99.9% 目標）」。

**判定: 反証される。** ADR-0016 / DEC-ENV-002 が要求する Azure 実体（Bicep・ACR・デプロイ経路・バックアップ・アラートの大半）はリポジトリに 1 ファイルも存在せず、RPO/RTO は一度も計測されていない。ADR-0016 自身が「Bicep build や mock デプロイだけで production readiness を主張してはならない」（`docs/adr/0016-azure-platform.md:52`）と明記しており、現状はその条件を満たさない。

一方、アプリ内部の運用品質（Dockerfile ハードニング、graceful shutdown、fail-fast、.env.example、アラートルール骨格）は旧監査から明確に前進した。**欠けているのは「アプリをどこにどうやって載せ、壊れたらどう戻すか」の層である。**

## ADV-OPS-001 [Critical] デプロイ経路・IaC が完全に不在

- **本レビューで独自確認**: `.github/workflows/` は ci / coding-task / report-generation の 3 本のみで deploy・image-release 系は存在しない。`*.bicep` はリポジトリ全体で **0 件**、`infra/` ディレクトリも**存在しない**。ACR / Container Apps / Key Vault / Front Door を参照する設定も 0 件。
- ADR-0016:21 は「全 Azure リソースを Bicep で定義。Portal-only は受入不可」、DEC-ENV-002（`docs/spec/productization-decisions.md:245`）は「Bicep as the only infrastructure definition」を要求する。実装は 0%。
- 文書腐敗の証拠: `docs/reference/configuration.md:79` は「release-image.yml is intentionally absent。deployment-platform ADR が registry を選定するまでブロック」と記すが、ADR-0016 は 2026-07-13 に Accepted 済み。ブロック理由が 3 週間以上失効したまま残っている。
- 是正方向: release-image.yml（ACR push + digest 固定 + SBOM/provenance）と `infra/` Bicep 一式を Phase 6 として起票。工数 L。

## ADV-OPS-002 [Critical] deploy-prod.yml が echo プレースホルダのまま・配置場所も未解決

- 実証: `packages/devops/src/workflows/deploy-prod.yml:36-41` のデプロイ実体は `echo "Deploying ref=..."` と `echo "monitoring window start notified..."` のみ。
- ファイルは `.github/workflows/` ではなく `packages/devops/src/workflows/` にあり、このリポジトリでも他リポジトリでも workflow として登録されない。`AGT_DEP.ts:87-92, 137-142` は対象 repo へ `deploy-prod.yml` を dispatch するが、配備手段・手順がどこにも存在しない → dispatch は必ず 404。
- **連鎖影響**: `runbooks/manual-ops.md:15` の手動手順「Actions タブ → deploy-prod を選択」も、workflow が Actions タブに現れない以上**実行不能**。AC-029a（エージェント停止時に手動デプロイ可能）の実体が壊れている。工数 M。

## ADV-OPS-003 [High] デプロイ状態機械と TH-003 自動ロールバックが未結線 — RTO≤60min の根拠なし

- 実証: `packages/server/src/index.ts:216-225` の AGT_DEP ハンドラは監査ログ 1 行のみ（01 章 ADV-WIR-001）。`executeProdDeploy` / `monitorAndRollbackIfNeeded` は死蔵ライブラリ。
- さらに: TH-003 監視（15 分・30 秒間隔の 5xx/p95 取得）が前提とする監視 API クライアントは未実装。しかも仕様は Datadog 前提（`docs/spec/spec-id-catalog.md:277`、`docs/spec/devops/06_運用環境表.md:15`）だが ADR-0016:20 は Log Analytics / App Insights を採択しており、**仕様と ADR が監視基盤レベルで矛盾したまま**。
- 是正方向: 監視データソースを App Insights に確定して spec を改訂し、scheduler タスクとして結線。工数 L。

## ADV-OPS-004 [High] バックアップ/リストアが Proposed 止まり・演習実績ゼロ

- 実証: `docs/adr/0015-backup-and-restore.md:5` は Status: Proposed のまま（ADR-0016 は provider 部分のみ supersede）。`runbooks/backup-restore.md:5` は「Do not execute production backup or restore commands from this draft」、`:9-27` に `TBD(HUMAN)` が 8 箇所。
- ADR-0016:25-26 の 35 日 PITR・geo バックアップ・5 年 LTR・RPO≤5min/RTO≤60min は、それを設定する Bicep も CLI 手順も検証証跡も存在しない（001 と連動）。5 年監査保持の immutable アーカイブ経路も `TBD(HUMAN)`（`backup-restore.md:33`）。
- 影響: **5 年保持の監査ログという最も重い保持義務に対し、物理的な裏付けが皆無**。RPO/RTO は目標値が文書にあるだけ。工数 L（うち HUMAN 裁定が前提）。

## ADV-OPS-005 [Medium] アラート網が要求の約 3 割・可用性 99.9% が計測不能

- 解消済み: `ops/prometheus-rules.yml` が新設され **5 ルール**（queue age / delivery 失敗率 + fast/slow burn / scheduler 成功率）が存在（旧監査の「アラート 0 件」は部分解消）。
- 未解消: DEC-ENV-002（`docs/spec/productization-decisions.md:253`）は availability・p95 latency・5xx 率・queue age・failed jobs・delivery 失敗・DB saturation・Graph subscription expiry・budget/failsafe 発動・backup/restore 失敗の 10 領域 + severity/owner/paging を要求。現ルールは 3 領域のみ。
- 根本問題: `packages/server/src/observability/metrics.ts` に **HTTP リクエストメトリクス（件数・レイテンシ・ステータス）が存在しない**ため、99.9% 可用性・p95・5xx はアプリ側から計測不能。
- 基盤不整合: ルールは Prometheus 形式だが採択基盤は Log Analytics / App Insights（ADR-0016:20）で、Azure Monitor アラート定義は 0 件。`runbooks/observability-slo.md:28-30` 自身が critical task selector を `TBD(HUMAN)`、promtool 検証も未実施と自認。工数 M。

## ADV-OPS-006 [Medium] METRICS_TOKEN 未設定時に /metrics が無認証公開

- 実証: `packages/server/src/config.ts:59` で optional、`:203-205` で warn のみ。認証は `http/app.ts:55-58` でトークン設定時のみ有効、route 自体（`http/routes/metrics.ts:10`）は無条件登録。**06 章 D7c で実際に 200 応答と起動時 warn を観測**。
- 影響: ADR-0016 構成では Front Door 経由で `PUBLIC_BASE_URL` 配下が公開されるため、設定漏れ 1 つで queue 深度・タスク失敗・配信結果等の内部運用情報が匿名公開される。`runbooks/production-gates.md` のゲート一覧にも METRICS_TOKEN 必須化の項目がない。
- 是正方向: 本番モードでは必須化して E-CFG01 で fail させるか、production-gates に明示ゲートを追加。工数 S。（03 章 ADV-SEC-011、06 章 ADV-DYN-001 と同一事象）

## ADV-OPS-007 [Medium] スケジューラのレプリカ間多重実行対策がなく、ACA multiple-revision と構造的に矛盾

- 実証（本レビューで精査・一部訂正）: advisory lock は**全く無いわけではない** — `packages/server/src/db/graphSubscriptionsRepo.ts:135-159`（recovery owner の絞り込み）、`packages/devops/src/db/migrate.ts:52`、`packages/devops/src/tools/backfillRecipients.ts:110` に存在する。しかし**スケジューラ全般とレポート配信には無い**。`packages/server/src/scheduler/scheduler.ts` の多重実行ガードはプロセス内フラグのみ。
- ADR-0016:15/24 は multiple-revision mode + 10/50/100% 段階トラフィックを要求 → **デプロイのたびに新旧 revision の 2 プロセスが必ず並走**し、全 scheduler タスクが二重実行される。
- **配信二重送信リスクを独自確認**: `packages/prjops/src/agents/AGT05_distributor.ts:46-58` は `decideDelivery`（`reportDeliveryLogRepo.ts:14,24` の SELECT）→ `record`（`:35-37` の `INSERT ... ON CONFLICT DO UPDATE` = 無条件 upsert）→ `sendMail` の check-then-act。2 レプリカが同時に decide すると同一レポートのメール/Teams カードが二重送信される。
- 対照: events 経路は安全（`eventsRepo.ts:149` `FOR UPDATE SKIP LOCKED`）。
- 是正方向: pending の INSERT を `ON CONFLICT DO NOTHING` + rowcount 判定の原子的 claim に変更し、タスク単位の advisory lock を scheduler に一般化。工数 M。

## ADV-OPS-008 [Medium] dead letter の可視化が半分・復旧手段がゼロ

- 解消済み: `observability/metrics.ts:13` の EVENT_QUEUE_STATUSES に "dead" が含まれ `aiops_events_queue_depth{status="dead"}` として出力される。
- 未解消: `ops/prometheus-rules.yml` に dead 深度のアラートがない。dead → queued へ戻す requeue 関数・CLI・HTTP ルートは存在せず（`eventsRepo.ts` に該当メソッドなし、`docs/reference/cli.md` にも記載なし）、全 runbook に "dead" イベントの扱いが一切登場しない。
- 影響: max attempts 到達イベントが気づかれず永久に放置される。工数 S（アラート + SQL 手順の runbook 化）。

## ADV-OPS-009 [Medium] 本番コンテナから migration を実行できず、実行経路が未定義

- 実証: `runbooks/database-migrations.md:7` が自認「migration は source-checkout 前提（tsx）。compiled server からは自動実行されない」。`Dockerfile:26-28` のガードが src/tsx/typescript の同梱を積極的に排除しているため、ランタイムイメージからの実行は原理的に不可能。
- ADR-0016:17 は PostgreSQL を private network に置くため、本番 migration には private endpoint へ届くソースチェックアウト環境（CI runner / jumpbox）が必要だが、その経路はどの runbook・workflow にも定義されていない。
- **SQL 資産自体は健全**: 06 章 D5/D7c で schema.sql + migrations 8 本の全適用成功を実測。欠けているのは本番実行経路のみ。
- 是正方向: migration 専用 Container Apps Job または CI job（federated credential + private network 到達）を定義。工数 M。

## ADV-OPS-010 [Low] 祝日カレンダーの有効期限監視がない

- 実証: `packages/shared/src/calendar/jp_holidays.yaml` は 2027-11-23 まで収録（約 16 ヶ月の猶予。データ面は解消）。しかし `businessCalendar.ts` にも起動時（`index.ts:120-122`）にもカバレッジ検証がなく、期限を過ぎると**祝日が silently 営業日扱い**になり報告・督促タイミングが狂う。年 1 回の手動 PR 更新だけが頼り。
- 是正方向: 起動時に「カレンダー最終日まで N 日未満なら warn/メトリクス」。工数 S。

## ADV-OPS-011 [Low] runbook-as-implementation の全数と実行可能性

markdown 手順書のみが AC/要求の実体になっている箇所:

1. **AC-029a（手動デプロイ）** → `runbooks/manual-ops.md:6` が「実体はこの手順書」と明言。ただし §1 は存在しない Actions タブ項目（ADV-OPS-002）と存在しない Datadog ダッシュボード（`manual-ops.md:22`、ADR-0016 は App Insights 採択）を参照しており**現実に実行不能**。
2. **PrjOps AC-020-1 / DevOps AC-028a（監査ログアクセス）** → `manual-ops.md:65`。SQL 実行権限があれば実行可能。
3. **failsafe 中の grant 代替** → 「grants テーブルへ手動 INSERT」。private network DB への接続経路が未定義（009 と同根）で、単一運用者には実行手段がない。01 章 ADV-WIR-009（付与側の未結線）の裏返しでもある。
4. **SLO アラート投入**（`observability-slo.md:26`）→ 「deployment owner が Prometheus に load」と人任せ、採択基盤とも不一致。
5. **audit_log 月次パーティション準備**（`runbooks/audit-retention.md:7-12`）→ 毎月手動 SQL。失念しても `_default` 隔離パーティションが受ける安全網があり（**06 章 D5 で実観測**）、設計としては良好。
6. **backup-restore.md / production-gates.md（rate limiting `TBD(HUMAN)`）/ secret-rotation.md（`TBD(HUMAN)` 27 箇所）** → 手順書自体が未完成。

`traceability_matrix.md` でも DevOps:AC-029a を含む 16 AC が source 参照欠落として明示されている。

## ADV-OPS-012 [Low] configuration.md の「exact inventory」宣言が事実に反する

- 解消済み: **本レビューで独自確認** — `.env.example` は実在し 45 変数を収録。config.ts の Zod スキーマ全変数（METRICS_TOKEN / GITHUB_APP_* / XLSX_IMPORT_* / STAKEHOLDERS_DIR / HEARTBEAT_URL 含む）を網羅する。旧監査の「.env.example なし」は解消。
- 未解消: `docs/reference/configuration.md:61` は「上表は exact Zod-schema inventory」と主張するが、server 表（`:5-35`）から **METRICS_TOKEN・GITHUB_APP_ID/PRIVATE_KEY/INSTALLATION_ID・STAKEHOLDERS_DIR・HEARTBEAT_URL・ANTHROPIC_DEFAULT_MODEL/ESCALATION_MODEL/PRICING_USD_PER_MTOK が欠落**。工数 S。

## 旧監査からの解消状況

| 項目                                     | 証跡                                                                                                                                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node 20 EOL（AUD-DEP-001）               | **解消**。`Dockerfile:8,36` `node:22-slim`、`.mise.toml` node 22、`package.json` engines `>=22.13.0`、pnpm 11.13.0 が一致                                                                       |
| Dockerfile が full source / devDeps 同梱 | **解消**。multi-stage 化 + **ビルド時 assert**（`Dockerfile:26-28` が src/tests/vitest/typescript/tsx の混入で build 失敗）。※Docker 不在のため docker build 自体は BLOCKED・未実証（06 章 D6） |
| HEALTHCHECK / 非 root 実行なし           | **解消**。`Dockerfile:51` HEALTHCHECK、`:55` `USER node`                                                                                                                                        |
| graceful shutdown                        | **解消**。`serverLifecycle.ts:40-67`（readiness 降下 → HTTP drain → scheduler 停止 → pool end、25s timeout）+ `start-container.mjs` の SIGTERM 転送                                             |
| アラートルール 0 件（AUD-OPS-002）       | **部分解消**。5 ルール新設、ただし 3/10 領域（ADV-OPS-005）                                                                                                                                     |
| events の二重ディスパッチ                | **解消**。`FOR UPDATE SKIP LOCKED` + attempts/dead 終端                                                                                                                                         |
| .env.example 不在                        | **解消**（45 変数）                                                                                                                                                                             |
| バックアップ/PITR 皆無（AUD-OPS-001）    | **一部解消**（骨子のみ、実行不能）→ ADV-OPS-004                                                                                                                                                 |

## 結論

アプリ内部の運用品質（fail-fast、graceful shutdown、追記専用監査、イベントキュー、コンテナハードニング）は着実に向上した。しかし ADV-OPS-001〜004 — デプロイ経路・IaC・自動ロールバック・検証済みリストア — が実装ゼロであるため、運用可能性の主張は棄却が妥当。優先順は **001 → 002 → 004**（デプロイ経路と検証済みリストアが RPO/RTO 主張の前提条件）。
