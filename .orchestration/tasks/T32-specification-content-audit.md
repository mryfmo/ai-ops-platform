# T32: 仕様そのものの内容監査(ヌケモレ・矛盾・曖昧・間違い)

## 背景と目的

T30 監査の「仕様」面は 3 所見(PRG-023/024/025)しか出しておらず、その全てが「仕様が監査できる状態にない」というメタ所見である。**仕様の中身をヌケモレ・矛盾・曖昧・間違いの観点で読んだ精査は一度も行われていない**(orchestrator が監査設計の穴として認定)。本タスクでその空白を埋める。

確定している事実(orchestrator 実測、2026-07-10。**数値はこの値を使うこと** — 初版で orchestrator が誤記したため訂正済み):

- `spec-ids/*.json` の仕様 ID は **PrjOps 156**(REQ 34 / SPEC-EXT 27 / SPEC-INT 30 / ISS 10 / TOBE 10 / ASM 7 / AC 38)+ **DevOps 139**(REQ 25 / SPEC-EXT 25 / SPEC-INT 30 / TH 7 / ISS 8 / AC 44)= **295 個**。ISS/TOBE/ASM を落とさないこと
- `docs/spec/spec-id-catalog.md` の定義行は **32 行**。ただし **DevOps `REQ-032` は `devops.json` に存在しない孤児定義**(orchestrator が codex の AGMSG-NOTE を受けて独立再検証、孤児は厳密にこの 1 件)。したがって「索引済みかつ定義あり」は **31 件**、**未定義は 264 件(89.5%)**。作業 3 の対象はこの **264 件**(初版の 263 は orchestrator の誤り。カタログ 32 行が全て索引に対応する前提を検証していなかった)
- **孤児定義そのものを SPC 所見として起票すること**: カタログ DevOps 節が `REQ-032` を定義する一方、`prjops.json` には `REQ-032` が存在し(PrjOps 節に定義なし)、同番号が別システムに存在する。PRG-024 が指摘する名前空間・部分文字列一致の危険が現実化している事例として扱う
- ADR は **14 本**(0001〜0014)。`AGENTS.md` の参照リストは 0013 までしか列挙しておらず ADR-0014 が漏れている(所見候補)
- REQ 欠番は両システムに存在する(orchestrator 実測。初版で PrjOps しか挙げていなかったのは不足):
  - PrjOps: **REQ-022〜029 の 8 件**(範囲 001-042)
  - DevOps: **REQ-004〜009、013、014、032〜040 の 17 件**(範囲 001-042)
  - 合計 25 件の欠番。各欠番について削除痕跡(git log / ADR)を調査し、不明なら不明と記す。他カテゴリ(SPEC-EXT/SPEC-INT/TH/AC/ISS/TOBE/ASM)の欠番も同様に全数洗うこと
- 正本とされる外部ソース文書(`README.md:6-8` が挙げる PrjOps.zip DOC-00〜07、DevOps.zip DOC-ANL-01〜OPS-06、PPTX)、および `VERIFICATION_REPORT.md` が参照する `/mnt/user-data/uploads` はリポジトリに存在しない

## orchestrator 独立調査で既に確定した所見(検証の上で正本に取り込むこと。これに限定せず全数探索する)

いずれも orchestrator 側の独立調査で file:line 確認済み。T32 では**再検証した上で**採否を判断し、SPC 連番で正本に収録すること(反証できたものは反証根拠を書く)。

- **間違い**: `docs/spec/data-model.md:25` の `seven_keys_snapshots` が `name`/`keys`/`trace_id` を主要カラムと記すが、実体(`schema.sql:73-83`)は `snapshot_id`/`keys_rag`/`next_actions` であり **`trace_id` カラムは存在しない**(他テーブルは全て持つため単なる略記ではない)
- **間違い**: `data-model.md:9` は `events.status` を 4 値(queued/dispatched/delayed/done)と記すが、`schema.sql:18` の CHECK は **`dead` を含む 5 値**(DLQ 状態が仕様から欠落)
- **間違い**: `docs/adr/0001-monorepo.md:28` が保持期間(PrjOps 5 年 / DevOps 1 年)を「実装する」と記すが、`packages/shared/src/auditLog.ts` に保持ロジックは無く、`schema.sql:213-216` はコメント例のみ。PrjOps 5 年の機構はリポジトリ内に存在しない
- **矛盾**: `schema.sql:213` と `adr/0005:42` が「13 か月ローテーション」と「1 年保持」を等価として並記(12 ≠ 13。実装者はどちらが要求か判定できない)
- **曖昧**: `adr/0010:27` が RAG 閾値(進捗 70%、scope change 2/5、review wait 48/72h **等**)を「初期校正値であり正典の固定値ではない」と自ら無効化。SPEC-INT-065 の「決定的 RAG」と整合しない
- **曖昧**: `adr/0003:14,39` の cron 最短間隔「概ね/程度 5 分」、`adr/0013:4` の extended-thinking budget「未指定時は既定値」(既定値が未記載)、`adr/0005:31` の通知遅延「通常数秒」
- **ヌケモレ**: `data-model.md` が `schema_migrations` テーブルと `events` のリトライ/DLQ 列(`attempts`/`next_attempt_at`/`claimed_at`/`dedupe_key`)を記載していない
- **ヌケモレ**: `README.md:8` の規模(50 件、設計上限 100 件/100 社)に対応する REQ/SPEC/AC が索引・カタログのどこにも無く、テストも DB 制約も無い(反証不能な設計上限)
- **ヌケモレ**: PgCostGuard で予約成功後に reconcile が失敗した場合(孤児予約 → 日次上限の目減り)の振る舞いを規定する仕様文が存在しない
- **設計原則違反の候補**: `packages/shared/src/reporting/calculateReportMetrics.ts:8` と `finalizeReportJson.ts:28-30` がレポート数値を `process.env` から直読み(`AGENTS.md` 原則 7 の注入可能性、および原則 2 の「数値はデータから決定的に算出」の意図に反する)。`src/lib/` 直下ではないため原則 1 の字義違反ではない点を含めて判定すること

## 作業 1: ID 空間の整合性検証(機械的・全数)

`packages/traceability/spec-ids/{prjops,devops}.json`、`docs/spec/spec-id-catalog.md`、コード・テスト内の ID 参照を突合し、以下を**全数**列挙する:

- 欠番(REQ-022〜029 を含む。各カテゴリ REQ/SPEC-EXT/SPEC-INT/TH/AC で連番の穴を全て洗う)。欠番ごとに「意図的な削除の痕跡があるか(git log/ADR)」を調べ、不明なら不明と書く
- 定義文が存在しない ID の全リスト(228 件想定。カテゴリ別・システム別の件数表を付ける)
- コード/テストが参照するが索引に無い ID
- 索引にあるがコードからもテストからも参照されない ID(死んだ仕様 ID)
- 名前空間衝突(PrjOps と DevOps で同番号が別意味を持つもの)を全列挙し、`verifyTraceability` の部分文字列一致(PRG-024)で誤マッチしうる組み合わせ(例: `REQ-04` が `REQ-042` に、`AC-01` が `AC-018-1` にマッチ)を具体的に特定する
- テスト参照を持たない AC の全リスト(PRG-024 は率だけ述べており、どの AC かを特定していない)

## 作業 2: 存在する仕様文書の内容精査(ヌケモレ・矛盾・曖昧・間違い)

対象: `docs/spec/{overview,data-model,packages,spec-id-catalog}.md`、`docs/adr/*.md`(15 本)、`README.md` の仕様的記述、`AGENTS.md` の設計原則。

4 種の欠陥を区別して検出し、それぞれ file:line と該当引用を付す:

- **間違い(error)**: 記述をコードが反証するもの。例の探索軸: `data-model.md` の各テーブル/カラム定義 ⇔ `schema.sql` + `migrations/*.sql` の実体、ADR の決定 ⇔ 実装、`overview.md` の構成 ⇔ 実パッケージ
- **矛盾(contradiction)**: 文書間・文書内で両立しない記述。ADR 同士(特に保持期間、実行基盤、LLM 使い分け)、ADR ⇔ カタログ定義、`AGENTS.md` 設計原則 ⇔ 仕様、README の数値 ⇔ 仕様の数値
- **曖昧(ambiguity)**: 実装者が複数の解釈を取れる記述。定量化されていない形容詞(「適切に」「十分に」「速やかに」)、未定義用語、境界条件(境界を含むか否か)未指定、エラー時の振る舞い未定義、単数/複数・任意/必須が不明
- **ヌケモレ(omission)**: 仕様が触れていない必須事項。各 REQ について「正常系のみ定義され異常系が無い」「入力の妥当性範囲が無い」「同時実行時の挙動が無い」「削除・訂正の経路が無い」を確認する。特に T30/T30-V1 で発見された実装欠陥(PRG-041 レプリカ二重実行、PRG-042 暦の地平線、PRG-044 クロスプロジェクト漏えい、PRG-047 配信 TOCTOU、PRG-048 監査主体)について、**「そもそも仕様がその事態を規定していたか」を遡って判定する**(規定していなければ仕様のヌケモレとして起票。実装バグではなく仕様欠落が根本原因である可能性を検証する)

## 作業 3: 事実上の仕様の逆再構成(定義文が無い 228 件)

定義文の無い ID について、実装とテストから振る舞いを復元し、以下を出力する:

対象は定義文の無い **263 件**(ISS/TOBE/ASM を含む。ASM は前提条件、ISS は課題、TOBE は将来像であり、REQ と同列の「要求」ではない可能性がある — 種別の性格差を踏まえて復元方針を書き分けること)。

- ID ごとに: 推定される要求内容(1-3 文)、根拠(実装 file:line + テスト file:line)、確信度(high/medium/low)、復元不能なら「復元不能」と明記(その ID は仕様喪失として起票)
- 復元結果を ADR・カタログ・`AGENTS.md` に突き合わせ、**矛盾**と**曖昧**を摘出する(正本が無くても矛盾は検出できる)
- 復元不能 ID と、実装がありながら仕様意図が不明な箇所を、PRG-023(正規化コーパス整備)の入力として一覧化

**重要**: 復元は「実装がそうなっているから仕様もそうだ」という正当化に使ってはならない。復元はあくまで**現状の記述**であり、それが正しい要求かどうかは別問題である旨を各項目に明記すること(実装追認の禁止)。

## 成果物

正本: `.orchestration/audit/specification_content_audit.md`

- 冒頭: ID 空間の統計表(システム別・カテゴリ別の総数/定義文あり/欠番/死に ID/テスト無し AC)
- 所見は `SPC-001` から連番。各所見: 種別(ヌケモレ/矛盾/曖昧/間違い)、対象(文書 file:line または ID)、引用、なぜ問題か、重大度(CRITICAL/HIGH/MED/LOW)、推奨対処
- 作業 3 の復元表(別セクションまたは別ファイル `.orchestration/audit/spec_reconstruction.md`)
- 既存 50 所見との関係: 仕様欠落が根本原因である実装所見があれば PRG-ID を相互参照

## 制約

- **read-only**: 製品コード・docs・仕様・スキーマの変更禁止。書き込みは `.orchestration/` 配下のみ
- forbidden_actions: code-edits、push、merge、dependency-changes、real-llm-calls、git-checkout/reset、既存監査所見の改変、実装追認による仕様の正当化
- 憶測で仕様を「補完」しない。不明は不明と書く。外部ソース文書は入手不能である前提で作業する
- 網羅優先。作業 1 は全数(サンプリング禁止)、作業 3 は 228 件全件を対象とする

## revise 第 1 巡(orchestrator 検証)

内容は検証済みで正しい。orchestrator が独立に再実装した集計は **295 / 64 / 36 を完全再現**し、`ISS-01 → ISS-010` の部分文字列衝突が厳密に 1 件であること、`AC-016-1` がコード・テストから参照されながら索引に無いこと、`StandardReportPayload`(`reportSchema.ts:24-34`)が tenant/project/source を一切持たないこと(= PRG-044 の根本原因が仕様欠落であること)も現物で確認した。私の候補 10 件のうち原則 1/7 違反の主張を反証した判断も妥当(当該ファイルは `src/lib/` でも外部クライアントでもない CLI 合成スクリプトである)。SPC-021 として provenance 未規定を残した処理も正しい。

以下のみ修正すること。

**MUST 1(集計規則の明文化 — 再現性の欠陥)**

`dead=64` と `testless AC=36` は、**監査文書に書かれた方法からは再現できない**。orchestrator は `T32-analyze.mjs` を読んで初めて再現できた。実際の規則は次のとおりで、これが文書に無い:

- 集計キーは ID ではなく **`(system, id)` の複合キー**(全 295 キー)。同番号の cross-system 衝突 56 件を潰さない
- 参照の system スコープ: `packages/prjops/**` の参照は PrjOps のみ、`packages/devops/**` は DevOps のみ、`packages/shared|server|web/**` は**両システムに計上**、`.github/**` も対象
- `kind` 判定: `/tests/` 配下または `*.test.*` は test、`docs/**`・`runbooks/**`・`README.md`・`AGENTS.md` は doc。**dead 判定の source/test コーパスから doc は除外**
- 除外: `spec-ids/*.json` 自身、生成された traceability 出力、`verifyTraceability` 自身、`.orchestration/**`、`node_modules`/`dist`/`.next`/`coverage`/`.git`

これを `specification_content_audit.md` と `T32-id-inventory.md` の冒頭に「集計規則」節として明記せよ。規則が無いまま数値だけ提示するのは、PRG-022(検証レポートの数値が自己矛盾し再現不能)と同種の欠陥である。

**MUST 2(メッセージ契約違反)**

T32 の `AGMSG-RESULT` に正本 2 点(`specification_content_audit.md`、`spec_reconstruction.md`)のパスが含まれていなかった。RESULT には成果物パスを全て含めること。再送時に修正せよ。

**SHOULD**

- `T32-analyze.mjs` / `T32-validate.mjs` は監査の再現手段そのものである。`validation` 配下に置いたままでよいが、監査文書から「この数値は `node .orchestration/validation/T32-analyze.mjs` で再生成できる」と参照せよ

## 完了条件

- [ ] 作業 1: 5 種の整合性検査すべてに全数リストと件数表
- [ ] REQ-022〜029 欠番の調査結果が明記されている
- [ ] 作業 2: 4 種の欠陥(間違い/矛盾/曖昧/ヌケモレ)それぞれに所見または「精査済み・該当なし(精査方法付き)」
- [ ] T30/T30-V1 の 5 実装所見について「仕様が規定していたか」の遡及判定がある
- [ ] 作業 3: 定義文の無い 264 件全件に復元結果または「復元不能」
- [ ] 孤児定義(DevOps REQ-032)と REQ 欠番 25 件(PrjOps 8 / DevOps 17)の調査結果が SPC 所見として記録されている
- [ ] `.orchestration/plan/remediation_workplan.md` に埋め込まれた旧値 263 の訂正要否を報告に明記(計画側の修正は T32 では行わない。orchestrator が別途処理する)
- [ ] orchestrator 提供の既確定所見(上記 10 項目)すべてに再検証結果(採用 / 反証 + 根拠)
- [ ] AGMSG-RESULT v1 送信(正本パスを含める)
