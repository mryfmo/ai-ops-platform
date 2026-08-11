# T16: ドキュメント整備 — 開発者向け仕様 / リファレンス / 利用者向け

## Objective

是正・統合済みの最終形(agent/T15)を正として、3 種のドキュメントを整備する。日本語、手書き markdown、依存追加なし。既存ドキュメント(AGENTS.md、docs/adr/、runbooks/、verification/)と重複させず、相互リンクで束ねる。

## ブランチ戦略

- `agent/T16` を `agent/T15` から作成、PR base は `agent/T15`(スタック継続、PR 説明に明記)

## スコープ

### 1. 開発者向け仕様ドキュメント `docs/spec/`

- `overview.md` — アーキテクチャ概観: モノレポ構成、常駐サーバ+WebUI(ADR-0003/0005)、データフロー(webhook→pm_events/pm_snapshots→ 期間集計 → ペルソナ別ビュー)、AI 統合(ADR-0002/0006/0012/0013)。既存 ADR への参照で詳細は委譲し、全体像を 1 枚で
- `data-model.md` — schema.sql の全テーブル(events、pm_events、pm_snapshots、import_ledger、coding_tasks、audit_log、grants、recipients 等)の役割・主要列・不変条件(append-only 等)
- `spec-id-catalog.md` — **仕様 ID の prose 定義カタログ**(現状 repo には ID リストのみで prose 定義がない欠落を補う)。少なくとも T05〜T15 で追加された REQ-036〜041 / SPEC-INT-062〜068, 081, 082 / AC-\* について、「何を要求するか」を 1〜3 文で定義し、根拠 ADR と代表的な実装/テストへの参照を付す。既存 ID(REQ-001〜035 等)は外部元資料が正であることを明記し、カタログの守備範囲を正直に区切る
- `packages.md` — パッケージ別モジュール解説(shared/prjops/devops/server/web/traceability の主要モジュールと責務、lib/agents 分離の実例)

### 2. リファレンス `docs/reference/`

- `http-api.md` — server(Hono)の全ルート(healthz/readyz、webhooks、coding-tasks、xlsx-import、webui proxy)と web の API ルート(/app/api/data/\*、/app/api/chat、/app/api/health): メソッド、パス、認可、リクエスト/レスポンスの要点、エラー(401/403/409 等)
- `cli.md` — CLI ツール: xlsx テンプレート生成、report スキーマ印字/検証、calculateReportMetrics/finalizeReportJson、traceability verify。実行例つき
- `configuration.md` — 環境変数リファレンス(DATABASE*URL、GITHUB*_ 、AUTH\__、ANTHROPIC_API_KEY、GITHUB_PROJECT_NODE_ID、ページエージェントの stopWhen/thinking budget 設定等)。必須/任意、既定値、未設定時挙動(例: reconcile disabled の監査記録)
- `page-agent-tools.md` — ページエージェントの tool 一覧(show_timeseries 等 6 種): 入力パラメータ、返る ViewSpec、ペルソナ可視性マトリクス

### 3. 利用者向けガイド `docs/guide/`(GitHub を知らない読者を想定、平易な日本語)

- `dashboard.md` — ダッシュボードの見方: ログイン、ペルソナ別に何が見えるか、期間切替(週/月/四半期/半年/年)の使い方、ページエージェントへの質問の仕方(推論表示・生成されたチャートの「ページに固定」)
- `reports.md` — 報告の読み方: Seven Keys(7 キーの意味と RAG の読み方、grey=未評価の意味、質問票の入力が必要な項目)、マネージャービュー(バーンダウン/ベロシティ/DORA 5 の意味、チーム間比較をしない理由)、投資家 KPI(ILPA ベース)
- `excel-import.md` — Excel 取り込み手順: テンプレート入手 → 各シート(issues/project_items/milestones)の記入規則(source_key の意味、必須列)→ dry-run でのエラー確認(行番号の読み方)→ 実行 → 再実行時は取り込み済み行が自動スキップされること → よくあるエラーと対処

### 4. 索引

- `docs/README.md` — 3 分類の索引と読者別入口(開発者/運用者/利用者)。ルート README.md からリンク

## 規約

- 記述は実装と一致させる(このタスクで新たな乖離を作らない — 不明点は必ずコードを読む。実装に無い機能を書かない)
- DoD: 並列 `mise run ci` green(ドキュメントのみだが format/traceability を通す)。Conventional Commits、PR(`ai-generated`、base=agent/T15)、マージ禁止、`.orchestration/` は commit しない

## Forbidden actions

- 依存追加(doc サイトジェネレータ等は導入しない)、実装コードの変更(誤字等の軽微修正も別と分けず report に記載すれば可)
- main への push、PR マージ、force push
- 実装に存在しない機能の記述(aspirational documentation 禁止)

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T16-report.md`
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T16-validation.txt` — ci 結果 + 作成ファイル一覧 + 記述と実装の照合方法
- sandbox / learning / autoskill: 同ディレクトリ T16-\*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T16 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 60
