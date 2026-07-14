# 概要

<!-- 何をなぜ変更したか（1〜3文） -->

## 根拠となる仕様ID

<!-- 該当するものを system 名前空間付きですべて列挙: PrjOps:REQ-xxx / DevOps:SPEC-INT-xxx / ADR-xxxx -->

-

## チェックリスト

- [ ] 新規/変更ファイルの先頭に根拠IDヘッダを記載した
- [ ] 根拠IDの要求内容を満たすことをテストで示した（describe/itタイトルにsystem名前空間付き仕様IDを含む）
- [ ] `mise run ci` がローカルでgreen（governance / lint / traceability / format / build / typecheck / test:coverage）
- [ ] 秘密情報（APIキー・トークン・接続文字列）が差分に含まれていない
- [ ] 決定的ロジックは `src/lib/`（純粋関数）に配置し、agents/HTTPハンドラに埋め込んでいない
- [ ] 外部作用（GitHub操作・メール送信・権限変更）には監査ログ記録がある
- [ ] schema.sql変更を含む場合: Repo層+テスト+ロールバックDDLコメントを同梱した

## AI生成の明示（ADR-0006）

- [ ] このPRはAIコーディングエージェントが生成した（ブランチ `agent/*`、ラベル `ai-generated` 付与済み）
- [ ] 人間が作成した

<!-- AI生成の場合: 指示元（Teams/WebUI）のtask_idとtrace_idを記載 -->
