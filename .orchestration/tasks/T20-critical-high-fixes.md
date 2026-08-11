# T20: 否定的レビュー CRITICAL/HIGH 是正(T19 レンズ1・2・3)

## Objective

T19 全量否定的レビューで確定した最優先の欠陥を是正する。詳細は `.orchestration/audit/2026-07-09-adversarial-review-lens1.md`・`-lens2.md`・`-lens3.md`(**3 つとも必読**)。MED/LOW とドキュメント陳腐化(L3-B1/B2/C1、L1 の MED/LOW 群)は後続 T21 で扱う(このタスクでは触れなくてよいが、着手して壊さないこと)。

## ブランチ

- `agent/T20` を `agent/T17` から作成、PR base は `agent/T17`(スタック継続)。着手前に `/compact`

## 是正項目(全て回帰テスト必須。テストは是正前に「失敗する」ことを確認してから直す=バグを再現するテストを先に書く)

### CRITICAL

**L2-1: /xlsx-import ルートの認証欠如**
- `dry-run` と `execute` に、兄弟ルート(reports/ingest / webhooks/github)と同じ **HMAC-SHA256 署名検証**を必須化(raw body ベース、timingSafeEqual、secret 未設定は fail-closed で 503+監査 — reports/ingest の実装を踏襲)。新 config `XLSX_IMPORT_SECRET`
- さらに **owner/repo をクエリ信用にせず allowlist に制約**(config `XLSX_IMPORT_ALLOWED_REPOS`= "owner/repo" のカンマ区切り。該当外は 403+監査)
- 負テスト: 署名なし→401/署名不正→401、allowlist 外 owner/repo→403、secret 未設定→503。既存 xlsxImportRoutes.test.ts の無認証正常系を、署名付き正常系に是正

### HIGH

**L1-1 / L1b-4: Excel インポートの非アトミック性 → 重複作成**
- GitHub 書込と台帳記録の境界で、**先に台帳へ "pending" を記録 → GitHub 書込 → "imported" へ更新**、あるいは issue body の IMPORT_MARKER を GitHub 側で照合して二重防御を実際に機能させる(ADR-0008 は T15 で「防御は台帳」に訂正済みのため、台帳を create の前後で 2 段にするのが最小・確実)。**createIssue 成功後・ledger 記録前のクラッシュを模したテスト**(insert が最初の呼びで throw)で重複が起きないことを保証
- blanket `catch {}` が失敗を握り潰す点も、失敗種別を記録するよう是正

**L1-2: report ID にタイムスタンプ混入 → CI 再実行で全員二重配信**
- `standardReportId` の content key から `period.generatedAt` を除外し、**安定キー(reportType + period.label + slots/metrics の内容ハッシュ)**にする。同一内容の再生成が同一 ID になること、配信 dedup が効くことをテスト

**L1-3: メール送信→ログ記録順のクラッシュで無印重複メール + (再送)機構が死んでいる**
- 配信の冪等性を「送信前に配信ログへ pending 記録 → 送信 → sent 更新」に是正するか、送信と記録の間の失敗で次回に (再送) マークが必ず付く経路を通す(`isRetryAttempt=true` を本番経路で渡す)。**送信済み・ログ未記録状態からの再実行**テストで、重複が出ないか、出るなら (再送) マーク必須を保証

**L3-A1: ADR-0003 本文が削除済みファイルを「実装」と指す + SPEC-INT-040 後継消失**(詳細 lens3.md)
- ADR-0003 の決定本文を書き換え: PrjOps は `src/workflows/*.yml` を出荷しない旨、配信は server scheduler、SPEC-INT-040 の analyze/track/remind は**未実装として明記**(または新居を示す)。冒頭注記だけでなく本文を修正
- T17 報告(.orchestration/reports/T17-report.md)の「dead」表現を「SPEC-INT-040 の Actions 実装(deliver は server へ移設、analyze/track/remind は未実装として記録)」に訂正
- AGT01/AGT06 に残る SPEC-INT-040 ヘッダの扱いを整理(未スケジュールである旨をコード近傍か VERIFICATION に記録)

**L3-D1: verifyTraceability corpus が packages/server/src を全除外 → REQ-042 green が空約束**(詳細 lens3.md)
- verifyTraceability.ts の buildCorpus に **serverDir(src + tests)を両インデックス(prjops/devops)に追加**
- 追加後、REQ-042/SPEC-INT-069/083 が**サーバ実装とサーバテストから参照される**ことで green になることを確認(コメント 1 行依存を解消)。これにより本 T20 で追加する新テストも traceability の可視下に入る

## 規約 / Forbidden

- DoD: 並列 `mise run ci` green。依存追加なし、実 API 呼び出しなし、マージ禁止、`.orchestration/` は commit しない、audit_log への UPDATE/DELETE なし(配信/インポート台帳の状態遷移は「追記+最新参照」か、明示的に許容される専用テーブルの UPDATE かを設計判断し report に記載)
- **無音スタブ・過大申告禁止**(T18 で revise した点)。未設定時は disabled+監査

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T20-report.md` — 発見番号ごとの対応 + 再現テストの内容
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T20-validation.txt`
- sandbox / learning / autoskill: 同ディレクトリ T20-*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T20 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 60
