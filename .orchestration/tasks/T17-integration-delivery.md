# T17: 統合連携の完成 — アウトバウンド配信の結線(ADR-0014)

## Objective

`.orchestration/research/2026-07-09-integration-gaps.md`(**必読** — ギャップ 10 項、位置つき)を解消し、Outlook・Teams・Claude Code・Droid・GitHub・Web の 6 者連携を完成させる。設計判断はオーケストレーターが下記のとおり確定済み。まず ADR-0014 を起案してから実装する。

## ADR-0014(起案内容、確定済み)

- **アウトバウンド配信は常駐サーバの scheduler で実行する**。ADR-0003 の「PrjOps は GitHub Actions cron のみ」を配信用途について明示的に更新(supersede)する。根拠: 実トークンプロバイダ・DB(冪等配信ログ/recipients)・監査ログ・単一ランタイムが常駐サーバに揃っており、Actions 側スクリプトの MSAL 二重実装は本質的でない
- 未設定環境では各配信タスクを **disabled + 監査ログ記録**(reconcile タスクと同じパターン)。設定キーで有効化

## 実装スコープ(ギャップ番号対応)

1. **recipients 結線**(gap 7): schema.sql に `recipients` テーブル(profile/persona、宛先メール、teams 参照、active)+ `recipientsRepo` + テスト。配信時に `isActiveRecipient` をリクエスト毎に評価(キャッシュ禁止)、`reportPermissionFilter`(investor マスキング含む)を実配信経路で通す
2. **配信 scheduler タスク**(gap 2/3/4): `reportDeliveryTask` — 週次(営業日カレンダー)で prjops ペルソナ別報告(executive/manager/investor、既存 profileReports/reportShell)と devops AGT_RPT 報告を、既存 `idempotentDelivery` で冪等に `sendMail`(gap 8: `FROM_MAILBOX` を server config に追加)+ `sendAdaptiveCard` 配信。**存在しない .mjs を参照する死んだ workflows(packages/_/src/workflows/_.yml)と疑似コード MSAL(request-weekly.mjs 系)は削除し、ADR-0014 に置換経緯を記録**(黙って残さない)
3. **アダプティブカード + ディープリンク**(gap 6/9): カードに `Action.OpenUrl` で Web ダッシュボードへのディープリンク(`PUBLIC_BASE_URL` + `/app/dashboard` + ペルソナ/期間クエリ)。teamsConversationAgent のローカル interface に `card?` を通し(teamsConversationAgent.ts:52-56)、`/dashboard` コマンド(ペルソナに応じたリンクカード返信)を追加
4. **標準化 report.json の配信**(gap 1): report-generation.yml に (a) `actions/upload-artifact` で report.json を保存、(b) server の新規 HMAC 認証ルート `POST /reports/ingest`(既存 webhook 署名検証の流儀)へ送信するステップを追加。server 側は受領した report.json を検証(既存 validateReportJson ロジック再利用)→ 永続化(`standard_reports` テーブル + repo)→ 配信パイプラインへ(recipients 該当者にメール/カード)。**サーバ URL 未設定の場合は artifact 保存のみで正常終了**(偽装せずスキップを明示)
5. **createSubscription 結線**(gap 10): 管理 CLI `packages/server/src/tools/createGraphSubscription.ts`(引数: resource/notificationUrl/expiry。既存 graphTokenProvider 利用)+ runbook 追記(セットアップ手順)
6. **config 追加**(gap 8): `FROM_MAILBOX`、`REPORT_DELIVERY_ENABLED`、既定 Teams team/channel。未設定時挙動を configuration.md(T16)に追記
7. **ドキュメント追随**: docs/reference/http-api.md(ingest ルート)、configuration.md、docs/spec/overview.md の連携図、runbooks(購読作成・配信有効化手順)
8. **仕様 ID**: 新規 REQ/SPEC-INT/AC を末尾採番で登録(ADR-0014 に記載)し、実装・テスト参照で traceability green。spec-id-catalog.md にも prose 追加

## テスト(全てモック、否定的観点を含めること)

- 配信タスク: 冪等(同一報告の再配信スキップ)、recipients inactive 除外、investor マスキングが実際に効くこと(マスク前データが本文に漏れない負テスト)、FROM_MAILBOX 未設定時 disabled+監査
- ingest ルート: HMAC 不正 401、スキーマ不適合 422、正常系、再送冪等
- カード: ディープリンク URL の生成、card interface 経由の送信
- describe/it に仕様 ID

## ブランチ

- `agent/T17` を **agent/T18 から**作成(T18 が直前にスタックを進めているため。T18 未完なら agent/T16 から作成し report に明記)。PR base はその親ブランチ

## 規約 / Forbidden

- DoD: 並列 `mise run ci` green。依存追加なし、実 Graph/GitHub/LLM 呼び出しなし、マージ禁止、`.orchestration/` は commit しない、audit_log/配信ログへの UPDATE/DELETE なし

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T17-report.md` — ギャップ番号ごとの対応表
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T17-validation.txt`
- sandbox / learning / autoskill: 同ディレクトリ T17-\*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T17 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 80
