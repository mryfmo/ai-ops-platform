# T28: Bot レビュー(chatgpt-codex-connector)29件の triage + 是正 → マージ前提整備

## Objective

マージ前に、GitHub 上の Codex レビューボット(`chatgpt-codex-connector[bot]`)が PR #5〜#22 に残した**29件のインライン指摘**を現行 `agent/T27` tip(8f5e720)に対して全件 triage し、**まだ有効な問題をすべて是正**する。既に是正済みは修正コミットを引用、既知の follow-up issue(#25-#34)に該当するものは issue 番号を参照してスキップ。CodeRabbit は base が default でないため review skip 済み(考慮不要)。GitHub Actions CI は AI-PR に走らない(GITHUB_TOKEN 起因)ため、CI は `mise run ci`(ローカル)が正。

## ブランチ

- `agent/T27` 上で継続作業(新ブランチ不要)。**着手前に /compact 不要**

## 29件の指摘と暫定 triage(orchestrator 事前判定。各件を現行コードで検証し確定せよ)

### 是正必須の可能性が高い(MUST: 現行コードで検証し、有効なら修正)
- **[P1] migrate.ts:9 `import { Pool } from "pg"`**(PR19): pg は CommonJS。ESM 実行でリポ慣習は `import pg from "pg"; pg.Pool`(route.ts / server/db/pool.ts 参照)。名前付き import が実行時に壊れ得る。慣習に統一
- **[P1] graphNotifications.ts:81 202 応答前に lifecycle handler を await**(PR18): Graph は高速 202 ack を要求。renewal 等の重処理は ack 後に回すか、遅延許容を明示。信頼性(プロセス断で renewal 喪失)とのトレードオフを考慮した設計に
- **[P2] devopsReportData.ts:123 project_id 無しの issue/PR イベントが throughput から脱落**(PR22): `normalizePmWebhook` が通常の GitHub issues/pull_request に project_id を付けない場合、throughput が過少計上。正規化経路を確認し、project スコープ判定と subject 集計が実データ形状で正しく効くか
- **[P2] devopsReportData.ts:132 merged 判定を保存ペイロードから読む**(PR22): `isMergedPullRequest` が `normalized.merged/state` を見るが `normalizePmWebhook` がそれを保存しないと merged PR が常に 0。実データ形状に一致させる
- **[P2] executiveSevenKeys.ts:70 月次 diff で grey を unknown 扱いに**(PR6): grey を yellow と green の間にランクすると欠測が変化として誤検出。grey=unknown として diff から除外
- **[P2] index.ts:146 OTel を instrumented モジュール読込前に bootstrap**(PR20): `main()` 内で SDK 起動だと既に import 済みモジュールが未計装。OTel 初期化を最初期に
- **[P2] eventsRepo.ts:210 失敗更新を active lease でガード**(PR18): stale-lease reclaim 導入後、2 worker が同一 event を処理し得る。lease 一致を条件に UPDATE

### 既に是正済みの可能性が高い(検証して commit を引用、再是正不要なら理由記載)
- devopsReportData:66 DORA を期間内に限定(PR6)→ T27 R-A1(fetchDeployments 窓付け)
- devopsReportData:119 未解決 incident の 0h 復旧(PR6)→ T27 NEW-2
- devopsReportData:157 DORA をプール算出(PR22)→ T27 R-A3
- devopsReportData:193 rework を 0 報告(PR22)→ T27 R-A4(rework 削除)
- reportGenerator:77 truncate 後の再検証(PR6)→ T26 R2(長さと独立に数値検証)
- reportValidation:93 prompt 由来の非メトリクス数値許可(PR21)→ T26 R6(stripLiteralText)
- metrics.ts:81 status 消滅時の gauge reset(PR20)→ T25(EVENT_QUEUE_STATUSES reset)
- migrate.ts:50 migration を単一 pg client に固定(PR19)→ T24(pool.connect + advisory lock)
- xlsxImport:49 import 前の実認可(PR5)→ T20(HMAC 署名 401 + repo allowlist 403)

### 既知 follow-up issue に該当(修正せず issue 参照、report に明記)
- prjopsReportData:191 / milestone delay 実算出(PR6)→ issue #27
- (coverage 実配線 → #28、web 共有プール → #23 等、該当あれば参照)

### その他 P2(検証して有効なら修正、nit なら理由付きで見送り)
- engine.ts:100 issue 作成前に milestone title を解決(PR5)
- githubClient.ts:176 Project v2 値設定で field_type を使う(PR5)
- reportIngest:90 重複 ingest 時の delivery 再試行(PR14)
- reportDeliveryTask:59 PRF-G を global audience として扱う(PR14)
- createGraphSubscription:43 作成した subscription を renewal 用に永続化(PR14)
- engine.ts:151 回復可能 ledger 状態を retryable に(PR15)
- standardReportsRepo:36 hash に evidence フィールドを含める(PR15)
- verifyTraceability:171 traceability ID を namespace 内に保つ(PR15)
- githubEventRouter:134 terminal deployment status のみ計上(PR16)
- parser.ts:75 Excel 日付セルを UTC で解釈(PR16)
- coding-task.yml:22 GitHub App token を runtime 生成(PR17)
- dependabot.yml:1 新規ファイルに基準 ID ヘッダ(PR17)

## 規約 / Forbidden

- DoD: 並列 `mise run ci` green。依存追加なし。マージ禁止(マージは orchestrator が別途実施)。`.orchestration/` は commit しない。audit_log 不変。破壊的マイグレーション禁止。**無音スタブ・過大申告・検証の偽装禁止**。各是正は根拠 ID ヘッダ/traceability 維持
- 各指摘は「fixed(commit) / already-fixed(T## commit) / follow-up(#issue) / nit-wontfix(理由)」のいずれかに分類し report に triage 表を出す。**有効な問題を握り潰さない**

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T28-report.md`(29件の triage 表 + 是正内容)
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T28-validation.txt`(mise run ci exit code)
- sandbox / learning / autoskill: 同ディレクトリ T28-*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T28 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 80

---

## revise(独立敵対反証パスの発見。commit 76e1326。BLOCKING あり)

27/29 は正しく修正済み。ただし bot 修正の過程で**新規回帰**を導入。**継続(context 低ければ /compact 可)**。マージはしない(orchestrator が別途)。

### MUST-FIX(blocking)

- **#1 CRITICAL 新規回帰: xlsx 増分インポートが既存マイルストーンで破綻** `packages/shared/src/xlsxImport/engine.ts:156` が `status==="imported"` の ledger 行を**マイルストーン作成前にスキップ**するため、2 回目以降の実行で `knownMilestones` が空。`milestoneNumber()`(:110-116)は `knownMilestones` からのみ解決するため、既存マイルストーンを title 参照する issue が「milestone title not resolved」で throw → issue が failed。是正: **ledger(マイルストーンの githubId/number を保持)から `knownMilestones` を seed** し、既存マイルストーン title を解決可能に。テスト: run1 でマイルストーン+issue、run2 で同マイルストーン title を参照する新 issue → 成功
- **#2 新規回帰(minor): 数値マイルストーン title の誤解決** `engine.ts:112-113` が `Number.isInteger && >0` でマイルストーン **title**(例 "2026"/"5")をリテラルの GitHub マイルストーン番号として扱う → 作成したマイルストーンの実番号でなく誤番号を付与し `knownMilestones` を参照しない(無音誤帰属)。是正: title は常に `knownMilestones` 経由で解決(数値 title もマップ参照)、リテラル番号扱いを廃止 or マップ優先

### SHOULD-FIX(cheap)

- **#3 移行コスト: report hash 変更で既存 STD- id が全変化 → deploy 後に一度だけ再配信** `standardReportsRepo.ts:31`。実装は正しい(evidence/schema を含め period.generatedAt のみ中和)。ただし既存 DB 行があると新 id で ON CONFLICT を外し created:true → delivery log 未登録 → 1 回再配信 + 重複行。**現状 prod 未デプロイで既存行ゼロのため実害なし**。是正: この一度きり再配信を release note/follow-up として明記(backfill は不要=データ無し)。無音にしない
- **#4 LOW: repo→project マップが同一 repo 重複で last-wins** `devopsReportData.ts:206-210`。2 プロジェクトが同一 github_owner/repo を共有すると `project_id===null` の GitHub イベントが 1 プロジェクトにのみ帰属し throughput 過少。是正: repo → project_id の**複数対応**(list)にするか、重複時の扱いを明示
- **#5 LOW: graph disabled 分岐の catch 自身が reject し得る** `graphNotifications.ts:47-58`。disabled 分岐で `auditLog.append` が reject すると `.catch` 内の再 append に catch が無く unhandled rejection。是正: 最終 catch で握るか no-throw 化

### 追跡のみ(修正不要・follow-up issue 化は orchestrator が実施)

- #25 traceability namespace の false-positive(verifyTraceability.ts:171、serverDir を prjops/devops 両 corpus に追加 → 共有数値 ID で DevOps 実装欠落をマスクし得る)= 実在する潜在ギャップ。専用設計が必要なため T28 では見送り、follow-up issue で追跡

### DoD(revise)

- 並列 `mise run ci` green。依存追加なし。マージ禁止。**無音スタブ・過大申告・検証の偽装禁止**。#1 の増分インポート反証テスト必須。push して PR #22 更新
