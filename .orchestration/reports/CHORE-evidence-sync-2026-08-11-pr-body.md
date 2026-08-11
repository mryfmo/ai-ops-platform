<!-- 根拠: ADR-0006 -->

# 概要

PR #170 の merge までに蓄積した `.orchestration` 証跡を 1 commit で同期します。
実装・依存・正本文書は変更せず、既存証跡本文も遡及編集していません。

## 根拠となる仕様ID

- ADR-0006

## 検証

- fresh DB 3件を再作成後、standalone `mise run ci`: pass（exit 0）
- 対象ファイルの秘密情報スキャン: pass（実 secret / private key / credential なし）
- learning record: 12 lines、SHA-256 `4f849178a2ae7a4abef257e7f74c42f67777fc90d46ef380199a609321bca6da`
- GitHub Actions の build/test と gitleaks を merge 前必須とする

## チェックリスト

- [x] 新規ファイルの先頭に根拠IDヘッダを記載した
- [x] 実装ロジック変更なし（テスト追加対象外）
- [x] `mise run ci` が fresh DB の独立実行で green
- [x] 秘密情報（APIキー・トークン・接続文字列）が差分に含まれていない
- [x] 決定的ロジック変更なし（`src/lib/` 対象外）
- [x] 外部作用は App token による push / PR 作成のみ
- [x] schema.sql変更なし

## AI生成の明示（ADR-0006）

- [x] このPRはAIコーディングエージェントが生成した（`agent/CHORE-evidence-sync-2026-08-11`、`ai-generated`）
- [ ] 人間が作成した

指示元 task_id: `CHORE-evidence-sync-2026-08-11`
