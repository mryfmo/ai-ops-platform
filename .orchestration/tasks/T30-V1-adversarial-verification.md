# T30-V1: T30 監査の敵対的検証(read-only、独立再導出)

## 目的

受入済み T30 監査(`.orchestration/audit/production_readiness_gap_audit.md`、40 所見、NO-GO)を**信用せずに**検証する。監査自体が誤っている可能性(偽陽性・重大度誤り・証跡不正確)と、監査が見落としている可能性(偽陰性)の両方を、T30 とは独立の視点で厳密に反証試行する。T30 の結論を守る動機を持たないこと — 反証に成功した所見は遠慮なく REFUTED と判定する。

## 作業 1: 全 40 所見の反証試行(サンプリング禁止)

PRG-001〜PRG-040 の**全件**について:

1. 証跡の file:line を現物と突合(行ズレ・引用の文脈切り取り・誇張がないか)
2. 主張された欠陥を独立に再導出する。可能なものは実行で証明する(例: PRG-001 はローカルに PostgreSQL がなければ、PostgreSQL 公式仕様の該当制約を根拠として明記し「実行未証明」と正直に区分。実行できるもの — 例: PRG-038 の verify:all、PRG-039 の workflow 参照 — は実行/存在確認で証明)
3. 反証の観点: (a) 実は別の場所で対処済みではないか(ミドルウェア・プロキシ前提・別ファイルの実装を見落としていないか)、(b) 重大度が過大/過小でないか(CRITICAL⇄HIGH⇄MED の妥当性を根拠付きで再判定)、(c) 「本番で問題になる」という因果が本当に成立するか
4. 判定: CONFIRMED / CONFIRMED-WITH-CORRECTION(証跡や重大度の修正付き) / REFUTED(反証成功、根拠必須) / UNVERIFIABLE(実環境が必要 — 何があれば証明できるか明記)

## 作業 2: 「問題なし」主張の再検査

監査の「Checked Areas Without Additional Findings」7 項目(webhook HMAC、Graph clientState、fail-closed、SQL パラメータ化、HTML エスケープ、graceful shutdown、依存 advisories)を、それぞれ**破ろうとする**: バイパス経路、エッジケース(空文字シークレット、型混同、encoding、再送/リプレイ)、テスト済みと実装の乖離。破れなければ「再検査済み・破れず(試した攻撃手法列挙)」と記録。

## 作業 3: 偽陰性探索(T30 と異なるレンズ)

T30 の 6 レンズと重複しない観点で新規ギャップを探す:

- **並行性/競合**: キュー二重取得、スケジューラ多重起動、webhook リプレイ/順序逆転、cost guard のロック競合
- **時刻/暦**: タイムゾーン混在(UTC vs Asia/Tokyo)、営業日計算の境界、月次パーティション境界、DST なし前提
- **データ整合性/ライフサイクル**: 削除・訂正の経路(監査ログは追記専用として、誤データの訂正手順は?)、PII/個人情報の保持と削除(関係者マスタ・Teams 会話取込)、GDPR/個人情報保護法観点
- **マルチテナント/権限昇格**: プロジェクト間の情報漏えい経路、recipientsフィルタの結合漏れ、キャッシュによる権限の陳腐化
- **サプライチェーン/ライセンス**: 依存のライセンス互換、lockfile 整合、pinned actions の網羅
- **コスト/容量**: LLM コスト暴走経路、DB 肥大(events/pm_events の無限成長)、ログ肥大

新規所見は PRG-041 から採番し、監査正本に追記(重大度・証跡・推奨対処は T30 と同形式)。

## 成果物

正本: `.orchestration/audit/T30-V1_verification.md`

- 40 所見の判定表(PRG-ID / 判定 / 根拠 1-2 行)+ REFUTED/CORRECTION の詳細節
- 「問題なし」7 項目の再検査結果(試行した破り方を列挙)
- 新規所見(あれば): 監査正本 `production_readiness_gap_audit.md` への追記 + 集計表/マトリクス更新
- 検証で実行したコマンドと出力は expected_validation_file へ

## 制約

- **read-only**(リポジトリ本体変更禁止)。書き込みは .orchestration/ 配下のみ
- forbidden_actions: code-edits、push、merge、dependency-changes、real-llm-calls、git-checkout/reset
- テスト・CI・pnpm audit 等の実行は許可
- 判定の水増し禁止: 全件 CONFIRMED の場合はそれ自体を疑い、最低でも重大度・証跡精度の指摘を探す。逆に REFUTED をノルマ化もしない — 根拠だけで判定する

## revise 第 1 巡(orchestrator 独立 3 レンズとの突合による差し戻し)

T30-V1 の 40/40 判定・7/7 再検査・新規 6 件は良質(PRG-041/042/044 の実行証明は特に強い)。ただし orchestrator 側の独立検証で以下の残存ギャップを確認した(全て orchestrator が file:line を現物確認済み)。監査正本に追記し、集計表・マトリクス・依存順序・T30-V1_verification.md を更新すること。

**MUST(新規所見の追加):**

1. **PRG-047 配信冪等性の TOCTOU**: `packages/prjops/src/lib/idempotentDelivery.ts:52-77` の `decideDelivery` は read(status/exists)のみで claim を取らず、caller(`AGT05_distributor.ts:47-54`)は send 後に record する。重複実行(PRG-041 のレプリカ二重、または同一インスタンスのサイクル重複)で両者が `shouldSend=true` を得て**メール 2 通送信**。`reportDeliveryLogRepo` の ON CONFLICT は送信後のログ行 dedup のみ。SPEC-EXT-023「重複して2通届くことはない」保証の破れ。HIGH。対処: send 前の pending 行 INSERT(claim-before-send)。
2. **PRG-048 監査主体がペルソナ止まりで個人特定不能**: `packages/server/src/agents/teamsConversationAgent.ts:295,429,487` が `actor`/`requestedBy` に `USER:${callerProfile}`(= PRF-01 等のロール enum)のみ記録し、取得済みの `raw.authorAadId`(:219,:235)を破棄。coding_tasks の `requestedBy` が依頼者を保持しない。自律 code_task の監査証跡が「誰か PRF-01 の誰か」までしか遡れない。HIGH(監査ログは本製品の中核保証)。
3. **PRG-049 ランタイムコンテナのハードニング不足**: `packages/server/Dockerfile:25` が `COPY --from=build /repo /app` でソース・dev 依存・テスト込みの全ツリーを同梱、`USER` 指定なし(root 実行)、`pnpm prune --prod` なし。攻撃対象領域とイメージ肥大。MED。
4. **PRG-050 潜在 HTML injection(未結線経路)**: `packages/prjops/src/agents/AGT05_distributor.ts:190` が `previousSummary3Lines`(外部由来の前回報告要約)を未エスケープで `htmlBody` に直挿入。`sendProgressReportRequests` は現在本番未結線のため潜在(latent)だが、結線された瞬間に外部テキストのメール HTML injection になる。LOW-MED(latent 区分を明記)。T30-V1 再検査 #5 は reportDeliveryTask 経路のみ確認しており、この兄弟経路が漏れていた — 再検査記録も訂正すること。

**MUST(既存所見の強化):**

5. **PRG-033**: 「coverage ゲートから漏れている」では過小。`ci.yml` には plain `test` ステップ自体が存在しないため、**web の 152 テストは CI で一切実行されていない**ことを明記。

**SHOULD:**

6. PRG-042 に `isJpHoliday` が `HolidayEntry.verified` フラグを参照しない点(`businessCalendar.ts:76-79`)を追記
7. PRG-008 に「failsafe の遮断自体は `guardFailsafeTask` + 3 ルート(codingTasks/xlsxImport/reports)で機能している(再実装不要)。未ガードのタスク(healthcheck/jitRevocation/subscriptionRenewal/channelPolling)が残る」ことを証跡として追記 — 修正タスクの過剰工事を防ぐため
8. PRG-010 の重大度を再考(署名検証済みソース・LLM 非投入だが、兄弟リポジトリ(pgAuditLog/pmTimeseriesRepo)は sanitize しており一貫性欠如。HIGH 維持なら根拠を、MED 降格ならその根拠を明記)

## 完了条件

- 40/40 所見に判定が付いている(サンプリング不可)
- 7 項目すべてに再検査記録がある
- 偽陰性探索 6 レンズすべてに「新規所見」または「探索済み・発見なし(探索方法付き)」が明記されている
- AGMSG-RESULT v1 送信(verification=正本パスを含める)
