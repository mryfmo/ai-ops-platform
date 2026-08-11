# T19 全量否定的レビュー — レンズ3: 仕様適合・報告の不作為(2026-07-09)

対象: `git diff main...origin/agent/T17` + docs/ADR/reports。過大申告を疑って実施。

## HIGH

**L3-A1: ADR-0003 本文が削除済みファイルを「実装」と指す + SPEC-INT-040 の後継消失**
- T17 が `packages/prjops/src/workflows/*.yml` を全削除。ADR-0003:22-24 は「PrjOps は Actions のみで構築、`packages/prjops/src/workflows/*.yml` がその実装」と本文で明記したまま(冒頭注記は「配信用途に限り」と狭すぎ)
- `weekly-cycle.yml` は SPEC-INT-040 の analyze/report/deliver オーケストレーション、track-daily/remind-weekly は AGT-06。**deliver だけ server に移り、analyze/track/remind の後継が scheduler に存在しない**。AGT01/AGT06 は SPEC-INT-040 ヘッダを持つが何もスケジュールしない
- T17 報告はこれらを「dead」と誤記(SPEC-INT-040 の正典実装だった)
- 是正: ADR-0003 の決定本文を書き換え(src/workflows を出荷しない旨)、SPEC-INT-040 の analyze/track/remind を未実装として記録(または新居を示す)、T17 報告の「dead」表現を訂正

**L3-D1: verifyTraceability の corpus が packages/server/src を全除外 → REQ-042 の green が空約束**
- verifyTraceability.ts:169-170 は corpus に sharedDir/prjopsDir/webDir のみ。**serverDir 不在**
- 結果、REQ-042/SPEC-INT-069/083 は AGT05_distributor.ts:4 等のコメント 1 行だけで src チェックを通過。実装(reportIngest/reportDeliveryTask/recipientsRepo/createGraphSubscription/dashboardDeepLink)とテスト(server/tests/*)は検査対象外。**CI の traceability green はサーバ配信コードについて何も保証していない**
- 是正: buildCorpus に serverDir(src+tests)を両インデックスに追加

## MEDIUM

- **L3-B1**: docs/spec/data-model.md のテーブル一覧が import_ledger で止まり、seven_keys_snapshots / standard_reports / report_delivery_log の 3 つが未記載
- **L3-B2**: data-model.md の recipients 行が T17 後に事実誤り(CHECK が PRF-01..05 も許可、新列 persona/teams_team_id/teams_channel_id が未記載で reportDeliveryTask で load-bearing)
- **L3-C1**: verification/VERIFICATION_REPORT.md に T17 配信機能(REQ-042/ingest/reportDeliveryTask/createGraphSubscription)の記録が皆無。T18 は正直に追記したが T17 は最大機能を検証台帳から漏らした
- **L3-D2(LOW)**: 根拠ヘッダ強制が reporting/* のみ。新規 37 ファイルは全て遵守しているが、将来のヘッダ無しサーバファイルを検出できない潜在ギャップ

## 反証したが破れなかった点(健全)

- ADR-0009 vs REQ-010 は矛盾でない(サーバ SVG=ゼロ JS のメール用、recharts=Web クライアント、issue #2 で scope 明示)
- ADR-0008 のマーカー記述は T15 訂正と一致(第二防御でなく人間用トレース)
- configuration.md は全 17 env var 記載で完全、http-api.md は ingest/xlsx-import 記載で完全、cli.md に createGraphSubscription あり、spec-id-catalog に REQ-042 等あり
- ADR-0014 のワークフロー主張(ingest POST/skip、HMAC、503/401/422、created 時のみ配信)はコードと一致
- 「依存追加なし」は T16/T17/T18 について真(recharts/exceljs は T08/T09 由来で ADR 開示済み)
- 削除された 25 テストは 02211d4(T15 前)由来で書き換え、T15-T18 はテスト削除なし、skip/only/todo なし

## C4(情報): テスト数 750 は grep で厳密再現できず(ノイズ混入)だが skip ゼロで反証もできず。独立確認できなかった点のみ記録
