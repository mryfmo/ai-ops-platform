# T19 全量否定的レビュー — レンズ1: 正しさ/境界(2026-07-09)

対象: `git diff main...origin/agent/T17`(177 files, +9854)。反証を試みる指示で実施。

## HIGH

| # | 位置 | 失敗シナリオ |
|---|---|---|
| L1-1 | shared/src/xlsxImport/engine.ts:114-171 | GitHub 書込と台帳書込が同一 try 内・台帳は "imported" しか書かない。createIssue 成功 → ledger.insert 失敗/プロセス落ち → 台帳行なし → **再実行で GitHub オブジェクト重複作成**。project_item は add 成功→update 失敗でも同様。マーカーは dedup に使われない(T15 で単一防御と確定済み)。**create/persist 境界の冪等性が破れている** |
| L1-2 | server/src/db/standardReportsRepo.ts:19-22 + shared/src/reporting/finalizeReportJson.ts:26-34 | reportId = sha256(payload) に **period.generatedAt(既定 now)が混入**。CI 再実行で同一内容でも別 ID → ingest が新規と判定 → 配信 dedup(reportId+recipientId)を素通り → **全受信者へ二重配信**。AC-018-2「同一レポートは1通」違反 |
| L1-3 | prjops/AGT05_distributor.ts:50-60 + idempotentDelivery.ts | sendMail → record の順。間でクラッシュ → 次サイクルで **無印の重複メール**。(再送)マーク機構は `isRetryAttempt=true` を渡す本番呼び出し元が存在せず**死んでいる**(SPEC-INT-052 の保証が空文) |

## MED

| # | 位置 | 失敗シナリオ |
|---|---|---|
| L1-4 | AGT05_distributor.ts:56-71 | sendMail→record→sendAdaptiveCard の順。カード送信例外で recipient が failed 扱いだが**メールは配信済み+ログ済み** → 次回 shouldSend:false で **カードは永久に再送されない**、failed カウントも誤り |
| L1-5 | reporting/reportValidation.ts:104 + calculateReportMetrics.ts:8-9 | `typeof NaN === "number"` で NaN が検証を通過。`Number("n/a")` → NaN → JSON では **null** に化けて配信/表示、再 ingest は 422。値の無音破壊 |
| L1-6 | reportValidation.ts:24,119-124 | countChars/truncateText が **コードポイント基準**(書記素クラスタ非対応)。ZWJ 絵文字/国旗/結合文字を途中切断。テストは単一コードポイント文字のみで露見しない |
| L1-7 | shared/src/periodBuckets.ts:68-72,95-128 | `parseJstDate("")` が例外を投げず Invalid Date → ラベル "NaN-.." と全ゼロ集計を**無音で返す**。`"2026-13-45"` も Date.UTC で無音ロールオーバー |
| L1-8 | xlsxImport/parser.ts:70-75 | `new Date(text).toISOString().slice(0,10)` — ローカル TZ 解釈 + UTC 変換で **JST ホストでは 1 日前**になる(due_on が 1 日早まる)。UTC の CI では露見しない |
| L1-9 | xlsxImport/engine.ts:85-89 | `remaining > minRemaining` の strict 比較で floor ちょうどで無駄に最大 1h 待機。逆に resetAt 過去なら 0ms 待機で**無防備に続行**、待機後の再取得もなし |

## LOW

- L1-10 reportDeliveryTask.ts:174 — 月曜が祝日だとその週の配信が丸ごとスキップ。listRecent(20) の窓から溢れた報告は永久未配信
- L1-11 pmSnapshotReconcileTask.ts:44-61 — 部分保存後の "skipped" 監査に stored 件数が入らず実態と乖離。再入防止なしで重複スナップショット
- L1-12 dashboardDeepLink.ts:14 — publicBaseUrl 不正で throw が配信サイクル全体を中断(1 受信者ではなく全体)

## 反証を試みたが破れなかった点(健全)

runDistributionCycle の受信者単位 try/catch、ingest の ON CONFLICT による同時実行 dedup、deep link のクエリエスケープ、chatHandler の persona 非空保証、githubEventRouter の occurredAt/subjectId 分岐、monthly snapshot の DB dedup。

## テストの不作為(A3)

- reporting.test.ts は常にクリーンな整数メトリクスのみ → NaN→null 経路(L1-5)を一度も通らない
- 文字数テストは単一コードポイント文字のみ → 書記素分断(L1-6)が起きない

## レンズ1b(冗長独立レビュー)で追加検出

| # | Sev | 位置 | 失敗シナリオ |
|---|---|---|---|
| L1b-1 | MED(安全性) | server/index.ts:211,220-226 + healthcheckTask.ts:59-68 | **フェイルセーフが見せかけ**。3 連続ヘルスチェック失敗で failsafe_activated 監査を書き activateFailsafe() を呼ぶが、composition root のそれは**空関数**。failsafeActive は他タスクから一切読まれない。実障害時に SPEC-EXT-042 の自動運用停止ブロードキャストも REQ-029 の停止も発火せず、配信・callback・dispatch が走り続ける。フェイルセーフが監査 1 行に縮退 |
| L1b-2 | MED | githubEventRouter.ts:113-121 vs periodBuckets.ts:188 | **ダッシュボードの Deploy 件数が恒久 0**。deployment webhook は AGT_DEP(監査のみ)に行くが normalizePmWebhookEvent に deployment エントリがなく null 返し → pm_events に書かれない。aggregateTimeseries.deployments は kind==="deployment" の events のみ集計 → 実デプロイ中でも 0 表示。テストは合成 deployment イベントを注入するため 2 層の隙間が露見しない |
| L1b-5 | LOW-MED(潜在) | executiveSevenKeys.ts:90,97-104,121-127 | **`=== undefined` が null 盲目**(periodBuckets で修正した同型)。scopeChangeCount 等が null で来ると scopeManaged が誤 green、teamPerformance が誤 red。現状は空 provider のため未発火だが、実 provider 実装時に顕在化する罠 |

注: L1b-4(非アトミックインポート)は L1-1 と同一。フェイルセーフ空関数は deferred コメントあり・T17 より前から存在の可能性があるが「配線済みで何もしない」パターンとして是正対象。
