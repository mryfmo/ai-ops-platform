# 統合連携の現状ギャップ (2026-07-09、agent/T16 精査)

## 結論

Graph クライアントは全機能実装済み・インバウンド Teams(通知 →delta fallback→ 会話エージェント → コマンド → テキスト返信)は本番結線済み。**アウトバウンド配信(Outlook メール・Teams アダプティブカード)は全経路未結線**。

## 結線状況表(要点)

| 能力                                                                                   | 状態                                                                                  |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| sendMail / sendAdaptiveCard                                                            | クライアント実装済み・**本番呼び出し元ゼロ**(AGT05/AGT_RPT/AGT06 等は re-export のみ) |
| renewSubscription / getChannelMessagesDelta / getChannelMessage / replyToMessage(text) | 本番結線済み                                                                          |
| createSubscription                                                                     | **どこからも呼ばれない**(購読行は外部シード前提)                                      |
| replyToMessage の card 引数                                                            | teamsConversationAgent のローカル interface が card を落としており未使用              |

## ギャップ 10 項(位置つき)

1. 標準化 report.json の消費者ゼロ(report-generation.yml は validate で終了、artifact 保存もなし)
2. メール経路の本番結線ゼロ(recipients/isActiveRecipient は server に参照ゼロ、recipients テーブルなし)
3. 配信ジョブスクリプト不存在(deliver-weekly.mjs / report-weekly.mjs / reports.mjs 等 — yml が参照するが存在しない。存在する request-weekly.mjs は MSAL 疑似コードで E-CFG02 throw)
4. 配信ワークフローが packages/\*/src/workflows/ にあり .github/workflows/ 外 → Actions は実行しない
5. スクリプト用 Graph トークン取得が未実装(実物は server の createClientCredentialsTokenProvider のみ)
6. アダプティブカード送信ゼロ+ダッシュボードディープリンク(Action.OpenUrl)ゼロ(AGT05 のカードは actions:[] の 1 行テキスト)
7. 受信者選択未結線(reportPermissionFilter の investor マスキング含め、実配信で一度も呼ばれない)
8. FROM_MAILBOX 等のメール送信設定が server config に不存在(スクリプトはプレースホルダをハードコード)
9. investor ペルソナ/timeseries ビューは Teams/メールから到達不能(Web のみ)
10. createSubscription 未結線(関連ギャップ)

## 決め手となる事実

- GraphClient の本番生成は server/index.ts:118 の 1 箇所のみ
- AGT05 カード: AGT05_distributor.ts:62-68(actions: [])
- teamsConversationAgent.ts:52-56 が card? を interface から落とす
- request-weekly.mjs:39 で E-CFG02 throw
- report-generation.yml は validateReportJson で終了(配信/アーティファクト工程なし)
