<!-- 根拠: ENV-DEC-001 / ADR-0029 / FinalArch:GOV-003 -->

# 概要

ENV-DEC-001 / ADR-0029 の実装帰結を正典へ追補します。P3-T01 を Fargate
セルフホスト構成へ更新し、P0-T09 の Azure 前提を AWS 等価へ改訂、pack 読み替え表と
全行 green の SHA256SUMS を確定しました。

## 根拠となる仕様ID

- ENV-DEC-001
- ADR-0029
- FinalArch:GOV-003

## 検証

- fresh PostgreSQL 16 で `mise run ci`: exit 0（183 files / 2,304 tests）
- pack validator: 113 WBS tasks / 64 gates / 101 files、pass
- `shasum -a 256 -c SHA256SUMS`: 全行 OK（BASELINE.md 含む）
- gitleaks v8.30.1: no leaks

## チェックリスト

- [x] 新規 evidence ファイルの先頭に根拠IDヘッダを記載した
- [x] 文書変更を content assertion と pack validator で検証した
- [x] `mise run ci` が fresh DB で green
- [x] 秘密情報（APIキー・トークン・接続文字列）が差分に含まれていない
- [x] 実装ロジック変更なし（`src/lib/` 対象外）
- [x] 外部作用・production resource 変更なし
- [x] schema.sql変更なし

## AI生成の明示（ADR-0006）

- [x] このPRはAIコーディングエージェントが生成した（`agent/P0-T07a-canonical-amendments`、`ai-generated`）
- [ ] 人間が作成した

指示元 task_id: `P0-T07a`

## BASELINE.md

本文は変更していません。既存の SHA256SUMS 行が現行 BASELINE.md と不一致だったため、
本文ではなく manifest 側の hash を再計算して解消しました。
