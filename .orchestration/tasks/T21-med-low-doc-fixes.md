# T21: 否定的レビュー MED/LOW 是正 + ドキュメント陳腐化

## Objective

T19 否定的レビューの残る MED/LOW とドキュメント陳腐化を是正する。詳細は `.orchestration/audit/2026-07-09-adversarial-review-lens1.md`(L1-4〜L1-12、L1b-1/2/5)、`-lens3.md`(L3-B1/B2/C1/D2)。**必読**。

## ブランチ

- `agent/T21` を `agent/T20` から作成、PR base は `agent/T20`。着手前に `/compact`

## 是正項目(各々に回帰テスト。バグは再現テスト先行)

### 正しさ MED/LOW(lens1)

- **L1-4**: 配信でメール成功後にカード送信例外 → カードが永久ロスト+failed 誤計上。カード配信を独立した冪等ステップにする(カード用の配信ログか、カード失敗をメール成功と分離して記録し次回リトライ)
- **L1-5**: `typeof NaN === "number"` を通す検証 → `Number.isFinite` で NaN/Infinity を弾く。calculateReportMetrics も NaN を検出したら明示エラー
- **L1-6**: countChars/truncateText を書記素クラスタ対応にする(`Intl.Segmenter` があれば使用、なければ最低限サロゲートペア+結合文字を割らない)。絵文字/国旗を含むテストを追加
- **L1-7**: parseJstDate("") / 不正日付("2026-13-45")を無音で通さず throw。呼び出し側(resolvePeriodRange/aggregateTimeseries)は不正 baseDate を 400 か明示エラーに
- **L1-8**: xlsxImport の normalizeDate の TZ off-by-one を修正(ローカル TZ 依存の `new Date(text)` をやめ、日付部分を UTC 固定で解釈)。JST 相当のテストを追加
- **L1-9**: waitForRateLimit の境界(remaining===floor で無駄待機、resetAt 過去で無防備続行、待機後の非再取得)を是正
- **L1-10**: reportDeliveryTask の月曜祝日スキップにキャッチアップを追加(listRecent の窓から溢れる前に配信されるよう、未配信検知ベースに)
- **L1-11**: pmSnapshotReconcile の部分保存後 "skipped" 監査に stored 件数を含める + 再入防止(scheduler の running ガードで足りるか確認し、足りなければ追加)
- **L1-12**: dashboardDeepLink の URL 構築失敗が配信サイクル全体を中断しないよう、受信者単位で握って継続(publicBaseUrl 不正時は該当受信者のみ skip+監査)

### 正しさ MED(lens1b)

- **L1b-1**: フェイルセーフ空関数の実効化 — activateFailsafe が実際に自動運用を停止する(少なくとも配信/dispatch タスクが isFailsafeActive を参照して停止する)か、実装しないなら ADR/VERIFICATION に「フェイルセーフは監査記録のみ、停止は未実装」と明記(見せかけを解消)
- **L1b-2**: deployment webhook を pm_events に正規化(normalizePmWebhookEvent に deployment/deployment_status を追加)し、ダッシュボードの Deploy 件数が実データを反映するように。2 層を貫くテスト追加
- **L1b-5**: executiveSevenKeys の `=== undefined` を `== null` 相当に(null 盲目の解消)。null 入力で grey になるテスト追加

### ドキュメント(lens3)

- **L3-B1**: data-model.md に seven_keys_snapshots / standard_reports / report_delivery_log を追記
- **L3-B2**: data-model.md の recipients 行を実 schema に修正(PRF-01..05、persona/teams_team_id/teams_channel_id)
- **L3-C1**: VERIFICATION_REPORT.md に REQ-042/AC-042-1 の T17 配信機能を追記(DI テスト済み・実 Graph 未検証、seven-keys エントリと同水準の正直さで)
- **L3-D2**: 根拠ヘッダ強制を reporting/* だけでなく新規サーバ src にも広げる(verifyTraceability の reportingHeaderFailures を server/src にも適用)。既存は全遵守済みなので追加違反は出ない前提

## 規約 / Forbidden

- DoD: 並列 `mise run ci` green。依存追加なし(Intl.Segmenter は Node 標準)、実 API 呼び出しなし、マージ禁止、`.orchestration/` は commit しない、audit_log への UPDATE/DELETE なし
- 無音スタブ・過大申告禁止

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T21-report.md` — 発見番号ごとの fixed / documented-scope-out
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T21-validation.txt`
- sandbox / learning / autoskill: 同ディレクトリ T21-*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T21 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 70
