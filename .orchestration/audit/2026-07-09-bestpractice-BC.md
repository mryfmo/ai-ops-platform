# ベストプラクティス ギャップ分析 — 領域B(GitHub/供給網/CI-CD)・C(LLM 運用) (2026-07-09)

対象 agent/T21。あるべき姿(出典)→ 現状(file:line)→ 深刻度 → 是正。

## 領域B: GitHub ガバナンス / 供給網 / CI-CD

### CRITICAL
- **B-1.1 CODEOWNERS が `@OWNER` プレースホルダ**(.github/CODEOWNERS:6)→ 「AI PR は人間マージのみ」の中核統制が不在。実アカウント/チームに置換必須(ADR-0006 の残課題)

### HIGH
- **B-1.3 AI PR が GITHUB_TOKEN で作成**(coding-task.yml:133)→ GITHUB_TOKEN 起因イベントは後続ワークフローを起動しない → **ci.yml が AI PR で走らない** → 必須チェックが永久 pending。GitHub App トークン/専用 PAT で PR 作成すべき。**リポジトリ可視の実欠陥**
- **B-4.1 gitleaks-action@v2 は org で有償ライセンス必須**(ci.yml:35、GITLEAKS_LICENSE 未設定)→ org リポでは秘密スキャンが無音で失敗。CLI 直呼び or GHAS へ
- **B-2.1 Actions が全て tag ピン(SHA 未ピン)**: jdx/mise-action@v2、pnpm/action-setup@v4、gitleaks-action@v2 等。可動タグ改竄が contents:write+secrets ジョブで実行され得る。40 桁 SHA ピンへ
- **B-3.1 Dependabot/Renovate なし**(.github/dependabot.yml 不在)。npm+github-actions エコシステムで導入
- **B-1.2 bot が review ルールを bypass しないか**[サーバ側設定・リポからは検証不可]
- **B-4.3 server が長命・広域 GITHUB_TOKEN を install token に流用**(server/index.ts:152、`?? ""` フォールバックで無音劣化)。SPEC-INT-061 の実 GitHub App(短命・スコープ限定)へ、未設定時は明示失敗

### MEDIUM
- B-2.3 run-coding-agent が攻撃者影響下の instruction で `claude -p --permission-mode acceptEdits` を secrets 保持ジョブで実行(シェル注入対策は良好、LLM 指示経由の秘密流出は人間ゲートのみ)
- B-2.5 environment/concurrency 不使用(ingest/callback が環境ゲートなしで prod URL、report スケジュールや同 task_id の coding-task が競合し得る)
- B-2.6 report-generation.yml が ANTHROPIC/FACTORY API キー env を渡していない(実 LLM 実行時に失敗)
- B-3.2 CI に pnpm audit なし
- B-3.3 SBOM/provenance/attestation なし(report.json は無署名 upload)
- B-5 「AI 自動マージ禁止」はドキュメントのみで config 強制なし[サーバ側]

### LOW
- B-3.4 exceljs 休眠(未署名ワークブックをパース、将来 CVE の無修正リスク)
- B-6.1 AI コミットが `[AI] ...` で Conventional Commits 非準拠(changelog/semver 自動化を壊す)
- B-6.2 リリース/タグ/デプロイ戦略なし
- B-2.2 permissions がジョブ単位でなくワークフロー単位

良好: coding-task.yml の注入衛生(env 経由・jq --arg)、report-generation のスキーマ検証済み LLM 出力、全所で frozen-lockfile、決定的 AI-PR 分類。

## 領域C: LLM/AI アプリ運用

### HIGH
- **C-model-1 エスカレーションが常時 400 で死んでいる**: anthropicClient:132 が全呼び出しで temperature:0 送信、うち Opus(4.7/4.8)へのエスカレーション(line 120)は temperature 拒否で 400 → 握り潰され E-ING03 throw。SPEC-INT-001 の救済リトライが機能しない。是正: 4.7+/5/Fable 系では temperature を送らない ※claude-api スキル典拠。実行前に API 仕様で再確認すること
- **C-4 thinking と temperature の競合**: chatHandler:123 が temperature:0 かつ :127-130 で thinking 有効(sonnet-4-6)。extended thinking は temperature≠1 と非互換 → 400 か determinism 無視の無音。Sonnet 5/Opus 移行時に budget_tokens が hard 400。是正: temperature 除去、adaptive thinking + effort へ、ADR-0013 §4 更新
- **C-1 eval ハーネスなし**: 検証は shape と字数のみで**真実性を検証しない**(メトリクスにない数値を slot が捏造しても素通り)。「LLM は文章のみ」規約が構造検証されるが真実性未検証。是正: fixture メトリクス→slot 生成→(a)本文の数字が metrics に存在するか決定的チェック(b)LLM-as-judge の faithfulness 採点を CI に

### MEDIUM
- C-model-2 モデル ID が一世代前(claude-sonnet-4-6 / CHAT_MODEL も。現行は claude-sonnet-5)。移行は破壊的(budget_tokens/非既定サンプリング除去、トークナイザ約30%増でコスト再基準)。据え置くなら ADR-0002 に明記
- C-3 プロンプトキャッシュ皆無(report/構造化の system prompt+tool schema は各呼び出しで byte 同一=教科書的キャッシュ前置)。Batch API 未使用(CI report・非対話構造化は 50% コスト候補)
- C-3b pgCostGuard: assertWithinBudget(検査)と record(書込)が非原子=TOCTOU で同時実行が上限超過。per-request 上限なし。cache トークン未計上。stream 途中エラーは未記録
- C-6 可観測性: プロンプト/応答ログなし、latency/request_id 未捕捉、refusal(stop_reason)分岐なし(refusal を E-GEN01 に化かす)、構造化リトライに backoff なし

### LOW
- C-5 structured outputs は forced tool_choice+zod 再検証で健全だが strict:true 未使用(SDK 0.32.1 が古い)
- C-7 PII: sanitizer は秘密のみ(氏名/メール非除去、REQ-035 が Anthropic を宛先許可のため許容だが ADR 明記推奨)、「本文に数値禁止」が prompt のみで未強制

良好(維持): ViewSpec 限定・persona ゲートのツール(注入封じ込め)、read-only diff エージェントの三重防御、決定的メトリクス+LLM 文章限定境界、pgCostGuard の per-agent 台帳、字数の決定的検証+truncate、HMAC 署名 report ingest。

## 主要出典
docs.github.com actions/reference/security/secure-use、securitylab.github.com pwn-requests/untrusted-input、rulesets available-rules、dependabot-options-reference、gitleaks-action v2 license、GHSA-4r6h-8v6p-xvw6、csrc.nist.gov SP 800-218、actions/attest-build-provenance。platform.claude.com structured-outputs / prompt-caching / batch-processing / adaptive-thinking / extended-thinking / errors、models/migration-guide(claude-api スキル典拠)

## T26 独立敵対レビューの発見(G5 受入前)

- **T26-R1 C-3b reserve() NOT-FIXED(advisory-lock 3 度目の破綻、HIGH)**: pgCostGuard.ts:99-138 が単一文 pool.query で pg_advisory_xact_lock を CTE 内取得。ロックは実行を直列化するが、予算 SUM の READ COMMITTED スナップショットが**文開始時=ロック取得前に確定**するため、Tx B が A のコミット前スナップショットで SUM を数え過小評価→日次上限超過。是正: **T24 migrate.ts / T23 eventsRepo.ts の実証済みパターンを踏襲** — pool.connect() で専用クライアント → BEGIN → pg_advisory_xact_lock(**別文**)→ SUM チェック+INSERT → COMMIT(スナップショットがロック後に取られる)、finally で release。fake DB では検出不能なので、少なくとも「別文でロック→その後 SUM」の文順序をテストで固定
- **T26-R1b C-3b PARTIAL**: 構造化クライアントが retry ループ内で reserve → 再試行で phantom 見積行が積み上がり最後のみ true-up、残りは未 reconcile で予算永久消費(過大計上=安全側だが不正確)。是正: 予約をループ外で 1 回、または失敗行を reconcile/削除
- **T26-R2 C-1 数値 grounding PARTIAL(実穴、MED)**: 偽陽性=年/四半期/日付/序数、桁区切り(1,500→"1"+"500")、日本語数字(100万)、分数vs%; 偽陰性=綴り字(五件/five)、意味的に誤りだが lexically 存在する数字、**長さ超過経路が数値チェックをマスクして捏造数字が truncate 後も出荷**(reportValidation.ts:155 の `if (slotResult.ok)`)。是正(現実的範囲): 桁区切り正規化、期間ラベルの数字除外、**数値チェックを長さチェックと独立に実行**(長さ失敗でマスクしない)、綴り字/意味誤りは lexical で不可能な旨を正直に文書化(任意で LLM-as-judge の意味 backstop 追加、モック)。trivial な "99" fixture でなく年/桁区切り/長さマスク経路のテストを追加
- **T26-R3 C-6 チャット streaming PARTIAL(LOW)**: refusal を onFinish で throw するが HTTP 200 Response 返却後 → distinct status でなくストリーム本体エラーとして届く。実 AI-SDK provider の finishReason("refusal"/"content-filter"/"error")マッピングは未検証(error は line 165 で短絡し refusal 分岐を抑制し得る)。是正: streaming の性質上 post-200 は不可避なので**その旨を正直に文書化**し、finishReason=error が refusal を握り潰さないよう順序を確認、実挙動の不確実性を report に明記
- 確認(CONFIRMED-FIXED): C-model-1(opus は temperature 省略、sonnet は維持、テスト有)、C-4(chat の temperature 除去)、C-3b per-request 上限(DB アクセス前拒否、テスト有)、依存追加なし、audit_log 不変、docs 一致

## T26 第2巡 独立敵対レビュー(commit 1aa30cf, 2 名の独立レビュアー・実装 codex とは別)

CI green(mise run ci exit 0, 855 tests)だが、独立敵対レビューで新規欠陥を検出。

### DB 正しさ(reserve 3 度目の修正)— A〜F すべて CONFIRMED-FIXED
- **A アトミック性 CONFIRMED-FIXED**: 別文 advisory lock → 別文 CTE(fresh READ COMMITTED snapshot がロック後に取得)で日次上限が保持。T24/T23 実証パターンと一致。hashtext は決定的で全接続が同一キーで直列化。two-tx 干渉トレースで cap 保持を確認
- **B 二重計上なし / C reconcile は実コスト(response.usage 由来)/ D R1b phantom 行は retry 前に cost 0 へ / E fallback は本番 Pool で connect 検出健全 / F release リーク・二重解放なし** — すべて確認
- **T26-R4 新規回帰(moderate=可用性、correctness ではない)**: 正しい修正はグローバル advisory lock(全 agent 共通 1 キー、日次総上限の保護に必須=per-agent 分割不可)を BEGIN→lock→INSERT→COMMIT の複数往復にわたり**プール接続を確保したまま**保持。高並行時にプール枯渇の恐れ。**web ルートの request 毎 `new pg.Pool`(route.ts:33 ほか executive-summary/projects/investor-summary/timeseries/manager-summary/agent-activity/dashboard の計 8 箇所)が増幅**。※ 後者は T26 起因でない web 全体の既存アンチパターン → 別 infra タスクへ繰り越し。T26 では reserve() に上限(ceiling)コメントで設計上のトレードオフと upgrade path を明記
- **T26-R5 latent footgun(low)**: retry の zero-reconcile と legacyReserve が `reconcileReservation` 存在に依存。reserve のみ実装の guard は見積行を積む罠(本番は未到達)。interface で reserve/reconcile 同時必須を不変条件化 or no-reconcile を明示処理
- 観測(low): アトミック性テストは fake pool で文順序のみ検証し READ COMMITTED レースを再現できない(実 PG 並行テストは no-real-env 制約で不可 → 既知の限界として文書化)。zero-reconcile が cost 0 行を llm_usage に残す(cap には無害)

### LLM 正しさ(R2 数値 grounding / R3 refusal)
- **T26-R6 R2(3) period-label whitelist が grounding をバイパス(HIGH, 実穴)**: reportValidation.ts:168-171 が `period.label` を**数字トークンに分解**し各々を allowed に追加。→ period `"2026-Q3"`+metrics に 3 なし+conclusion `"3件のインシデント"` が `ok:true`。`"2026-W28"` は `"28"` と `"2026"` を解放。捏造されやすい小整数(四半期 1-4/ISO 週/4 桁年)で grounding が無効化。是正: ラベルを**部分文字列として slot から除去**してから数字抽出(全体 `"2026-Q3"` は除外、他所の単独 `"3"` は検査)。桁を allowed に足さない。**テスト reporting.test.ts:113 はラベル桁を metrics に含めて穴を隠している** → metrics にラベル桁を含めない反証テスト(上記 2 ケースが REJECT されること)へ
- **T26-R7 R3 containsRefusalMarker が実 provider で dead + テスト捏造(MED)**: `@ai-sdk/anthropic@2.0.85` は refusal を finishReason `"content-filter"` にマップ(既に chatHandler:321/108-110 で処理・機能は正常)。`error` にはならず、providerMetadata に `stop_reason`/`reason` キーは無い(実キーは stopDetails.type)。よって containsRefusalMarker(:176-177)は本番で発火せず、chatRoute.test.ts:349 は SDK が出さない形を捏造。是正: **dead net と捏造テストを削除**し content-filter 実経路 + 正直な doc のみ残す(過大申告排除)。防御網を残すなら実形(stopDetails.type==="refusal")に合わせ実 SDK 出力でテスト
- 確認(CONFIRMED-FIXED): R2(1)長さマスク独立化(:167、両エラー出る反証テスト有)、R2(2)桁区切り正規化(false negative なし)、R3(1)分岐順序(error && !isRefusal)、honesty 開示(R2(4)/R3(2)は doc 済み)。LOW: reportValidation.ts:78 の Intl.NumberFormat エントリは dead(comma は lookup で除去)→ 併せて削除
