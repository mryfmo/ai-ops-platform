# ベストプラクティス ギャップ分析 — 領域A: 運用/信頼性/可観測性 (2026-07-09)

対象 agent/T21。各項目: あるべき姿(出典)→ 現状(file:line)→ 深刻度 → 是正案。

## HIGH

- **A-6 イベントキューの無音損失**: eventsPollingTask:68 が失敗イベントを status='delayed' にするが claimNextQueued は status='queued' のみ選択(eventsRepo:37)→ **失敗イベントは永久に再試行されない**(コメントの約束が虚偽)。さらに claim 時に 'dispatched' へ原子更新→markDone 前クラッシュで stranded、reaper なし。GitHub/Graph の at-least-once 契約に反し実質 at-most-once。是正: attempts + next_attempt_at 列、backoff 再試行、N 回で dead 終端+アラート、dispatched の lease 期限回収。SKIP LOCKED 自体は正しい
- **A-7 webhook 冪等キー不在**: githubWebhook:41-51 は署名検証後 X-GitHub-Delivery を読まず盲目 enqueue、graphNotifications も通知 id で dedupe せず。events に外部 delivery id の unique なし → 再配信で二重処理(PM スナップショット/監査/dispatch 重複)。是正: X-GitHub-Delivery / Graph 通知 id を dedupe_key に unique 制約 + ON CONFLICT DO NOTHING。※report_delivery_log は正しく冪等 → 同パターンを ingest に展開
- **A-9 フェイルセーフが何も止めない**(L1b-1 を裏付け): activateFailsafe は no-op、failsafeActive を誰も読まない。是正: 各 task/dispatch の run 冒頭で isFailsafeActive を参照し変更系を短絡(REQ-029 どおり revoke/notify は許可)、最低でも /readyz を落とす
- **A-11 マイグレーション基盤なし**: schema.sql は CREATE TABLE IF NOT EXISTS + 手書き rollback コメントのみ。バージョン表・順序・ツールなし、起動時適用もなし。NOT VALID 制約(41,306,314)が VALIDATE されず既存行に効かない。是正: node-pg-migrate 導入か schema_migrations 表+順序化 migrations/、NOT VALID の VALIDATE パス、PITR
- **A-2 可観測性ゼロ**: OpenTelemetry/metrics/spans/prom-client なし。タスク duration・キュー深さ・dispatch 失敗率・プール飽和が不可視。是正: @opentelemetry/sdk-node + auto-instrumentations(HTTP+pg)、events 遅延 gauge・task duration histogram・delivery counter
- **A-13 SLO/アラートなし**: SLI/SLO/エラーバジェット/アラート/metrics 全て不在 → §6 の無音損失が検知不能。runbook 文化はあり。是正: metrics 後に 2-3 SLO(ingest→dispatch レイテンシ、配信成功率、task 成功率)

## MEDIUM

- **A-8 Graph lifecycle 未処理**: reauthorizationRequired/subscriptionRemoved/missed を分類・処理せず、missed 後の delta backfill なし → Teams メッセージが無音欠落し得る
- **A-10 分散ロックなし**: 単一インスタンス前提。ローリングデプロイの一時 2 多重で subscriptionRenewal/jitRevocation/sevenKeysMonthly が二重実行。是正: pg_try_advisory_lock で side-effect task を包む
- **A-3 /readyz が failsafe を反映しない**: failsafe 時も ready を返し LB が振り続ける
- **A-4 グレースフルシャットダウン不備**: server.close を await せず pool.end → in-flight query が落ちる。drain timeout なし、readiness flip なし
- **A-11b プール設定不足**: pool.ts は connectionString のみ。max/statement_timeout/idle_in_transaction_session_timeout/connectionTimeoutMillis なし → hung query が接続を無期限占有
- **A-1 構造化ログなし**: console.* のみ、レベル/相関 ID なし。trace_id は audit_log に流れるがログには伝播せず。是正: pino + child logger で trace_id 伝播

## LOW

- A-5 週次報告のダウンタイム跨ぎキャッチアップなし(二重は防ぐが欠落は防がない)
- A-12 GitHub セカンダリレート制限が backoff されない(Graph 側 graphClient:124-144 はジッタ付き backoff で最良実装)
- A-14 GITHUB_TOKEN が検証済み config schema をバイパス

## 最良実装(参照パターンとして維持)

graphClient の Retry-After+ジッタ backoff、config.ts の zod fail-fast、report_delivery_log PK の冪等 → 最後のパターンを webhook ingest に展開すべき(A-7)。

## 主要出典

opentelemetry.io/docs/languages/js、w3.org/TR/trace-context、GitHub webhooks best-practices / handling-deliveries / redelivering-webhooks、learn.microsoft.com graph change-notifications-delivery / lifecycle-events、node-postgres Pool、postgresql.org runtime-config-client、AWS backoff+jitter、sre.google SLOs、12factor.net/config

## T22 独立敵対レビューの追加発見(codex 自己検証は見逃し)

- **T22-R1 HIGH**: A-9 が PARTIAL。/report-ingest(reportIngest.ts:79-93 → index.ts:389-419 deliverReport → deliverStandardReportToRecipients の実 Graph 配信)が failsafe 非ガード。スケジューラの reportDeliveryTask はガード済みだが、この第 2 の配信経路が抜けている。failsafe 発動中も ingest 報告が配信される。是正: deliverReport 経路も isFailsafeActive で短絡(配信スキップ or queue)+ failsafe 中に ingest→配信されないテスト
- **T22-R2 MED**: CODEOWNERS の governance:check が warn-only+`@OWNER` 完全一致。別プレースホルダ(存在しないチーム/タイポ)で無音通過し保護なし。是正: プレースホルダ検出時に fail、`@OWNER` 以外の未解決パターンも検出(あるいは「これは advisory、実ゲートは branch protection」と正確に記述し過大申告を消す)
- **T22-R3 LOW**: /readyz→503(failsafe 中)と jitRevocation が failsafe 中も動く、のテストなし(コードは正しい)
- 確認(健全): AI-PR CI トリガ・gitleaks CLI fail-closed・SHA ピン・Dependabot は CONFIRMED-FIXED(運用前検証が必要な項目は記録)

## T22 revise-2 独立敵対レビューの追加発見(per-caller ゲートの漏れ)

- **T22-R1b HIGH**: reportIngest はゲートされたが、**POST /xlsx-import/execute が failsafe 無ガードのまま実 GitHub 書込(xlsxImport.ts:118-138 → engine.ts:169 createIssue)**。XlsxImportRoutesDeps に isFailsafeActive がなく index.ts:369-376 で注入もなし。codingTasks(index.ts:365)/reports(index.ts:389)と対照的。**failsafe を呼び出し側ごとに付けたため 4 つ目が漏れた構造的脆さ**。是正: xlsx-import/execute に isFailsafeActive を注入し executeXlsxImport 前に短絡+テスト。加えて全変更系エントリポイントと failsafe 状態の一覧を報告に義務付け
- **T22-R2b MED**: governance check が `@` 始まりトークンのみ検査。GitHub CODEOWNERS は email 形式オーナー(`@` なし、例 `nobody@example.com`)も許容 → filter で除外され無音通過。allowlist の @mryfmo ハードコードも脆い(将来のオーナー変更で CI が赤)。是正: 非 @ の email オーナーも検出/拒否、allowlist の運用注記
- **T22-R3b LOW**: /readyz 503 と JIT revoke のテストが failsafeActive フラグを実際に駆動していない(「under failsafe」が未検証の枠組み)。failsafe を実際に有効化して readiness→503、jit が呼ばれることを検証
- 確認(健全): reportIngest のゲートは実効(reportIngestRoutes.test.ts:85-97 が呼び出し 0/永続化/監査を検証)、スケジューラ全変更系タスクは guardTask で正しくゲート、Teams 会話は eventsPolling 経由で間接ゲート、JIT/healthcheck は正しく非ガード

## T22 revise-3(最終)独立敵対レビューの発見

- **T22-R1c 過大申告(MED)**: 「全変更系エントリポイント列挙」の表が createGraphSubscription CLI(tools/createGraphSubscription.ts:40 の未ゲート createSubscription)を欠く。実害低(HTTP/スケジューラ非到達の運用 CLI、障害時に必要)だが網羅の主張が虚偽。→ 表に out-of-band 運用ツールとして正直に追記(ゲートはしない)
- **T22-R1d 可用性欠陥(MED-HIGH)**: subscriptionRenewalTask をゲートしたため failsafe が Graph subscription TTL(~60分)を超えると購読失効、channelPolling フォールバックもゲートで死に、復旧後の再購読が CLI のみで通知が復旧しない。REQ-029 は危険な変更(auto-deploy/close/grant)のみ禁止で、購読更新は keepalive で対象外。→ 危険でない keepalive(subscriptionRenewal、read+enqueue の channelPolling)をゲートから外し REQ-029 範囲に整合。危険な書込(dispatchWorkflow/import createIssue/report 配信)のみゲート維持
- **T22-R3c 過大申告(LOW)**: /readyz 503 と JIT のテストが composition-root の実 failsafeActive を駆動せずローカル飾りフラグ(expect(failsafeActive).toBe(true) はトートロジー)。「under failsafe」主張が偽。→ 実フラグ駆動にするか主張を正確化
- 確認(健全): サーバ経由(HTTP/スケジューラ)で failsafe 中到達可能な未ゲート書込は皆無、xlsx-import ゲートは実効+本物テスト、R2b email オーナーは現実的攻撃を全て遮断

## T23 独立敵対レビューの発見(G2 受入前)

- **T23-R1 A-7 PARTIAL(実穴 MED-HIGH)**: delivery id 欠落/空で dedupe_key=NULL → ON CONFLICT なしの通常 INSERT + 部分 unique が NULL 除外 → ヘッダ欠落の重複が無音通過(githubWebhook.ts:57、graphNotifications.ts:104、eventsRepo.ts:58-62)。署名済み webhook は必ず delivery id を持つので欠落は異常 → fail-closed(GitHub は 400+監査、Graph も id 欠落は異常処理)。dedupe できたか否かを監査で区別
- **T23-R2 A-6 無限再試行(MED)**: dispatched lease 回収経路が attempts を増やさず、ワーカーをハードクラッシュさせる poison イベントが永久再試行(損失でなくストーム)。lease 回収時も attempts をカウントし max で dead
- **T23-R3 A-6 飾りテスト(MED)**: eventsRepo.test.ts のモックが SQL をエコーするだけで CASE/WHERE 未実行、dead 境界(attempts+1>=max)も reclaim 述語も実行検証なし。reclaim/dead 判定を純粋関数に切り出し実テストで検証(実 DB 不可のため純粋関数化が現実解)
- **T23-R4 マイグレーション規約違反(MED)**: 新列(attempts/next_attempt_at/claimed_at/dedupe_key)/制約差替/索引 3 つがインライン(schema.sql:20-30)で -- MIGRATIONS 節外・rollback DDL なし・NOT VALID 未 VALIDATE。規約どおり日付+rollback DDL を付け MIGRATIONS 節へ(G3 で正式なフレームワーク化)
- 確認(健全): A-6 の reclaim WHERE は正しい(queued/delayed の next_attempt_at NULL 許容、dispatched lease、dead 除外、SKIP LOCKED)、私が予測した NULL バグは二重安全で回避、A-8 は lifecycle 判別・実 backfill・unknown 監査すべて実効、audit_log 変異なし、!=undefined/null バグなし

## T23 revise 独立敵対レビュー(退行摘出)

- **T23-Rb1 退行 HIGH**: A-7 の Graph id 必須ガード(graphNotifications.ts:77-89)が lifecycle 分岐(toLifecycleEvent, line 91)より前に置かれ、**id を持たない lifecycle 通知(reauthorizationRequired/subscriptionRemoved/missed)を 400 で弾き handleLifecycleEvent に到達しない → 購読が無音で死ぬ**。A-7 修正が A-8 を破壊。app.test.ts:215-231 が合成 id を注入して退行を隠蔽。バッチ中断(item0 enqueue 後 400)も。加えて resourceData.id のみ持つ通常 change 通知も 400 し得る。是正: lifecycle を id ガードより前に分類・ルーティング(lifecycle は dedupe 不要)、テストは id なし現実形に
- **T23-Rb2 過大申告 NOT-FIXED**: decideEventDisposition(eventsRepo.ts:56-84)は作られ良い境界テストもあるが **claimNextQueued から呼ばれず**、SQL が依然 source of truth。純粋関数は飾りで本番は未テスト SQL(関数コメントが二重化を自認)。是正: 判定を TS 側に(FOR UPDATE SKIP LOCKED で候補 SELECT → decideEventDisposition で判定 → UPDATE)、純粋関数を本番経路に載せ境界テストが実コードを覆う
- **T23-Rb3 テスト**: R2 の唯一の実経路テストが SQL 文字列一致のトートロジー。reclaim→attempts++→dead を実駆動する挙動テストへ(Rb2 の TS 化で得られる)
- 確認(健全): R1 GitHub path は CONFIRMED-FIXED、R2 ロジック正、R4 マイグレーション規約 CONFIRMED-FIXED、audit_log 変異なし、null 比較バグなし

## T23 revise-2 独立敵対レビュー(TS 化が原子性退行を導入)

- **T23-Rc1 TOCTOU 二重 claim(退行 HIGH)**: eventsRepo.ts:117-155 が SELECT-FOR-UPDATE-SKIP-LOCKED(:117)と UPDATE(:127/:139)を別クエリに分割。素の pg.Pool でトランザクション無し→各 pool.query が自動コミットし FOR UPDATE ロックが SELECT 後に解放。2 ワーカーが同じ行を claim→二重 dispatch。SKIP LOCKED が飾り化。是正: **SELECT-FOR-UPDATE-SKIP-LOCKED + decideEventDisposition + UPDATE を単一トランザクション(pool.connect() で client を取り BEGIN...COMMIT、ロックを判定・更新まで保持)に包む**。純粋関数は本番経路に残す(Rb2 の成果は維持)
- **T23-Rc2 スターベーション(NEW MED)**: 新 SELECT(:117-121)が claimable でない行(lease 内 dispatched、未 due delayed)も含め古い 10 件を取り TS で filter→10 件全て非 claimable だと 11 件目以降の due イベントが飢餓。是正: SELECT の WHERE に claimability 述語(due queued/delayed OR lease 超過 dispatched)を戻し、attempts/dead 算出のみ TS の decideEventDisposition に残す(claimability=SQL、disposition=TS の分担)
- **T23-Rc3 Graph change 無音損失(NEW MED)**: dedupe key を top-level notification.id のみから取得(:110)。実 Graph change 通知は id を resourceData に持つ→以前は 400(loud、Graph 再送)、今は監査+continue+202(無音損失)。Rb1 修正が loud 失敗を無音損失に変えた。是正: dedupe key を ids.messageId(resourceData 由来、graphNotificationValidator が既にパース)から取得
- **T23-Rc4 テスト(MED)**: Rb3 テストは決定ロジックを実駆動するが mock がロック/状態を模さないため TOCTOU もスターベーションも検出不能。可能な範囲で claimability の境界(10 件非 claimable+11 件目 due)テストを追加
- 確認(健全): Rb1 lifecycle 到達 CONFIRMED-FIXED、Rb2 純粋関数の本番経路配線 CONFIRMED-FIXED、dead/done 除外 OK、audit_log 変異なし、null 比較バグなし
- 注: Rc1 はオーケストレーターの revise 指示が「TS に移す」だけで原子性を明示しなかった under-specification が一因。今回明示

## T24 独立敵対レビューの発見(G3 受入前)

- **T24-R1 過大申告 MED-HIGH**: migrate.ts:70-77 が applyMigrations に Pool を渡し、BEGIN/DDL/INSERT/COMMIT/ROLLBACK を pool.query で発行 → 各呼び出しが別プールドクライアントになり得て**明示トランザクションが機能しない**(原子性は pg 暗黙 tx + IF NOT EXISTS の偶然依存)。T23 で直した pool.query vs connect() の同型再発。正しいパターンは eventsRepo.ts:132。単一接続 fake テストが隠蔽。是正: pool.connect() で専用クライアントを取り BEGIN..COMMIT/finally release、テストは多クライアント経路を隠さない形に
- **T24-R2 ドキュメント退行 MED**: .claude/skills/db-migration/SKILL.md step2 と AGENTS.md:63 が今も「列追加は schema.sql の(T24 で削除した)-- MIGRATIONS 節に inline ALTER 追記」と指示 → 従うと将来の列追加がマイグレーションファイルを生まず db:migrate が既存 DB に適用せずフレームワーク素通り。是正: 「migrations/ に新規マイグレーションファイルを作る、schema.sql に inline ALTER しない」に更新
- **T24-R3 同時実行ロックなし LOW-MED**: pg_advisory_lock なしで 2 オペレータ同時 db:migrate が PK 衝突(loud・破壊なし)。是正: マイグレーション run 全体を pg_advisory_lock で包む
- **T24-R4 軽微**: devops/package.json に tsx 未宣言(root 経由で動くが宣言すべき)、migrations が dist に非コピー(tsx source 実行のみ安全 — 明示 or コピー)、002/003 の日付コメントがファイル名日付と不一致(cosmetic)
- 確認(健全): 順序/冪等/skip CONFIRMED-FIXED、**fresh-vs-migrate スキーマ等価性 CONFIRMED-EQUIVALENT(divergence なし)**、NOT VALID 5 制約全 VALIDATE、プール設定と statement_timeout(migrations/claim tx を脅かさない)、T23 rollback/release nit の実挙動テスト、db:migrate は手動+文書化、audit_log 変異なし、リークなし

## T25 独立敵対レビューの発見(G4 受入前)

- **T25-R1 A-4 二重シグナル無防備(MED)**: index.ts:522-523 で SIGTERM/SIGINT が同じ shutdown() を再入防止なしで呼ぶ。shuttingDown をセットするが読まない。二重シグナルで server.close reject(Server is not running)+ pool.end 二重呼び throw → exit(1) と exit(0) 競合で正常二重シグナルが非ゼロ終了。是正: shutdown 冒頭に `if (shuttingDown) return;`
- **T25-R2 A-4 タイマーリーク(MED)**: serverLifecycle.ts:36-39 の setTimeout が clearTimeout も unref もなし → race 決着後もイベントループ保持+発火で未処理 reject、テストで open handle。是正: race 決着で clearTimeout、または unref
- **T25-R3 A-2 キュー gauge stale(MED)**: metrics.ts:72-76 の setEventQueue が GROUP BY status の返却行のみ反映 → status が 0 drain で行なし → gauge が過去値固着 → 空でも A-13 SLO アラート `oldest_age>300` が永久発火。是正: 既知 status を毎サイクル 0 リセットしてから行適用。これで A-13 の該当アラートも修復
- **T25-R4 軽微(記録のみ、revise 不要)**: /metrics 無認証(/healthz と同姿勢、内部数値露出は注記)、pino に redact ガードレールなし(現状漏れなし、規律依存)、trace_id が OTel span id でなくアプリ独自(ログ↔トレース非相関)、setEventQueue のサンプル交互出力が strict OpenMetrics パーサで拒否され得る
- 確認(健全): telemetry 無効時 1 度明示ログ・startup 非クラッシュ、/metrics 全 family が実データ配線(スタブなし)、A-1 console.* 皆無で trace_id を child logger に実配線、A-3 /readyz が shutdown/failsafe/dep 全て 503、T24 CONCURRENTLY 注記と rollback release(err) テスト、依存は承認 4 つのみ、OTel は endpoint 未設定で不活性(既存 HTTP 非破壊)、audit_log 変異なし
