# ベストプラクティス調査メモ（出典付き）

作成日: 2026-07-06。本実装の設計判断の根拠として、Web検索で確認した2026年7月時点の公式情報・
業界標準を以下にまとめる。価格情報は元資料の環境表（DOC-06/07, DEV-05/OPS-06）にすでに
2026-07-03時点の調査結果が反映されているため、本メモでは技術仕様・実装パターンに絞る。

## 1. Claude Agent SDK（旧 Claude Code SDK）

- **出典**: `docs.claude.com/en/docs/agent-sdk/typescript`、`github.com/anthropics/claude-agent-sdk-typescript`
- 2025年後半に「Claude Code SDK」から「Claude Agent SDK」へ改称。パッケージ名は
  `@anthropic-ai/claude-agent-sdk`（TypeScript）。Claude Codeバイナリをオプション依存として
  同梱するため、別途Claude Codeのインストールは不要。
- 素のMessages API呼び出し用パッケージ`@anthropic-ai/sdk`とは別物であり、用途が異なる
  （Agent SDKはツール実行ループ・ファイル操作を伴う自律エージェント向け、
  Messages APIは単発の構造化出力・分類等に向く）。
- 本実装では、この2パッケージの使い分けをADR-0002として明文化した。

## 2. Anthropic Messages APIの構造化出力パターン

- **出典**: `platform.claude.com/docs/en/api/sdks/typescript`
- ツール強制（`tools`パラメータで単一のツールを定義し`tool_choice: {type:"tool", name:...}`で
  強制呼び出しさせる）は、自由文からのJSON抽出よりも出力形式の逸脱が少ない、確立されたパターン。
- 本実装の`AnthropicStructuredClient`（`packages/shared/src/clients/anthropicClient.ts`）は
  このパターンを採用し、`温度0`・`最大リトライ2回`・`日次コスト上限`と組み合わせている
  （いずれもPrjOps SPEC-INT-001/030、DevOps SPEC-INT-063の明示的要求）。

## 3. Microsoft Graph APIによるTeams/Outlook連携

- **出典**: `learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/`、
  `learn.microsoft.com/en-us/graph/teams-messaging-overview`、
  SyncRivo Blog "Microsoft Teams & the Graph API: A Technical Deep Dive"（2026-04-06）
- **change notificationサブスクリプションの有効期限は短い**（チャネルメッセージ等のリソースは
  最大60分程度）。継続受信には定期的な`PATCH /subscriptions/{id}`によるリニューアルが必須であり、
  リニューアル失敗は「サイレントなデータ損失」になり得る。この事実に基づき、本実装
  （`GraphClient.createSubscription`/`renewSubscription`）は、リニューアル失敗を例外として
  明示的に投げ、呼び出し側がポーリングへフォールバックできる設計にした
  （PrjOps SPEC-INT-001「5分間隔のポーリングをフォールバックとする」と整合）。
- **レート制限（429）への対応**: Teamsの受信Webhookは1秒あたり4リクエストを超えると
  スロットリングされ、指数バックオフでの再試行が推奨されている。本実装の
  `fetchWithBackoff`はこのガイダンスに沿い、`Retry-After`ヘッダを尊重しつつ指数バックオフ+
  ジッタで再試行する（DevOps SPEC-INT-080「初期30秒、最大15分」の値をデフォルトとして実装）。
- **Adaptive Card**: Teamsの承認カード（本番デプロイ承認・権限承認・Sev1宣言）は
  Adaptive Card形式（`application/vnd.microsoft.card.adaptive`）で実装した
  （SPEC-EXT-010/011/012が要求するボタン構成に対応）。

## 4. DORA（DevOps Research and Assessment）4指標

- **出典**: `dora.dev/guides/dora-metrics/`、Google Cloud Blog "Use Four Keys metrics..."、
  LaunchDarkly "DORA Metrics" (2025-04-18)
- 4指標: デプロイ頻度（Deployment Frequency）、変更リードタイム（Lead Time for Changes）、
  変更失敗率（Change Failure Rate）、平均復旧時間（MTTR / Time to Restore Service）。
- 実務上、デプロイ頻度は平均（件数/期間）で、リードタイムは中央値（外れ値に強いため）で
  算出することが一般的（Google Cloud Four Keysダッシュボードの実装に準拠）。
  本実装の`calcMedianLeadTimeHours`はこの慣行に従い中央値を採用し、
  `calcDeploymentFrequencyPerWeek`は単純平均（件数を週換算）とした。
- DORAは2021年以降「信頼性(Reliability)」を加えた5指標モデルへ移行しているが、
  DevOps REQ-023 AC-023bが要求するのは明示的に「DORA4指標」であるため、本実装は
  元資料の要求どおり4指標に限定した（5指標目の追加は将来拡張として`docs/adr`に切り出し可能）。

## 5. GitHub Webhook署名検証

- **出典**: GitHub公式ドキュメント（Webhookセキュリティのベストプラクティス。HMAC-SHA256署名を
  `X-Hub-Signature-256`ヘッダで検証することを必須のセキュリティ対策として明記）。
- 本実装の`verifyGithubWebhookSignature`は、タイミング攻撃対策済みの定数時間比較
  （`crypto.timingSafeEqual`）で検証する。DevOps SPEC-INT-010（イベントバスの受信エンドポイント）
  の実装における必須の前提条件として組み込んだ。

## 6. GitHub Actionsのスケジュール実行の限界

- GitHub Actionsの`schedule`トリガーは、cron式で指定した時刻ちょうどに実行される保証はなく、
  高負荷時には遅延することがGitHub公式ドキュメントで案内されている。また実用上の最短間隔は
  5分程度である。この制約が、DevOpsのSPEC-INT-040（30秒間隔のヘルスチェック）・SPEC-INT-032
  （毎分のJIT失効）を満たせない根拠となり、ADR-0003（常駐コンテナが必要）につながっている。

## 7. Node.js標準機能の活用（外部依存削減）

- `crypto.randomUUID()`（Node.js 14.17+で標準搭載）を利用し、`uuid`パッケージへの依存を避けた
  （`packages/shared/src/ids.ts`）。
- グローバル`fetch`（Node.js 18+で標準搭載、本実装が前提とするNode 20 LTSでも利用可能）を利用し、
  `axios`等のHTTPクライアントライブラリへの依存を避けた（`GraphClient`/`GitHubClient`）。
  これにより両クライアントはテスト時に外部npm依存なしで動作させることができ、
  依頼文書が求める「正確にエラーなく動作するレベル」の検証を、実際にこのサンドボックス内で
  実行して確認することができた（詳細は`verification/VERIFICATION_REPORT.md`）。
