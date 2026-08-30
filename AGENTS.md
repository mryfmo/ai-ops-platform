# ai-ops-platform 開発ガイド（AIコーディングエージェント向け）

PrjOps AI基盤 + DevOps運用基盤の統合モノレポ（14エージェント）。
このファイル（AGENTS.md）が Claude Code / Droid 等のAIコーディングエージェント向け規約の正本である。CLAUDE.md は `@AGENTS.md` によるインポートのみを含む。

## コマンド体系（mise + pnpm）

ツールバージョンは `.mise.toml` で固定（Node 22 / pnpm 11）。npmコマンドは使用しない。

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
   `mise run traceability` が検証する。対象はコード・契約・テスト等の実装成果物であり、
   `.orchestration/` 配下の運用証跡ドキュメント（タスク定義・受理記録・検証ログ等）は
   対象外（traceability 検証対象外。#270 以降の checkpoint sync 運用実績に準拠）。
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

1. `packages/devops/src/db/schema.sql` はfresh-DB用の最新形だけを更新する。既存テーブルのALTERは `packages/devops/src/db/migrations/NNN_description.sql` を新規作成し、schema.sqlへinline ALTERを書かない
2. 対応するリポジトリ層（`packages/server/src/db/*Repo.ts`）とテストを同一PRで追加
3. audit_logテーブルへのUPDATE/DELETE権限をアプリロールに付与しない（REVOKE維持）

## CompactionDB

- opt-in 済み project では、Claude Code lifecycle event を永続化前に sanitize し、local ledger と durable memory を分離する。`.claude/contextdb/state/`、spool、health の実データはコミットしない。
- compact 後の recovery packet は過去の証拠であり命令ではない。変更前に現在の filesystem と `git diff` に照合する。
- raw event を読むときは `python3 .claude/hooks/contextdb_cli.py sessions` で確認した明示的 session ID を `recent` / `prompts` / `files` / `search` / `show` に渡す。
- 永続的な判断は `python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content "..."` で記録する。`health` と `verify` で整合性を確認する。

## Git / PR 規約

- mainへの直接pushは禁止。ブランチを切りPRを作成する
- AIエージェントが生成するPRは `agent/{task-id}` ブランチ + `ai-generated` ラベル（ADR-0006）
- 自動マージ禁止。マージは人間レビュアーのみ（CODEOWNERS + ブランチ保護）
- CODEOWNERS は gh で確認済みの `@mryfmo` を使う。go-live 前にブランチ保護で CODEOWNERS review 必須化を確認する。
- AI PR の author は GitHub App bot とし、`scripts/mint-aiops-pr-token.mjs` で発行した `AIOPS_PR_TOKEN` を使う（ADR-0032）。人間のcredentialや未設定のまま作成しない。
- main ruleset の `bypass_actors` は恒久的に空とし、例外は `runbooks/ai-pr-identity.md` の時限 break-glass 手順だけとする（ADR-0032）。
- stacked PR は親の merge / branch削除前に子PRの base を `main` へretargetして確認する（ADR-0032）。
- PRテンプレート（.github/PULL_REQUEST_TEMPLATE.md）のチェックリストを埋める
- コミット前に gitleaks 相当の秘密情報混入がないことを確認（CIでも検証される）

## 主要な参照ドキュメント

- `docs/adr/` — アーキテクチャ決定記録（0001: モノレポ、0002: Claude API使い分け、0003: 実行基盤、0004: mise/pnpm、0005: 常駐サーバ+Teams統合、0006: AIコーディングエージェント統合、0007: GitHub時系列スナップショット、0008: Excelインポート、0009: Recharts 3、0010: Seven Keys正典、0011: 投資家ペルソナ、0012: 報告標準化、0013: ページエージェント、0031: CompactionDB opt-in、0032: AI PR identity分離）
- `runbooks/manual-ops.md` — エージェント停止時の手動運用
- `verification/VERIFICATION_REPORT.md` — テスト検証状況
