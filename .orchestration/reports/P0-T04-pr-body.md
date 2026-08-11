# 概要

20 architecture invariants を automated check または manual gate に漏れなく対応付け、禁止構成を検出する依存ゼロの fitness scanner を既存 governance gate に追加します。あわせて Vitest 4 で実質全件実行になっていた load-test selector を、対象ファイルを直接指定する形に修正します。

## 根拠となる仕様ID

- FinalArch:INV-001..020
- FinalArch:GOV-004
- FinalArch:GOV-005

## 変更内容

- INV-001..020 の完全な fitness matrix
- direct egress、MCP/A2A gateway bypass、Cloudflare/Notion baseline、dangerous MCP tool、migration flag parity の静的検査
- 各 automated check の negative fixture と Node test
- 既存 `mise run governance` の強化（`mise run ci` への既存接続を維持）
- `verify:load*` の Vitest 4 file selector 修正

`.github/workflows/ci.yml` は変更していないため、DELTA-06 の `.ci/agt-dep-evidence.json` artifact 契約は不変です。依存追加、schema、production config、runtime path の変更はありません。

## 検証

- `mise run governance`: pass（18 Node tests + repository scanner + Plane checks）
- `pnpm run verify:load`: pass（server 1 file / 10 tests、web 1 file / 1 test）
- fresh disposable PostgreSQL 16 で `mise run ci`: pass（183 files / 2,304 tests、PostgreSQL integration pass）
- `git diff --check origin/main...HEAD`: pass
- 未実行の必須検証: なし

## チェックリスト

- [x] 新規/変更ファイルの先頭に根拠IDヘッダを記載した
- [x] 根拠IDの要求内容をテストで示した（describe/itタイトルにsystem名前空間付き仕様IDを含む）
- [x] `mise run ci` がローカルでgreen（governance / lint / traceability / format / build / typecheck / test:coverage）
- [x] 秘密情報（APIキー・トークン・接続文字列）が差分に含まれていない
- [x] 決定的ロジックは build-time governance script に限定し、agents/HTTPハンドラへ埋め込んでいない
- [x] 外部作用を行う runtime コード変更なし（監査ログ対象外）
- [x] schema.sql変更なし（Repo層/ロールバックDDL対象外）

## AI生成の明示（ADR-0006）

- [x] このPRはAIコーディングエージェントが生成した（ブランチ `agent/P0-T04-fitness-checks`、ラベル `ai-generated`）
- [ ] 人間が作成した

Task ID: `P0-T04`（trace ID はタスクに未指定）
