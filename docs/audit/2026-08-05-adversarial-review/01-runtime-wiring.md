<!-- 根拠: DevOps:REQ-001, DevOps:REQ-010, DevOps:REQ-015, DevOps:REQ-018, PrjOps:REQ-018, ADR-0003, ADR-0005 -->

# 01 意図 vs 実行時結線（ADV-WIR）

反証対象の主張: 「14 エージェント（PrjOps AGT-01〜07 / DevOps AGT-ORCH/BLD/DEP/INC/CHG/RPT/SEC）は、各 REQ に対して常駐サーバから実際に実行され、イベント受信 → エージェント関数呼出 → 副作用（GitHub/Teams/DB 書込）まで到達する」。

**判定: 主張は成立しない。** 完全結線は 14 中 2（AGT-05 と AGT-SEC の失効側）。イベント駆動 3 エージェント（BLD/DEP/INC）は「監査ログに書くだけで行動しない」状態が現存し、PrjOps 6 エージェントの関数はランタイムから一度も呼ばれない。ただし旧監査（2026-07-11）から 5 領域が明確に解消しており、退行ではなく前進途上である。

## ADV-WIR-001 [Critical] DevOps イベントハンドラは監査追記のみでエージェント関数を呼ばない

- 実証: `packages/server/src/index.ts:204-236` — `devopsEventHandlers` の AGT_BLD / AGT_DEP / AGT_INC 3 ハンドラの本文が `devopsAuditLog.append({ action: "github_event_received" })` のみ。`classifyBuildFailure`（`packages/devops/src/agents/AGT_BLD.ts:40`）、`promoteToStagingIfEligible` / `executeProdDeploy` / `monitorAndRollbackIfNeeded`（`AGT_DEP.ts:33,79,113`）、`classifyIncident` / `triageAndNotify`（`AGT_INC.ts:46,71`）はランタイム呼び出しゼロ。
- **本レビューで動的に再現・確認**（06 章 D7c）: 使い捨て DB 上の実サーバへ正署名 `workflow_run`(conclusion=failure) を POST → 202、events 行が `queued → done`、audit_log に `SERVER|github_event_dispatched|DevOps:SPEC-INT-010` と `AGT-BLD|github_event_received|SPEC-INT-011` の 2 行のみ。ビルド失敗分類・PR コメント・Teams 通知は一切発生しない。
- 影響: REQ-001/002（ビルド失敗トリアージ）、REQ-003/010/012（デプロイ・ロールバック）、REQ-015〜017（インシデントトリアージ、TH-004 の 5 分 SLA）が実行系として存在しない。DevOps 側の中核価値が未提供。
- 是正方向: ハンドラからエージェント関数への結線と、外部 API 失敗時の再試行・デッドレター設計。工数 L。

## ADV-WIR-002 [Critical] PrjOps AGT-01/02/03/04/06/07 の関数はランタイム呼び出しゼロ

- 実証: `decideOnJobFailure`/`nextJobInSequence`(AGT-01)、`ingestOne`/`structureFreeText`(AGT-02)、`analyzeProjectStatus`/`proposeEscalationIfNeeded`(AGT-03)、`generateProfileNarratives`/`generateExecutiveReport`(AGT-04)、`processActionForDay`/`runDailyTracking`(AGT-06)、`verifyReportBeforeDelivery`(AGT-07) のいずれも `packages/server/src`・`packages/web/src` から呼ばれない。
- 補足: AGT-04 の役割は ADR-0012/0014 により CI 側（`.github/workflows/report-generation.yml:60-90` の `claude -p /generate-report` + `packages/shared/src/reporting/*`）へ移管済み。つまりパッケージ実装は通らない別実装で代替されている。
- 影響: 収集・分析・追跡・配信前検証が自動実行されない。特に **AGT-07（配信前検証: 数値一致・権限違反なし・プレースホルダ未置換なし・受信者と報告主体の一致）が未結線**である点は、外部配信を伴う設計において最も重い。テストと traceability は当該関数を参照するため、「テスト green」が結線の証明にならない典型例。
- 是正方向: 各エージェントの起動主体（scheduler タスク or CI ジョブ）を決め、AGT-07 は配信経路の直前に必須ゲートとして挿入。工数 L。

## ADV-WIR-003 [High] activateFailsafe が no-op — 発動が人間に届かない

- 実証: `packages/server/src/index.ts:296` の `activateFailsafe: async () => {}`。`scheduler/tasks/healthcheckTask.ts:16` は SPEC-EXT-042 の全チャネル通知を要求。
- 部分解消: 遮断側は実装された。`guardFailsafeTask`（`scheduler/scheduler.ts:33-54`）が対象タスクを skip + audit し、`codingTasks.ts:156-166`・`reportIngest.ts:90-99`・xlsxImport が実行をブロック、回復時は自動解除（`healthcheckTask.ts:39-53`）。
- 影響: 発動しても通知がなく、単一運用者は `/readyz` 503 と監査ログを能動的に見ない限り気付けない。工数 S。

## ADV-WIR-004 [High] Seven Keys 月次スナップショットは provider 未配線で恒久的に disabled

- 実証: `packages/server/src/index.ts:393-404` が `createSevenKeysMonthlySnapshotTask({ disabledReason: "PrjOps report data provider is not configured" })` を渡す。`provider` 引数の口はある（`sevenKeysMonthlySnapshotTask.ts:22`）が composition root に配線がなく、config でも注入できない。実行パスは常に `sevenKeysMonthlySnapshotTask.ts:45-55` の disabled audit → return。
- 影響: AC-038-1（第 1 営業日スナップショット保存）は本番構成でも構造的に到達不能。設定不足ではなく**コード上の未配線**である点が config ゲート型の無効化と異なる。工数 M。

## ADV-WIR-005 [High] monitor イベントの生産者が存在せず、監視→ロールバック経路が二重に死んでいる

- 実証: `eventsRepo.enqueue()` の呼び出しは `index.ts:448`（inbound）と `index.ts:476`（github）のみ。`EventSource` 型は "monitor" を含む（`db/eventsRepo.ts:10`）が enqueue 経路がない。仮に届いても `index.ts:365-374` の `dispatchMonitorEvent` は監査追記のみ。
- 影響: TH-003（5xx 5% で自動ロールバック）は入力も処理もない。工数 M。

## ADV-WIR-006 [High] Teams コマンド 4 種が権限チェック後に無応答で握りつぶされる

- 実証: `packages/server/src/agents/teamsConversationAgent.ts:157, 312-316` — `action_add` / `action_done` / `issue_close` / `status_override` に `fromParsedCommand` が `null` を返し「AGT-01 等の既存経路が別途処理する想定」とコメントして return。その経路は存在しない（ADV-WIR-002）。ユーザーへの返信もない。
- 影響: `parseCommand`（`packages/prjops/src/lib/commandParser.ts:23-26`）が受理する 8 コマンド中 4 つがサイレント無視。特に `status_override` は理由必須監査（設計原則 5）の代表操作でありながら実行経路そのものがない。利用者から見ると「コマンドを送ったが何も起きない」= 最悪の UX。工数 M。

## ADV-WIR-007 [High] AGT_RPT・AGT_CHG は完全未結線、ジョブスクリプトは README のみ

- 実証: `resolveWeeklyDoraDeltas`/`deliverMemberDailyReport`/`deliverLeaderReport`/`buildAndDeliverManagerReport`（AGT_RPT.ts）、`summarizeChangeDiff`/`sendApprovalCard`/`notifyPartnersOfRelease`（AGT_CHG.ts）が呼び出しゼロ。`packages/devops/scripts/jobs/` は README.md のみで「想定スクリプト: on-build-failure.mjs、reports.mjs」と未実装を自己申告。
- 影響: DevOps の日次/週次/月次レポート配信、変更承認カード送信、パートナー通知が起動されない。**旧監査の AUD-OPM-001（承認フローが完結しない）の実質的な根本原因**がここにある。工数 L。

## ADV-WIR-008 [High] AGT_BLD トリアージ workflow は存在しないスクリプトを参照し未配備

- 実証: `packages/devops/src/workflows/on-workflow-failure-triage.yml:19` が `node packages/devops/scripts/jobs/on-build-failure.mjs` を実行するが当該ファイルは存在しない。かつ `.github/workflows/` には ci/coding-task/report-generation の 3 本しかなく、このテンプレートは配備されていない。
- 影響: server 側（ADV-WIR-001）と Actions 側の両経路で AGT_BLD は不能。工数 M。

## ADV-WIR-009 [High] AGT_SEC は失効のみ結線、付与側が未結線で台帳への書き手が不在

- 実証: 結線側 — `scheduler/tasks/jitRevocationTask.ts:24-30` が毎分 `revokeExpiredGrants`（`AGT_SEC.ts:92`、実 GitHub `removeCollaborator` + audit + `markRevoked`）を実行。一方 `GrantsRepo` の呼び出しは `loadActiveGrants`/`markRevoked` のみで、**台帳へ INSERT するランタイム経路が存在しない**。`executeGrant`/`validateGrantApplication`/`detectManualPermissionDrift`（`AGT_SEC.ts:74,37,113`）は呼び出しゼロ。
- 影響: JIT 権限の「申請 → 承認 → 付与」が丸ごと欠落し、失効ループは常に空回り。ドリフト検出（手動権限変更の突合、Sev3 起票）も未稼働。REQ-018/019 は失効の半分のみ実装。runbooks/manual-ops.md が「手動権限付与は grants テーブルへの生 INSERT」と記すのは、この欠落の裏返しである。工数 L。

## ADV-WIR-010 [Medium] healthcheck の監視対象が DB `SELECT 1` のみ

- 実証: `packages/server/src/index.ts:291-294` — `checkTargets` は `pool.query("SELECT 1")` と pool メトリクス記録のみ。Graph / GitHub / LLM / スケジューラ滞留の生存確認なし。
- 影響: SPEC-INT-040 の「下流エージェント等の生存確認」と乖離。外部統合が全滅しても failsafe は発動せず `/readyz` は 200 のまま（06 章 D7c で ready=true を実観測）。工数 M。

## ADV-WIR-011 [Medium] deploy-prod.yml が `.github/workflows/` に未配備

- 実証: `AGT_DEP.ts:87-93, 138-141` が `deploy-prod.yml` を dispatch するが、実体は `packages/devops/src/workflows/deploy-prod.yml` テンプレートのみ。dispatch 先は owner/repo 注入型の設計だが、配備先・配備手順がリポジトリ内に存在しない。AGT_DEP 自体が未結線のため現時点では潜在。工数 S。

## ADV-WIR-012 [Medium] freeTextIntent が AGT-02 を呼ばず同一設計を並行実装

- 実証: `packages/server/src/lib/freeTextIntent.ts:6` に「AGT02_collector.ts の structureFreeText() と同一設計」と明記された別実装。AGT-02 本体は未使用。
- 影響: 仕様 ID 上は AGT-02 由来の挙動が server に存在するように見えるが実体は複製で、AGT-02 のテストが server の挙動を保証しない。トレーサビリティの偽陽性を生む構造。工数 M。

## ADV-WIR-013 [Low] pm snapshot reconcile の config ゲート型無効化（記録のみ）

- 実証: `packages/server/src/index.ts:269-285` — `GITHUB_PROJECT_NODE_ID` 未設定または GitHub 認証なしで `pm_snapshot_reconcile_disabled` を audit して空結果を返す。設定があれば `listCurrentProjectV2Snapshots` から `pmTimeseriesRepo` への実書込まで結線。fail-closed + 監査で ADR-0014 原則に適合しており、**所見ではなく良好例として記録**。

## 旧監査からの解消状況

| 旧指摘                                                                  | 現状                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SAMPLE_STAKEHOLDERS（山田太郎）が Teams 認可の唯一の入力（AUD-IMP-003） | **解消**。`index.ts:164-174` + `lib/stakeholderYamlLoader.ts:20-36` で `STAKEHOLDERS_DIR` の YAML マスタ化。未設定時は `resolveCallerProfile → null` の全拒否 + 起動時監査（06 章 D7c で `stakeholder_master_not_configured` を実観測） |
| web の InMemory 空 provider（AUD-IMP-002）                              | **解消**（ランタイム経路）。全 API ルートと dashboard が `createPinnedPrjopsReportDataProvider(config)`（immutable snapshot、欠如時 503 E-DATA01）を使用。InMemory は dev/test fixture として残置                                       |
| failsafe の唯一の効果が /readyz 503                                     | **大幅改善**（遮断側実装）。通知のみ未了 → ADV-WIR-003                                                                                                                                                                                  |
| PrjOps 配信系のランタイム呼び出しゼロ                                   | **AGT-05 は解消**。`reportDeliveryTask.ts:245` → `runDistributionCycle` → 実 Graph sendMail/sendAdaptiveCard + 冪等配信ログ + `isActiveRecipient`/`filterIssuesForProfile` 経由                                                         |
| ADR-0003 の常駐ループ未実装                                             | **解消**。jitRevocationTask（毎分）・healthcheckTask（30 秒）が稼働                                                                                                                                                                     |

## 14 エージェント × 結線状態

| エージェント           | 状態                          | 根拠                                                          |
| ---------------------- | ----------------------------- | ------------------------------------------------------------- |
| AGT-01 orchestrator    | 未結線                        | 全関数呼び出しゼロ。server は独自 scheduler を使用            |
| AGT-02 collector       | 未結線（設計のみ複製）        | ADV-WIR-012                                                   |
| AGT-03 analyzer        | 未結線                        | 呼び出しゼロ                                                  |
| AGT-04 reportGenerator | 未結線（CI 側実装が代替）     | SevenKeys タスクは恒久 disabled（ADV-WIR-004）                |
| AGT-05 distributor     | **完全結線**（config ゲート） | reportDeliveryTask / reportIngest → Graph 実送信 + DB + audit |
| AGT-06 tracker         | 未結線                        | Teams の action コマンドは握りつぶし（ADV-WIR-006）           |
| AGT-07 verifier        | 未結線                        | 配信前検証は shared の schema validator のみ                  |
| AGT-ORCH               | 部分結線                      | evaluateFailsafe と遮断は実動。通知 no-op、監視は DB のみ     |
| AGT-BLD                | 部分結線（監査のみ）          | ADV-WIR-001 / 008                                             |
| AGT-DEP                | 部分結線（監査のみ）          | ADV-WIR-001 / 005 / 011                                       |
| AGT-INC                | 部分結線（監査のみ）          | ADV-WIR-001                                                   |
| AGT-CHG                | 未結線                        | ADV-WIR-007                                                   |
| AGT-RPT                | 未結線                        | ADV-WIR-007                                                   |
| AGT-SEC                | 部分結線                      | 失効のみ実動、付与・ドリフト未結線（ADV-WIR-009）             |

「監査に書くが行動しない」経路の全数: `index.ts:206-215`(AGT_BLD)、`216-225`(AGT_DEP)、`226-235`(AGT_INC)、`365-374`(monitor)、`393-404` + `sevenKeysMonthlySnapshotTask.ts:45-55`(SevenKeys 恒久 disabled)。config ゲート型の正当な無効化監査（pm_snapshot_reconcile_disabled、report_delivery_disabled、report_ingest_disabled、stakeholder_master_not_configured）はこれと区別する — 設定投入で実挙動に切り替わることをコードで確認済み。

補足: 元仕様文書（REQ/SPEC-INT/AC の原文）は worktree 内に見当たらず、各 ID の受入条件文言との突合は検証不能。本章はコード上の到達可能性のみに基づく。
