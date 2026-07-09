# ai-ops-platform 開発ガイド（AIコーディングエージェント向け）

PrjOps AI基盤 + DevOps運用基盤の統合モノレポ（14エージェント）。
このファイル（AGENTS.md）が Claude Code / Droid 等のAIコーディングエージェント向け規約の正本である。CLAUDE.md は `@AGENTS.md` によるインポートのみを含む。

## コマンド体系（mise + pnpm）

ツールバージョンは `.mise.toml` で固定（Node 20 / pnpm 9）。npmコマンドは使用しない。

```bash
mise run install        # = pnpm install
mise run build          # 全パッケージビルド
mise run test           # 全パッケージテスト（vitest）
mise run typecheck      # 全パッケージ型チェック
mise run lint           # 全パッケージESLint実行
mise run format         # Prettierフォーマットチェック（差分なしを確認。適用は pnpm run format:write）
mise run traceability   # 仕様ID⇔実装⇔テストの相互参照検証
mise run ci             # 上記をCIと同順序で一括実行（= Definition of Done）
pnpm --filter @aiops/shared run test   # 単一パッケージのみ実行する場合
```

**Definition of Done: `mise run ci` がgreenであること。** 部分的な完了でタスクを終了しない。

## パッケージ構成

- `packages/shared` — 共通基盤（ID体系・営業日・監査ログ・secretSanitizer・Anthropic/GitHub/Graphクライアント）。外部依存最小
- `packages/prjops` — PrjOps AGT-01〜07（プロジェクト進捗・報告・ポートフォリオ）
- `packages/devops` — DevOps AGT-ORCH/BLD/DEP/INC/CHG/RPT/SEC（CI/CD・インシデント・権限）
- `packages/server` — 常駐サーバ（Hono）: webhook受信・常駐ループ・WebUIプロキシ（ADR-0005）
- `packages/web` — WebUIダッシュボード（Next.js + Vercel AI SDK チャット）
- `packages/traceability` — 仕様トレーサビリティ検証ツール

## 設計原則（違反PRはレビューで差し戻される）

1. **lib/ と agents/ の物理的分離**: `src/lib/` は外部API・LLM・DBに依存しない純粋関数のみ。
   判定・スコアリング・状態遷移・バリデーションはすべてlib/に置き、`src/agents/` は
   lib/の関数と外部クライアントを結線する薄いオーケストレーション層に徹する。
2. **数値・色・表はコード算出、LLMは文章スロット/表示パラメータのみ**: LLMに数値を生成させない。
   レポートの数値はlib/の決定的関数、LLMは結論文・要約文（PrjOps）またはViewSpecのtool call（web）に限定。
3. **根拠IDヘッダ必須**: 新規ファイルの先頭コメントに根拠となる仕様ID
   （REQ-xxx / SPEC-INT-xxx / SPEC-EXT-xxx / TH-xxx / AC-xxx / ADR-xxxx）を記載する。
   `mise run traceability` が検証する。
4. **秘密情報の多層防御**: 外部から受けたテキストは (a) DB保存前 `sanitizeSecrets()`、
   (b) LLM入力前 `sanitizeForLlmInput()`、(c) ログ・PRコメント出力前、の3箇所で必ずサニタイズ。
5. **監査ログは追記専用**: `AuditLogWriter.append()` のみ。UPDATE/DELETEするコードを書かない。
   理由必須操作（status_override等）は `validateReasonRequirement` を通す。
6. **権限フィルタはデータ取得側で強制**: レポート・API応答は `reportPermissionFilter`
   （isProjectInScope / filterIssuesForProfile / isActiveRecipient）を必ず経由。
   表示層での後付けマスキングは禁止。recipientsのactive判定はリクエスト毎（キャッシュ禁止）。
7. **外部クライアントは注入可能に**: fetch実装・TokenProvider・依存はコンストラクタ/引数で注入し、
   テストはネットワークなしで実行できる形を維持する（既存 `FetchLike` パターン踏襲）。

## テスト規約

- vitest。テストファイルは `packages/*/tests/*.test.ts`
- describe/itのタイトルに検証対象の仕様ID（REQ/SPEC-INT/TH/AC）を含める
- spec IDは `system` + ID文字列で名前空間を持つ。PrjOpsとDevOpsで同じ番号（例: `SPEC-INT-063`）が存在し得るため、レビュー時は `packages/traceability/spec-ids/{prjops,devops}.json` の所属も確認する。
- lib/の純粋関数は境界値・エラーケースを網羅。agents/はDI注入モックで結線を検証
- HTTPハンドラ（server）は `app.request()` でポートを開かずにテスト

## schema.sql 変更手順

1. `packages/devops/src/db/schema.sql` に `CREATE TABLE IF NOT EXISTS` で追記（既存テーブルのALTERは別途DDLコメントで明示）
2. 対応するリポジトリ層（`packages/server/src/db/*Repo.ts`）とテストを同一PRで追加
3. audit_logテーブルへのUPDATE/DELETE権限をアプリロールに付与しない（REVOKE維持）

## Git / PR 規約

- mainへの直接pushは禁止。ブランチを切りPRを作成する
- AIエージェントが生成するPRは `agent/{task-id}` ブランチ + `ai-generated` ラベル（ADR-0006）
- 自動マージ禁止。マージは人間レビュアーのみ（CODEOWNERS + ブランチ保護）
- CODEOWNERS の `@OWNER` は go-live 前に実GitHubユーザー/チームへ置換する。設定手順は `runbooks/production-gates.md`。
- AI PR 作成には `AIOPS_PR_TOKEN`（GitHub App installation token または専用PAT）を使う。未設定のまま運用しない。
- PRテンプレート（.github/PULL_REQUEST_TEMPLATE.md）のチェックリストを埋める
- コミット前に gitleaks 相当の秘密情報混入がないことを確認（CIでも検証される）

## 主要な参照ドキュメント

- `docs/adr/` — アーキテクチャ決定記録（0001: モノレポ、0002: Claude API使い分け、0003: 実行基盤、0004: mise/pnpm、0005: 常駐サーバ+Teams統合、0006: AIコーディングエージェント統合、0007: GitHub時系列スナップショット、0008: Excelインポート、0009: Recharts 3、0010: Seven Keys正典、0011: 投資家ペルソナ、0012: 報告標準化、0013: ページエージェント）
- `runbooks/manual-ops.md` — エージェント停止時の手動運用
- `verification/VERIFICATION_REPORT.md` — テスト検証状況
