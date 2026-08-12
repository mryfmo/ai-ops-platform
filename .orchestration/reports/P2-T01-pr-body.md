# 概要

正本 model-routing contract から、LiteLLM v1.96.2 用の platform-owned logical alias/provider binding manifest を追加します。provider の生 model ID は proxy 環境だけで解決し、fallback は target alias・許可 error・data classification を明示します。v1.96.2 native fallback は error allowlist を表現できないため空で固定し、unguarded enablement を schema で拒否します。

## 根拠となる仕様ID

- FinalArch:LLM-002
- FinalArch:PRD-003
- FinalArch:FR-LLM-001..007
- ADR-0022

## 検証

- `node --test contracts/model-routing/model-aliases.test.mjs`: 6/6 pass
- `pnpm --dir contracts run test`: 16/16 pass（既存10件 + model-routing 6件）
- final fresh-DB `mise run ci`: pass（exit 0）
- positive schema + raw model ID / missing classification / unknown error / native fallback / classification drift negative cases: pass
- canonical contract・root/contracts lockfile: 変更なし
- Crit data revise review: approved、resolved record `r_a235ed`

## Revise 対応

- P2-T01-001: `contracts/package.json` の既存 test script に model-routing test を接続し、`mise run contracts` / GitHub CI から検証が必ず実行されるようにした。
- この companion change は当初の allowed paths 外だが、revise で明示許可された1行変更である。依存・lockfile変更はない。

## チェックリスト

- [x] 新規/変更ファイルの先頭に根拠IDヘッダを記載した
- [x] 根拠IDの要求内容をテストで示した（describe/itタイトルにFinalArch:LLM-002を含む）
- [x] `mise run ci` がfresh DBでローカルgreen（governance / lint / traceability / format / build / typecheck / test:coverage / DB integration）
- [x] 秘密情報（APIキー・トークン・接続文字列）が差分に含まれていない
- [x] 決定的検証ロジックは外部I/Oを持たないcontracts checkerに配置した（agents/HTTP変更なし）
- [x] 外部作用はApp tokenによるbranch push / PR作成のみ（runtime外部作用なし）
- [x] schema.sql変更なし（Repo層/rollback DDL対象外）

## AI生成の明示（ADR-0006）

- [x] このPRはAIコーディングエージェントが生成した（ブランチ `agent/P2-T01-model-alias-manifest`、ラベル `ai-generated`）
- [ ] 人間が作成した

指示元 task_id: `P2-T01`
