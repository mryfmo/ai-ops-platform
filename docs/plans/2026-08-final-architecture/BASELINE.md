# 基準スナップショット

## リポジトリ

- Repository: `https://github.com/mryfmo/ai-ops-platform`
- Branch: `main`
- Commit: `49e2e3c0a3a9d30be46b2a3ae0727009d9eec324`
- Tree: `b72564bb012729869616cb27615070a71c5e8df2`
- Commit date: 2026-08-09T00:25:33Z
- Commit message: `feat(server): wire build and incident runtime handlers (#145)`

## 静的調査で確認した現状

- TypeScript / pnpm monorepo。
- パッケージ: `shared`, `prjops`, `devops`, `server`, `web`, `traceability`。
- 常駐serverはHono、WebはNext.js、LLMはAnthropic SDK / Claude Agent SDKへの直接接続。
- TeamsはMicrosoft Graph change notification / pollingを中心に実装。
- AI coding taskはGitHub ActionsでClaude Codeを実行し、`agent/{task_id}` branchとPRを作る構成。
- Droid実行経路は明示的に未有効化。
- Temporal、LiteLLM、agentgateway、OPA、Work IQ、OpenTagのコード・設定は基準tree内に存在しない。
- Azure managed platformが承認済みADRであり、Bicep実装は基準treeでは確認できない。
- GitHub `main` branch protectionは基準時点で無効。AI Writer有効化前のSTOP gateとする。
- 既存の決定的ロジック、秘密情報サニタイザ、追記専用監査、仕様IDトレーサビリティ、CODEOWNERS、AI PR規約は維持対象。

## 調査上の制約

本パック作成環境ではリポジトリをcloneしてコマンド実行していない。GitHub APIによるファイル・tree・branch設定の静的確認に基づく。したがって、現行CIの実行結果、実DB、実Microsoft 365、実Bedrock、実Anthropic、実Temporal、実MCPサーバーの動作は未検証である。Phase 0で必ず基準commitをcheckoutし、`mise run ci` と実環境前提チェックを再実行する。

## 基準差分の扱い

実装開始時に`main`が上記commitから進んでいる場合、LLMはこのパックを盲目的に適用してはならない。次を実施する。

1. 新しいHEADを記録する。
2. 基準commit以降の差分を分類する。
3. 本パックの不変条件と衝突する変更を抽出する。
4. `baseline-delta.md`を作成し、人間Owner承認を得る。
5. 承認後にWBSのpathと依存関係を更新する。アーキテクチャ自体は独自変更しない。

## 承認済み baseline delta（2026-08-10）

基準 49e2e3c → main `ff66698`（PR #146〜#151）の差分は分類・審査済みで、Owner が
2026-08-10 に承認した。正本: リポジトリ内
`.orchestration/plan/2026-08-10-pack-adversarial-review/02-baseline-delta.md`。
本取込コピーは同 delta の是正（PACK-01..08 / DELTA-01..07（全項適用。詳細は IMPORT_NOTES.md））を適用済みであり、
原本 zip（references/ 配下、SHA256 記録あり）とは意図的に差分がある。差分一覧は
`IMPORT_NOTES.md` を参照。
