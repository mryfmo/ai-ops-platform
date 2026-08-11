# T27 (G6): メトリクス正しさ — DORA/throughput + Seven Keys 質問票 + 投資家 board-pack

## Objective

監査 `.orchestration/audit/2026-07-09-bestpractice-D-metrics.md` の HIGH×2 + MED-HIGH×3 + 選定 MED を是正。**必読**。数値方法論の誤りを正典(dora.dev 2024 / ILPA PCMT / Seven Keys)に合わせる。設計原則2(数値はコード算出・決定的、LLM は文章スロットのみ)を厳守。

## ブランチ

- `agent/T27` を `agent/T26` から作成、PR base は `agent/T26`。着手前に **必ず /compact**

## 是正項目（MUST: HIGH + MED-HIGH）

### D-A1 HIGH: DORA 復旧時間の方法論誤り
- `packages/devops/src/lib/doraMetrics.ts:65-70` `calcMeanTimeToRestoreHours` が全 IncidentRecord を平均。正典は (a) **変更起因の障害のみ**(`causedFailure` 連動)(b) **中央値**(既存 `median()` line 32 を使う)(c) 2023 で "failed deployment recovery time" に改名し throughput 群へ再分類。3 点すべて是正。ヘッダ/カード名も更新(D-G3: 「4指標」表記の陳腐化解消)
- テスト: 変更起因でない incident が除外される、median が使われる、空集合の扱い(D-A6 参照)

### D-C2 HIGH: DevOps「ベロシティ」が incident 数 + PR throughput ハードコード 0
- `packages/devops/src/devopsReportData.ts:137` が完了作業 throughput に incident 流入数を投入、PR throughput は 0 固定。**closed issue / merged PR から実 throughput を算出**するか、算出不能ならカード削除(無音の 0 表示禁止)。名称は「Throughput」に(D-C1)
- テスト: throughput が closed issue/merged PR 由来であること、incident 数が混入しないこと

### D-E2 MED-HIGH: Seven Keys 質問票の未配線(K1/K2/K6/K7 恒久 grey)
- `packages/prjops/src/lib/executiveSevenKeys.ts:79-81` `q()` が grey 既定で投入経路なし → 経営マトリクスの半分が構造的に空白。**月次質問票 → snapshot の取込経路を追加**(決定的な入力データ構造 + lib 関数で RAG 判定)。質問票が無い月は grey のままで正しいが、投入されたら反映されること
- 実データ源が無い場合は「質問票入力スキーマ + 取込関数 + それを使うテスト」を実装し、未入力時 grey・入力時反映を検証(創作データで固定値を埋めない)
- テスト: 質問票入力で K1/K2/K6/K7 が RAG 化、未入力で grey

### D-F1 MED-HIGH: 投資家 KPI の無意味な集約
- `packages/prjops/src/lib/investorMetrics.ts` が revenue/EBITDA を持分%重みなしで企業横断 sum、delay_days/high_sev を単純合算(異種企業の遅延日数合計は無意味)。**per-company 報告** または **持分加重集計**に。合算が無意味な指標は per-company 明細で出す
- テスト: 持分加重 or per-company の算出、単純異種合算をしていないこと

### D-F3 MED-HIGH: ボードパック規律なし
- 同 investor 系: target/variance/trend/cohort なし、単一現在値のみ、通貨整形なし。**target + variance 列と trend 系列を追加**(決定的算出)。示唆・コメンタリは LLM の文章スロットへ(数値は生成させない)
- テスト: variance = actual − target の算出、trend 系列の生成

## 是正項目（SHOULD: MED — 時間内で可能な範囲、無理なら report に残タスク明記）

- **D-A6 MED**: ゼロデータが 0 を返し「エリート」に見える。空入力で null/NA(「未取得」表示)を返す。`doraMetrics.ts` の空集合、test 117-124 の固定期待を更新
- **D-A5 MED**: rework 入力フラグの意味が逆(`doraMetrics.ts:23` の定義)。「このデプロイ自体が計画外修正か」に定義を正し、コメント/型で明示
- **D-B1/B2/B3 MED バーンダウン**: `issueActionBurndown.ts` / `incidentBurndown.ts` は net-open トレンド(burn-up)であって burndown でない。**改名 or ideal line/scope baseline 追加**。B2: 窓前作成・窓内解決で remaining 負→無音 clamp(line 88)を是正(opening backlog を seed するか窓内 open のみ計上)。B3: 総(窓内)/残(全期間)の分母不一致を統一
- **D-E3 MED**: Seven Keys K3 が予測可能性でなく生進捗率(`executiveSevenKeys.ts:83-87`)。経過時間の期待進捗と比較する判定に
- **D-C3 MED**: cycle time(median)/ WIP(closedAt===null)を createdAt/closedAt から算出し追加
- **D-D MED**: カバレッジのリスクゲート化(Goodhart)。`riskScore.ts` factorD の崖をソフト化、test 失敗ゲートは維持、line/branch 区別を記録

## 前グループからの繰り越し(carry-forward — 判明していれば取り込む)

- メトリクス status を shared enum に統一(散在する文字列定数の一元化)
- event queue の `dead=0` gauge を明示的に 0 出力(T25 の EVENT_QUEUE_STATUSES リセットで dead 行が無い時も 0 を出す)
- double-signal(webhook + poll 二重取込)の統合テスト
- ※ 実在を確認できないものは無理に作らず report に「該当なし/未確認」と記録

## 規約 / Forbidden

- DoD: 並列 `mise run ci` green。**依存追加なし**。マージ禁止。`.orchestration/` は commit しない。audit_log への UPDATE/DELETE なし。破壊的マイグレーション禁止(スキーマ変更は migrations/NNN_*.sql 新規 + schema.sql 最新形、既存 ALTER inline 禁止)
- **数値は決定的にコード算出、LLM は文章スロットのみ**(設計原則2)。メトリクス方法論の変更は dora.dev / ILPA / Seven Keys 正典に根拠を置き report に出典明記
- **無音スタブ・過大申告禁止・検証の偽装禁止**。実データ源が無い箇所は創作値で埋めず、入力スキーマ+取込関数+テストで「未入力時の正しい挙動」を実装する。算出不能なカードは 0 表示でなく削除 or 明示的 NA
- 根拠 ID ヘッダ必須(traceability が検証)。spec ID は prjops/devops で名前空間が別なので所属を確認

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T27-report.md`(各メトリクス方法論変更の正典出典を含む。SHOULD/carry-forward の実施可否を明記)
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T27-validation.txt`(mise run ci 全ステップの exit code 証跡)
- sandbox / learning / autoskill: 同ディレクトリ T27-*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T27 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 90

---

## 先行監査による精密化(独立エージェントが現行コードに突合。監査の path/行は一部陳腐化。以下を正とする)

### パス訂正(監査は場所が古い)
- `issueActionBurndown.ts` は **prjops**: `packages/prjops/src/lib/issueActionBurndown.ts`(clamp は **L88**)
- `incidentBurndown.ts` は devops: `packages/devops/src/lib/incidentBurndown.ts`(clamp は **L91**)
- `devopsReportData.ts` は **web**: `packages/web/src/server/reportData/devopsReportData.ts`(監査の L137 は一致)

### 各項目の現行 file:line と修正の要点
- **D-A1(MTTR)**: `doraMetrics.ts` `calcMeanTimeToRestoreHours` **L66-70** が mean で全 incident 対象。`IncidentRecord`(**L26-30**)に**変更起因リンク用フィールドが無い**(`causedFailure` は `DeploymentRecord` L22 のみ)→ **IncidentRecord に linkage フィールドを追加**する必要。`median()` は **L32 に既存**、これを使う。テスト: incidents [2h(linked),100h(unlinked)] → median(linked のみ)=**2**(51 でない)
- **D-A5(rework 逆転)**: `doraMetrics.ts` `reworked?` + コメント **L23**「デプロイ後に手戻り修正が必要だったか」を正典「このデプロイ自体が計画外修正か」へ
- **D-A6(空=0)**: 空入力が **L41/53/60/67** で 0。`deployStateMachineAndDora.test.ts:117-124` が固定 → null/NA へ。**テストを変更**して `calculateDoraSummary([],[],7)` が null を返すことを検証
- **D-A2/3/4(バンド欠如)**: バンド分類器を追加。ヘッダ **L6/L11** の「4指標」を実際の 5 指標に更新(=D-G3)
- **D-A7(横断プール)**: `devopsReportData.ts:139` が `calculateDoraSummary` を全 scoped プロジェクトのプール配列で呼ぶ(per-service 分割は L140-147 のみ)。集約は中央値を横断プールしない
- **D-B1/B2/B3(バーンダウン)**: net-open burn-up。clamp=incident **L91**/issue **L88**、`bucketIndex`(L37-43)が created/detected の窓外を無視して resolve を計上→負→無音 clamp(`incidentBurndown.test.ts:52-58` が固定)。総(窓内)/残(全期間: `countRemaining*` に窓フィルタ無し)不一致。両方に同一窓を適用
- **D-C2(velocity)**: `devopsReportData.ts:` **L137** `velocity:{ issueThroughput: countTotalIncidentsInPeriod(...), prThroughput: 0 }`。型 L81。closed issue/merged PR 由来へ or カード削除
- **D-C3**: cycle time(median)/WIP(closedAt===null)を追加(burndown 入力に createdAt/closedAt あり)
- **D-D(coverage gate)**: `riskScore.ts` `factorD_testResult` **L41-45** の崖(`riskScore.test.ts:43-57` 固定)。※ `devopsReportData.ts:138` で `coveragePct` は **null**(そもそも実データ未配線)→ ソフト化 + 実配線 or 明示 NA
- **D-E2(Seven Keys 質問票)**: `executiveSevenKeys.ts` `q()` **L79-81** が grey。型は `prjopsReportData.ts:134` で end-to-end 配線済みだが**投入経路が無い**(外部 prjops-data repo 不在)。→ 月次質問票入力スキーマ + 取込 + テスト(投入で K1/K2/K6/K7 が RAG 化、未投入で grey)
- **D-E3(K3)**: `workAndSchedule` **L83-87** が生 progress%<70 で yellow(定数 L72)。経過時間期待進捗と比較。テスト: 中間点 50%→green
- **D-F1(投資家集約)**: `investorMetrics.ts` **L22-69**、revenue/EBITDA を持分重みなし sum(**L33/L45**)、delay_days(L56)/high_sev(L67)を reduce 合算。持分加重 or per-company。テスト: 50% 保有 2 社→加重 revenue = 単純 sum の半分
- **D-F3(board-pack)**: `InvestorMetricValue` **L82-88** が単一 value のみ。target+variance 列 + trend 系列。テスト: variance vs target の存在

### 監査が見落とした NEW 欠陥(両方 `devopsReportData.ts` の DORA 配線層)— 併せて是正
- **NEW-1 rework rate が CFR と恒等(重複)**: **L126-127** で `causedFailure` と `reworked` が**同一述語** `state==="rolling_back"||"rolled_back"` から導出 → `deploymentReworkRatePct` は本番で常に `changeFailureRatePct` と数値一致(rework 指標が無意味)。D-A5 と合わせて是正(rework の意味を分離するか指標を統合)
- **NEW-2 未解決 incident を 0h 復旧として計上→MTTR 過小**: **L118-119** で `resolved_at===null` 時 `resolvedAt` が `detectedAt` にフォールバックし 0h → 未解決障害が mean を希釈。未解決は除外(or censored 扱い)。D-A1 と合わせて是正
- 軽微: lead time が `created_at→updated_at`(L122-124)を commit→deploy proxy に使うが `updated_at` は最終更新で deploy 完了でない(信頼性低い proxy、低優先で report に注記)

### テストファイル(命名の参照先)+ 根拠 ID ヘッダ(traceability 維持)
- doraMetrics: `packages/devops/tests/deployStateMachineAndDora.test.ts`(REQ-023/AC-023b)
- incidentBurndown: `packages/devops/tests/incidentBurndown.test.ts`(ADR-0005)
- issueActionBurndown: `packages/prjops/tests/issueActionBurndown.test.ts`(ADR-0005/PRF-03)
- devopsReportData: `packages/web/tests/reportData/devopsReportData.test.ts`(ADR-0005/原則6)
- riskScore: `packages/devops/tests/riskScore.test.ts`(SPEC-INT-021/REQ-011)
- executiveSevenKeys: `packages/prjops/tests/executiveSevenKeys.test.ts`(REQ-038/SPEC-INT-065/AC-038-1/ADR-0010)
- investorMetrics: `packages/prjops/tests/investorMetrics.test.ts`(REQ-039/SPEC-INT-066/AC-039-1/ADR-0011)

---

## revise(独立敵対 2 名 + orchestrator 直読。監査 D-metrics「T27 独立敵対レビュー」参照)

commit 55fd080 は CI green だが **系統的欠陥**: lib ユニット関数は概ね正しいのに、**production 配線が全期間/誤入力を渡す or 何にも繋がらず、ハードコード定数(rework=0)や dead helper が「配線済み」を偽装**。「無音スタブ・過大申告禁止」に複数違反。**継続(/compact 不要)**。原則: 各メトリクスは「実データに正しく窓付き配線」か「正直に削除/NA 表示」の二択。ハードコード定数メトリクス・dead helper+それだけを叩くテスト・入力エコーの偽計算は禁止。

### MUST-FIX(blocking)

- **R-A1 CRITICAL: fetchDeployments を窓付けに** `devopsReportData.ts:71-77`。pm_events と同様 `deployed(updated_at/created_at) >= periodStart AND < periodEnd` で絞る。DF/lead/CFR/rework がすべて期間窓のデプロイのみを見るように。テスト: 窓外の古いデプロイが DF/CFR に混入しないこと
- **R-A2 HIGH: causedByDeployment に因果時間窓** `devopsReportData.ts:212-220`。窓付きデプロイ(R-A1)に加え、deploy→incident を「検知前の妥当な窓内(例: 検知前 X 時間、根拠を report に)」に限定。テスト: 古い/無関係な過去 rollback が後続障害を変更起因にしないこと(現在テスト欠落)
- **R-A3 HIGH: 集約をプール算出に** `aggregateDoraByProject :143-160`。median-of-medians と出来高無視 median-of-rates を廃止。**CFR=Σ失敗/Σデプロイ、rework(残すなら)同様、lead/recovery=全スコープレコードのプール中央値**、DF=sum 維持。テスト: A(1デプロイ100%CFR)+B(100デプロイ1%CFR)→ ~2%(50.5% でない)
- **R-A4 HIGH: rework メトリクスを削除**(実データ源なしの定数 0 偽メトリクス)。`unplannedRework` ハードコード(:193)、`calcDeploymentReworkRatePct`、`deploymentReworkRate` バンド、DoraSummary/DoraBands の該当フィールド、View 表示、テストの reworkRate===0 pin をすべて撤去。rework は DORA 5 指標でない(2024 第5=reliability)。将来実装は follow-up に記録
- **R-B1 CRITICAL: Seven Keys 質問票を production から到達可能に配線** or 正直化。`applySevenKeysQuestionnaire`(executiveSevenKeys.ts:92)は本番 caller ゼロ・データ源なしの dead helper。是正: PrjopsReportDataProvider に questionnaire 供給 seam(メソッド/引数)を追加し `prjopsReportData` → `q()` まで通し、**本番 DI(executive-summary / investor route の InMemoryPrjopsReportDataProvider([],[]))が questionnaire を供給できる形**にする。実ストアが無いなら、その旨を route の残課題として明記し、「供給されれば RAG 化・未供給なら grey」を production 経路で実証(dead helper+テストで wired を装わない)。**創作値で K を埋めない**
- **R-B2 HIGH: board-pack を配線 + trend を実算出** or 正直化。`buildInvestorSummary`(prjopsReportData.ts:208-219)が boardPack を渡さず target/variance/trend が本番 null/[]。trend は入力エコー(investorMetrics.ts:111)。是正: boardPack を provider 源から配線し **trend を決定的に算出**(履歴スナップショット等)。履歴源が無ければ正直に文書化し、**エコー配列を assert するテストを撤去**(未計算を計算済みに見せない)

### SHOULD-FIX(cheap 正しさ/正直さ)

- **R-A5 MED**: velocity の cycle time/WIP を throughput と同一母集団(issue/PR)で算出。issue の open→close が算出不能なら velocity 下の cycle/WIP を省略 or incident 由来と明示ラベル(混在を velocity と偽らない)`devopsReportData.ts:229-230`
- **R-A6 MED**: total(窓内)/remaining(全期間)母集団を統一 `devopsReportData.ts:224-225`(remaining>total を解消)
- **R-A7 MED**: throughput の reopen→close 二重計上を subject id 重複排除、not_planned close 除外 `countThroughput :113-127`
- **R-A8 LOW**: DF バンドの "low" を到達可能に(DORA 2024 準拠)`doraMetrics.ts:95-104`
- **R-A9 LOW**: burndown の負 remaining を正しい seed 後に 0 床再導入 or バリデート `incidentBurndown.ts:95 / issueActionBurndown.ts:92`
- **R-B3 MED**: `milestoneDelayDays`(prjopsReportData.ts:215 `isOverdue?1:0`)の捏造を実遅延算出 or NA
- **R-B4 MED**: InvestorReportView の unit:"currency" フィールドに決定的通貨整形(桁区切り/記号)。数値はコード算出のまま、整形のみ
- **R-B5 LOW**: 持分加重テストを非対称(100/200@50/50→150)に強化。trend エコーテスト撤去

### DoD(revise)

- 並列 `mise run ci` green。依存追加なし。マージ禁止。`.orchestration/` は commit しない。破壊的マイグレーション禁止。**無音スタブ・過大申告・検証の偽装・入力エコーの偽計算・創作メトリクス値を厳禁**。各方法論変更は dora.dev 2024 / ILPA 正典の根拠を report に。実装できない項目は「削除」か「NA+follow-up 明記」で正直に。push して PR #22 を更新

---

## revise 第3巡(最終ポリッシュ。独立反証パスの残発見。BLOCKING は全て確認済み、以下のみ)

commit 9171962 は全 BLOCKING 修正済み・CI green。残る実欠陥のみ是正。**継続(/compact 不要)**。

### MUST-FIX

- **F1 methodology: プール集約が multi-project incident を重複計上** `devopsReportData.ts` の `doraIncidentInputs` は incident×affected_project ごとに 1 レコードを flatMap 生成しており、per-project `doraByProject` には正しいが、**プール集約 `dora: calculateDoraSummary(doraInputs, doraIncidentInputs, periodDays)` では 3 プロジェクトに影響する 1 incident の復旧時間がプール中央値に 3 回入る**。是正: プール集約に渡す incident は **incident 単位で重複排除**(affected_projects の重複展開を per-project 用途に限定し、プール recovery-time 算出は 1 incident=1 エントリ)。テスト: 3 プロジェクトに影響する 1 incident がプール recovery 中央値に 1 回だけ寄与すること
- **F2 検証の偽装: trend テストがエコーで何も証明しない** financial-input メトリクスの `compute(companies, snapshot)` は `financialInputs[id] ?? weightedSum(...)` のため、事前集約済み snapshot(`{revenue:60}`)では snapshot 値をそのまま返し、trend が入力と同一 → 現テスト `history:[{revenue:60},{revenue:90}]`→`trend:[60,90]` は計算を証明しない。是正: **per-company の history snapshot**(各社の生 revenue×持分)を与え、`weightedSum` が実際に再計算した非自明な系列(どの入力配列とも異なる値)を trend が返すことを assert。または trend が「メトリクスの時系列＝各 snapshot の算出値」である旨を正直に doc 化しエコー assert を廃止。**偽の計算証明を残さない**

### SHOULD-FIX(cheap)

- **F3 左端の過少帰属**: `doraInputs` を `updated_at>=periodStart` で窓付けするため、periodStart 直前(かつ窓内 incident の 24h 以内)の rollback が除外され左端 incident が変更起因にならず CFR/recovery を過少計上。是正: **因果判定用のデプロイのみ `periodStart - 24h` から取得**(DF/CFR の分母は [start,end) 窓のまま維持)。または保守的挙動として report に明記
- **F4 dead export 掃除**: `countTotalIncidentsInPeriod` / `countTotalItemsInPeriod` はレポート層で未使用(active-in-window カウンタに置換済み)。他に利用が無いことを確認し削除(自己テストも)。利用があれば残す

### DoD(第3巡)

- 並列 `mise run ci` green。依存追加なし。**検証の偽装・エコーの偽計算を残さない**。push して PR #22 更新。データ源未整備(prjops/investor provider が空)は既に正直な残課題として記録済み — 本巡では触れない
