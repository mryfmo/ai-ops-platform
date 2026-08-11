# T19 全量否定的レビュー — レンズ2: セキュリティ(2026-07-09)

対象: `git diff main...origin/agent/T17`。攻撃者視点で実施。

## CRITICAL

**L2-1: /xlsx-import/{dry-run,execute} が完全無認証 — プラットフォーム token による任意リポジトリへの confused-deputy 書込**

- 位置: server/src/http/routes/xlsxImport.ts、app.ts:42、index.ts:359-364
- 他の全状態変更ルートは暗号検証あり(reports/ingest=HMAC、webhooks/github=署名、webhooks/graph=clientState、coding-tasks callback=Bearer)。**xlsx-import だけ何もない**。execute のゲートは攻撃者が送れる静的ヘッダ `x-confirm-import: yes` とクエリ `owner`/`repo` のみ。buildApp にグローバル認証ミドルウェアなし。PORT(既定 8080)は公開エンドポイント
- 攻撃: `POST /xlsx-import/execute?owner=<任意org>&repo=<任意repo>` + `x-confirm-import: yes` + 細工した .xlsx → executeXlsxImport が server の GITHUB_TOKEN で `POST /repos/{owner}/{repo}/issues`。**匿名攻撃者がプラットフォーム ID で任意 issue/milestone/Projects アイテムを作成・改竄**。project_items 経路は projectNodeId/fieldNodeId/value をセル由来で受け、任意ボードフィールド改竄も可
- テスト xlsxImportRoutes.test.ts:83-96 がこの無認証設計を正常系として固定(=T08 受入時の見落とし)
- 影響: 無認証 GitHub 書込・スパム・改竄・API クォータ枯渇・監査ログ汚染
- 是正: 兄弟ルートと同じ HMAC(または認証セッション/Bearer)を要求し、owner/repo をクエリ信用でなく allowlist に制約

## LOW

**L2-2: 認証前の無制限ボディ読込(DoS)**
- reportIngest.ts:39(c.req.text())、xlsxImport.ts:43,59(arrayBuffer())、githubWebhook が署名検証前に全ボディをメモリ展開。サイズ上限なし、xlsx は行数上限前に ExcelJS.load。**無認証で数 GB ボディや解凍爆弾 .xlsx でメモリ枯渇可能**

## 反証を試みたが破れなかった点(健全 — 監査可能性のため記録)

- persona クエリは authz バイパスにならない(choosePersona はセッション解決済み persona からの選択のみ、project scoping は canSeeProject で両経路強制、investor-summary は実 investor persona 必須)
- ページエージェントのツールゲート/プロンプトインジェクション(ViewSpec のみ出力、実データ取得はサーバ側再認可、入力は sanitizeForLlmInput)
- 配信マスキングは investor に漏れない(StandardReportPayload に project 次元なし、canShowIssueDetail=false で [masked] に collapse、過剰マスク側)
- Teams カードはそもそも報告内容を載せない(固定文言+ディープリンクのみ)
- ディープリンクはセッションより優先されない(dashboard/page.tsx はクエリ persona/period を無視しセッションから導出)
- reports/ingest の HMAC は正しい(sha256 プレフィクス必須、hex try/catch、長さ検査、timingSafeEqual、secret 未設定は fail-closed 503、raw body で検証)、エラー応答は固定文言で pg/host 漏れなし
