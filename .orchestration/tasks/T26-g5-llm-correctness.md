# T26 (G5): LLM 正しさ — パラメータ + eval + モデル + コストガード

## Objective

監査 `.orchestration/audit/2026-07-09-bestpractice-BC.md`(領域C)の HIGH×3 + MED を是正。**必読**。

## 最重要: パラメータ修正は claude-api ドキュメントで実挙動を確認してから

C-model-1/C-4 は「Opus 4.7+ が temperature を拒否」「extended thinking が temperature と非互換」という主張だが、**キャッシュされたスキル由来**。**是正前に必ず claude-api スキル/公式ドキュメントで、使用中のモデル ID(claude-sonnet-4-6 / claude-opus-4-8)の実際のパラメータ受理挙動を確認**し、確認結果を report に記載すること。ドキュメントと食い違えば、監査でなくドキュメントを正とする。

## ブランチ

- `agent/T26` を `agent/T25` から作成、PR base は `agent/T25`。着手前に **必ず /compact**

## 是正項目

### C-model-1 HIGH: エスカレーションの temperature
- anthropicClient.ts:132 が全呼び出しで temperature:0。**claude-api ドキュメントで、エスカレーション先モデル(claude-opus-4-8)が temperature を拒否する/しないを確認**。拒否するなら、該当モデルでは temperature を送らないよう分岐(SPEC-INT-001 のエスカレーションが 400 で死ぬのを解消)。拒否しないなら「ドキュメント上は許容、監査の懸念は該当せず」と report に記録し変更しない
- 回帰テスト: エスカレーション経路がパラメータ 400 で失敗しないこと(モックで、送信パラメータを検証)

### C-4 HIGH: thinking と temperature
- chatHandler.ts:123-130 が temperature:0 かつ thinking 有効。**ドキュメントで extended thinking と temperature の互換を確認**。非互換なら temperature を外し、adaptive thinking + effort への移行を検討(ADR-0013 §4 更新)。ドキュメント準拠で修正

### C-1 HIGH: eval ハーネス
- 報告の**真実性**(メトリクスにない数値を文章スロットが捏造しない)を検証する eval を追加: (a) 決定的チェック — 生成された文章スロットに、metrics に存在しない数字文字列が含まれないことをアサート、(b) 任意で LLM-as-judge の faithfulness(モックで CI、実 LLM 呼び出しなし)。fixture メトリクス→スロット→アサートの形。既存 forced-tool クライアントを再利用

### C-model-2 MED: モデル ID 現行性
- 使用モデル ID を確認し、**据え置くなら ADR-0002 に「claude-sonnet-4-6 を意図的にピン、移行は別途」と明記**。現行化する場合の破壊的変更(budget_tokens/サンプリング除去)を report に。実際の移行はこのタスクでは任意(ドキュメント確認+方針決定を優先)

### C-3b MED: pgCostGuard の TOCTOU + per-request 上限
- assertWithinBudget(検査)と record(書込)の非原子性を解消: **予約→照合(reserve-then-reconcile)** で、呼び出し前に見積コスト行を挿入し呼び出し後に実コストで更新。per-agent の per-request 上限を追加。stream 途中エラーでも記録
- テスト: 同時実行が上限を超えない、per-request 上限、途中エラー時の記録

### C-6 MED: refusal 処理
- anthropicClient / chatHandler が `stop_reason === "refusal"` を分岐して明示的に扱う(E-GEN01/E-ING03 に化かさない)。テスト: refusal 応答が識別される

## 規約 / Forbidden

- DoD: 並列 `mise run ci` green。依存追加なし。**実 LLM 呼び出しなし**(テストは全てモック)。マージ禁止。`.orchestration/` は commit しない。audit_log への UPDATE/DELETE なし
- **無音スタブ・過大申告禁止**。パラメータ修正はドキュメント確認の裏付けを report に明記(推測で変えない/変えないなら理由を書く)

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T26-report.md`(各パラメータ修正の claude-api ドキュメント確認結果を含む)
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T26-validation.txt`
- sandbox / learning / autoskill: 同ディレクトリ T26-*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T26 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 70

---

## 第2巡 revise(独立敵対レビュー 2 名の発見。監査 BC.md「T26 第2巡」参照)

commit 1aa30cf は CI green かつ DB reserve のアトミック性(A〜F)は確認済み。ただし以下を是正。**着手前に /compact 不要(継続)**。各修正の根拠を report に追記。

### MUST-FIX(blocking)

- **T26-R6 HIGH: period-label whitelist が数値 grounding をバイパス**
  - `packages/shared/src/reporting/reportValidation.ts:168-171` が `period.label` を数字トークンに分解し allowed に追加している。これを廃止。**ラベル文字列全体を slot テキストから部分文字列として除去してから数字抽出**する(例: `"2026-Q3"` は丸ごと除外されるが、他所の単独 `"3"` は依然検査される)。桁の断片を allowed に足さないこと。
  - 反証テスト必須(`packages/shared/tests/reporting.test.ts`): metrics に**ラベル桁を含めず** (a) period `"2026-Q3"` + conclusion `"3件のインシデント..."` → **REJECT**、(b) period `"2026-W28"` + `"28件..."`/`"2026件..."` → **REJECT**。既存 `:113` の穴(metrics に 3 を入れて隠している)を上記へ差し替え

### SHOULD-FIX(cheap, 正しさ/正直さ)

- **T26-R7 MED: R3 refusal net の dead code + 捏造テスト**
  - 実 `@ai-sdk/anthropic@2.0.85` は refusal を `finishReason="content-filter"` にマップ(既に chatHandler で処理・機能正常)。`error` にはならず providerMetadata に `stop_reason`/`reason` キーは無い(実キーは `stopDetails.type`)。`chatHandler.ts:176-177` の `containsRefusalMarker(providerMetadata)`/`(response.body)` は本番で発火せず、`chatRoute.test.ts:349` は SDK が出さない形を捏造している。
  - 是正: **dead な containsRefusalMarker 網と捏造テストを削除**し、`content-filter` 実経路 + 正直な doc のみ残す(過大申告排除)。防御網を残す判断なら実形 `stopDetails.type === "refusal"` に合わせ、実 SDK 出力に基づくテストへ。どちらにせよ「SDK が実際に出す形」に一致させ、report に @ai-sdk/anthropic の実マッピングを明記
- **T26-R4 moderate: グローバル advisory lock の ceiling を明記**
  - `pgCostGuard.reserve()` に `ponytail:` 相当の上限コメント: グローバル advisory lock は全 agent 共通(日次総上限の保護に必須で per-agent 分割不可)であり、トランザクション中プール接続を確保したまま保持するため高並行でプール枯渇の恐れ、という設計トレードオフと upgrade path(critical section 短縮/ロックタイムアウト等)を明記。**再設計はしない**(グローバル性は要件)
- **T26-R5 low: reconcile-optional footgun**
  - retry の zero-reconcile と `legacyReserve` が `reconcileReservation` 存在に依存。reserve のみ実装の guard が見積行を積む罠を塞ぐ(interface で reserve↔reconcile 同時必須を不変条件化、または no-reconcile 経路を明示処理)
- **LOW**: `reportValidation.ts:78` の dead な `Intl.NumberFormat` allowed エントリを削除(comma は lookup で除去され never hit)

### 記録のみ(T26 スコープ外・修正しない)

- web ルートの request 毎 `new pg.Pool`(route.ts:33 ほか計 8 箇所)は T26 起因でない web 全体の既存アンチパターン。**T26 では触らず** report の follow-up に「web 側共有プール化(T24 のサーバ側プール設定に相当)を別 infra タスクへ」と記録
- アトミック性の実 PG 並行テストは no-real-env 制約で不可 → fake pool の文順序検証が上限である旨を既知の限界として report に明記

### DoD(第2巡)

- 並列 `mise run ci` green。依存追加なし。マージ禁止。`.orchestration/` は commit しない。**無音スタブ・過大申告・検証の偽装禁止**(特に R6 の反証テストは metrics にラベル桁を含めないこと、R7 は実 SDK 形に一致)。push して PR #21 を revise commit に更新すること(現状 origin は旧 077dabf)
