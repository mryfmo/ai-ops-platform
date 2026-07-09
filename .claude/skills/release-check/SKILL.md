---
name: release-check
description: mise run ci（typecheck/build/test/traceability）を一括実行し、結果を整理して報告する。PR作成前・マージ前の最終確認時に使用。
---

# release-check: リリース前一括検証

## 手順

1. `mise run ci` を実行する（内部順序: typecheck → build → test:coverage → traceability）
2. 失敗がある場合、以下の分類で整理して報告する:
   - **型エラー**: ファイル:行と原因。修正が自明なら修正して再実行
   - **テスト失敗**: 失敗したdescribe/itタイトル（仕様IDを含む）と期待値/実際値。
     仕様IDが示すACに照らして「実装のバグ」か「テストの誤り」かを判定してから修正する
   - **traceability失敗**: 参照されていない仕様ID一覧。新規ファイルへの根拠IDヘッダ追加漏れが典型
3. 全green後、追加確認:
   - `git status` で意図しないファイル（dist/, .env*, ログ）が混入していないこと
   - 変更ファイルに秘密情報パターン（APIキー・トークン）が含まれないこと
     （擬陽性に注意: テスト用の `fake-token` 等は許容）
4. 結果を「green / 修正済みgreen / 未解決あり」のいずれかで明確に報告する。
   未解決がある状態で「完了」と報告しない
