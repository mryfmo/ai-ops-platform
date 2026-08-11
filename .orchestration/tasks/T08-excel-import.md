# T08: Phase I3 — Excel インポート(ADR-0008 実装)

## Objective

ADR-0008(agent/T06 の `docs/adr/0008-excel-import.md`、設計確定済み。根拠調査は `.orchestration/research/2026-07-09-deep-research.md` の論点 2)に基づき、フォーマット指定の .xlsx テンプレートから GitHub へ Issue / Project v2 アイテム / Milestone を一括インポートする機能を実装する。**PR はインポート対象外**(ADR-0008 の整理どおり)。

## スコープ

1. **依存追加(このタスクに限り許可)**: `exceljs` を該当パッケージに追加(npm の `xlsx` は CVE-2024-22363 未修正のため禁止)。追加は exceljs 1 つのみ
2. **テンプレート定義** — `packages/shared/src/xlsxImport/`(または prjops 配下、既存構成に最適な場所を選択して report で理由を述べる):
   - シート構成: `issues` / `project_items` / `milestones`。各列定義(必須/任意、型、例)をコードで一元定義し、**テンプレート .xlsx を生成する CLI**(空テンプレート+ヘッダ+入力規則コメント)を提供
   - 各行に安定キー列 `source_key`(必須、ユニーク)。冪等性の要
3. **バリデーション** — パース時に行番号付きエラーレポート(必須欠落、型不一致、source_key 重複、未知の列)。**エラーがあれば 1 件もインポートせず全件レポート**(fail-fast ではなく全行検査)。入力テキストは保存前/LLM 入力前/出力前の 3 箇所サニタイズ規約に従い `sanitizeSecrets` を通す
4. **冪等インポートエンジン**:
   - インポート台帳: `packages/devops/src/db/schema.sql` に `import_ledger` テーブルを CREATE TABLE IF NOT EXISTS で追加(source_key、対象種別、GitHub ID、インポート実行 ID、状態)。対応リポジトリ層 `packages/server/src/db/importLedgerRepo.ts` + テストを同一 PR で(schema 変更規約・db-migration スキルの流儀に従う)
   - 既 import 行はスキップ(台帳照合)+ issue body 末尾に `<!-- import:source_key -->` マーカーの二重防御
   - GitHub 書込は既存 `githubClient` を拡張(Octokit 追加はしない): Issue 作成 / Milestone 作成 / Projects v2 は addProjectV2ItemById → updateProjectV2ItemFieldValue の 2 段(GraphQL)。**スロットリング: コンテンツ生成 80/分・500/時を超えない直列実行+ジョブ進捗**(1 write/秒程度)
   - rate limit 値はハードコードせず rateLimit オブジェクトを実行時参照
5. **server 経路** — アップロード受付ルート(`packages/server/src/http/routes/xlsxImport.ts`): .xlsx 受領 → 検証レポート返却(dry-run)→ 確認付き実行(ジョブ化、events/scheduler の既存パターンに従う)。認可は既存 authGuard/権限フィルタの流儀
6. **テスト** — exceljs でのパース、バリデーション網羅(境界値・重複・未知列)、冪等性(再実行スキップ)、スロットリング(fake timer)、ルート(app.request)。GitHub API はモック。describe/it に仕様 ID
7. **仕様 ID** — ADR-0008 の予定 ID(REQ-037/SPEC-INT-064? — ADR 記載の予定 ID を確認して登録、AC-037-1 は登録済みプレースホルダ)を spec-ids に登録し traceability を通す

## Repo / 規約

- ブランチ `agent/T08` を main から作成。Conventional Commits、PR 作成(`ai-generated`)、マージ禁止、`.orchestration/` は commit しない
- DoD: `mise run ci` green(レース時は `mise run -j 1 ci` で確認し記録)
- pnpm はタイムアウト対策フラグ(--network-concurrency 1 --fetch-retries 5 --fetch-retry-mintimeout 20000 --fetch-timeout 120000)

## Forbidden actions

- exceljs 以外の依存追加(Octokit 禁止 — 既存 githubClient を拡張)
- main への push、PR マージ、force push
- 実 GitHub API 呼び出し(テストは全てモック)
- audit_log への UPDATE/DELETE、権限フィルタの表示層後付け

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T08-report.md`
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T08-validation.txt` — CI 末尾、`git show --stat HEAD`、`gh pr view --json url,labels`、テンプレート生成 CLI の実行例
- sandbox / learning / autoskill: 同ディレクトリ T08-\*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T08 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 50
