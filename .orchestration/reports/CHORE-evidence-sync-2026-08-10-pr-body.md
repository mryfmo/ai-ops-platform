<!-- 根拠: ADR-0006 -->

# 概要

セッション境界で蓄積した `.orchestration` 証跡を 1 commit で同期します。
実装・依存・正本文書は変更せず、既存証跡本文も遡及編集していません。

## 根拠となる仕様ID

- ADR-0006

## 検証

- gitleaks v8.30.1: pass（偽 PAT fixture 2 件は placeholder へ置換。実 secret / tenant ID / key material なし）
- `pnpm run format`（mise Node 22を明示）: pass
- traceability verifier（Node 22 + `--import tsx`）: pass
- GitHub Actions の `build-test` / `gitleaks` を merge 前必須とする

## チェックリスト

- [x] 新規ファイルの先頭に根拠IDヘッダを記載した
- [x] 実装ロジック変更なし（テスト追加対象外）
- [ ] `mise run ci` がローカルでgreen（証跡のみの変更。GitHub Actions で完全検証）
- [x] 秘密情報（APIキー・トークン・接続文字列）が差分に含まれていない
- [x] 決定的ロジック変更なし（`src/lib/` 対象外）
- [x] 外部作用はローカル workspace cleanup のみで report に記録した
- [x] schema.sql変更なし

## AI生成の明示（ADR-0006）

- [x] このPRはAIコーディングエージェントが生成した（`agent/CHORE-evidence-sync-2026-08-10`、`ai-generated`）
- [ ] 人間が作成した

指示元 task_id: `CHORE-evidence-sync-2026-08-10`
