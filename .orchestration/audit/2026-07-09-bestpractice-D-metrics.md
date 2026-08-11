# ベストプラクティス ギャップ分析 — 領域D: 報告/メトリクス方法論 (2026-07-09)

対象 agent/T21。定義(出典)→ 現状(file:line)→ 正否/深刻度 → 是正。

## DORA(devops/src/lib/doraMetrics.ts)

- **D-A1 HIGH 復旧時間の方法論誤り**: calcMeanTimeToRestoreHours(65-70)は汎用 IncidentRecord を平均。DORA は(a)変更起因の障害のみに限定(b)中央値(c)2023 で failed deployment recovery time に改名し throughput へ再分類。現状は 3 点とも不適合。是正: causedFailure 連動 incident のみ、median()(既存 line 32)、名称/分類更新
- **D-A5 MED rework 入力フラグの意味が逆**: 算術は正(reworked/total*100)だが `reworked` の定義(line 23)が「後で手戻りが必要だったか」= 正典「このデプロイ自体が計画外の修正か」の逆。データ投入者が誤集合を埋める
- **D-A6 MED ゼロデータが 0 を返し「エリート」に見える**: 空入力で lead 0h/CFR 0%/rework 0%/recovery 0h(test 117-124 が固定)。null/NA を返し「未取得」表示に
- **D-A2/A3/A4 MED throughput/instability グルーピング未実装、性能バンド(elite/high/med/low)未実装、DF が連続平均でバンド化なし。ヘッダは今も「4指標」/stability の陳腐化**
- **D-A7 MED サービス横断集計が per-service ガイダンスに反する**: doraByProject は per-service で良いが、集約 dora サマリ(DORA5 カード)が lead 中央値/CFR をサービス横断でプール(DORA が警告する行為)

## バーンダウン(issueActionBurndown.ts / incidentBurndown.ts 同一)

- **D-B1 MED これはバーンダウンでない**: remaining=cumulativeOpened−cumulativeResolved の net-open トレンド(burn-up)。ideal line/scope baseline/target/forecast なし。改名か ideal line 追加
- **D-B2 MED 期間前アイテムの解決で remaining が負→無音 clamp**: closedAt が窓内なら createdAt が窓前でも resolvedCounts 加算、max(0)(line 88)が歪みを隠す。opening backlog を seed するか窓内 open のみ計上
- **D-B3 MED 総/残の分母不一致**: countTotalItemsInPeriod は窓内、countRemainingItems は全期間 → 残 > 総 があり得る

## ベロシティ/フロー

- **D-C2 HIGH DevOps「ベロシティ」が incident 数、PR throughput ハードコード 0**(devopsReportData.ts:137): 完了作業の throughput に incident 流入を投入。closed issue/merged PR から算出するかカード削除
- **D-C1 LOW issue 数を「ベロシティ」と呼ぶ**: カウント自体は正(throughput が現代のフローメトリクス best practice)、名称が story-point velocity のアンチパターンと混同。「Throughput」に改名
- **D-C3 MED cycle time / WIP / aging なし**: createdAt/closedAt から median cycle time と WIP(closedAt===null)は自明に算出可能なのに未計算

## カバレッジ(riskScore.ts factor D)

- **D-D MED カバレッジを hard gate 化(Goodhart)**: factorD(41-45)が cov≥80→0/≥70→50/else 100 の恣意的崖。表示利用は正しいがリスクゲート化は target 化を招く。test 失敗ゲートは維持しカバレッジは soft 化、line/branch 区別を記録

## Seven Keys(executiveSevenKeys.ts)— 最良のフレームワーク忠実度

- **E1 適合(gap なし)**: per-project×7キー RAG、月次スナップショット+MoM 差分、観測不能キーは grey。キー名は正典一致、財務は意図的に除外
- **D-E2 MED-HIGH 質問票未配線で K1/K2/K6/K7 が恒久 grey**: q()(79-81)が grey 既定、投入経路なし → 経営マトリクスの半分が空白。月次フォーム→snapshot の取込を作るか経営一枚が構造的に半盲
- **D-E3 MED K3 が予測可能性でなく生の進捗率**: workAndSchedule(83-87)が progressPct<70 で yellow。中間点で 50% は正常なのに yellow。経過時間の期待進捗と比較すべき
- **D-E4 LOW-MED GitHub 閾値が未較正**(ADR-0010 が認知): scope 変更を絶対数でなくバックログ相対に

## 投資家/ILPA(investorMetrics.ts)

- **D-F1 MED-HIGH KPI が薄く無意味に集約**: 4 メトリクスのみ。revenue/EBITDA を持分%重みなしで企業横断 sum、delay_days/high_sev を reduce で合算(異種企業の遅延日数合計は無意味)。per-company 報告か持分加重に
- **D-F2 MED「2027 改訂をデータで吸収」は構造変更に不十分**: v2.0/PCMT 改訂は構造(手数料内訳・per-company キャッシュフロー・vintage)を変える。flat Record<string,number> では表現不能。境界を文書化
- **D-F3 MED-HIGH ボードパック規律なし**: target/variance/trend/cohort なし、単一現在値のみ、通貨整形なし。target+variance 列と trend 系列を追加、示唆は LLM prose スロットへ

## 報告設計

- **G RAG 規律は良好**: ExecutiveSevenKeysView は色+形状+テキスト(●▲■◇)で色覚安全
- **D-G1 MED 経営一枚に commentary/forecast スロットなし**、**D-G2 MED forecast-vs-actual が全ペルソナで不在**、**D-G3 LOW doraMetrics ヘッダが「4指標」で陳腐化**

## 主要出典
dora.dev/research/2024, insights/dora-metrics-history, guides/dora-metrics; cd.foundation dora-5-metrics; atlassian agile metrics; kollabe flow-metrics; ilpa.org PCMT/reporting-template/refresh; bdo.com ilpa Q1-2026; tamarac seven-keys

## T27 独立敵対レビュー(commit 55fd080, 2 名の独立レビュアー + orchestrator 直読)

CI green(mise run ci exit 0)だが、**共通の系統的欠陥**: lib のユニット関数は概ね正しいが、**production 配線層(devopsReportData.ts / prjopsReportData.ts)が全期間/誤入力を渡す or 何にも繋がっておらず、ハードコード定数メトリクス・dead helper が「配線済み」を装う**。「無音スタブ・過大申告禁止」に複数違反。→ REVISE。

### DORA/フロー(Reviewer A + orchestrator が devopsReportData.ts:60-235 を直読・確認)
- **R-A1 CRITICAL: fetchDeployments に時間窓なし**(devopsReportData.ts:71-77 `WHERE env='prod'` のみ)。pm_events は窓付き(:78-87)なのに deployments は全期間。→ DF=(全期間デプロイ数/periodDays)*7、lead time・CFR も全履歴 = **DORA 5 指標中 3 つが無意味**。是正: deployments も [periodStart,periodEnd) で窓付けフェッチ
- **R-A2 HIGH: causedByDeployment の過剰帰属**(:212-220 `.some(d.causedFailure && detectedAt>=d.deployedAt)`)。全期間デプロイ + 因果時間窓なし → プロジェクトに過去 1 度でも rollback があれば以後の**無関係障害**まで変更起因扱いで復旧中央値を汚染。是正: 窓付きデプロイ + deploy→incident の妥当な因果窓(例: 検知前 N 時間/日以内)
- **R-A3 HIGH: 集約が median-of-medians / 出来高無視の median-of-rates**(aggregateDoraByProject :143-160)。CFR は per-project 率の median → [100%×1デプロイ, 1%×100デプロイ]→median([100,1])=50.5% vs 真値 ~2%(25倍)。是正: プール生データから算出(CFR=総失敗/総デプロイ、lead/recovery=全レコードのプール中央値)、DF は sum 維持
- **R-A4 HIGH: unplannedRework が false ハードコード**(:193)→ reworkRate は常に 0 の dead 定数を「elite」表示(silent stub)。rework は DORA 5 指標でない(2024 第5は reliability)。是正: **rework メトリクス+バンドを削除**(実データ源が無い定数 0 の偽メトリクスを出さない)。または実信号に配線
- **R-A5 MED: velocity の cycle time/WIP が incident 母集団、throughput は issue/PR**(:229-230 vs countThroughput)。エンティティ不一致。是正: 同一母集団(issue/PR)で算出、算出不能なら省略/正直にラベル(混在数値を velocity 下に出さない)
- **R-A6 MED: total(窓内)vs remaining(全期間 open)母集団不一致**(:224-225)→ remaining>total。是正: 窓/母集団を統一
- **R-A7 MED: throughput が reopen→close を二重計上・not_planned close も計上**(:121 subject 重複排除なし)。是正: subject id で重複排除、not_planned 除外
- **R-A8 LOW: DF バンドの "low" が到達不能 dead code**(doraMetrics.ts:95-104、null 化で freq>0 常真)→ 週未満デプロイが "medium" 誤分類。是正: DORA 2024 に沿って low 到達可能に
- **R-A9 LOW: clamp 削除で汚データ時に負の remaining**(incidentBurndown.ts:95 / issueActionBurndown.ts:92)。是正: 正しい seed 後に 0 床を再導入 or バリデート
- CONFIRMED-FIXED: MTTR の lib フィルタ(median+変更起因+未解決除外 NEW-2)、coverage ソフト化(D-D、線形単調 [0,100])、burndown の created前/窓内解決 seed(チャート)

### Seven Keys/投資家(Reviewer B が確認)
- **R-B1 CRITICAL: Seven Keys 質問票 ingestion が stub**(applySevenKeysQuestionnaire executiveSevenKeys.ts:92)。production caller ゼロ、`SevenKeysQuestionnaireRecord[]` のデータ源なし。本番 DI は `InMemoryPrjopsReportDataProvider([],[])` で空 → K1/K2/K6/K7 は本番で恒久 grey のまま(T27 で不変)。dead helper + それだけを叩くテストが「配線済み」を偽装。是正: **production から到達可能に配線**(provider メソッド/DI seam → prjopsReportData → q())。実ストアが無ければ本番 DI が供給できる形にし、無ければ「データ源未整備で grey」と正直に文書化(dead helper+テストで wired を装わない)
- **R-B2 HIGH: board-pack target/variance/trend が本番で dead**(buildInvestorSummary prjopsReportData.ts:208-219 が boardPack 第3引数を渡さない)。trend は入力配列の**素通しエコー**(investorMetrics.ts:111)で未計算。テストはエコー配列を assert。是正: boardPack を provider 源から配線し、**trend を決定的に算出**(履歴スナップショット等)。履歴源が無ければ正直に文書化しエコーテストを撤去
- **R-B3 MED: per-company milestoneDelayDays が捏造**(prjopsReportData.ts:215 `p.isOverdue?1:0`)。実遅延(due vs now/完了)を算出 or NA。投資家系を触る本タスクで是正
- **R-B4 MED: InvestorReportView が unit:"currency" を生数値表示**(通貨記号/桁区切りなし)。決定的整形を追加(数値はコード算出のまま)
- **R-B5 LOW: 持分加重テストが対称入力(100/100)で弱い**。非対称(100/200@50/50→150)に。trend エコーテストは撤去
- CONFIRMED-FIXED: K3 経過時間期待比較(D-E3)、持分加重の**式**(Σ value×own/100)、View に生ハードコード数値なし
