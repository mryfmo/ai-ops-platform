# T06: Phase D — 設計 ADR 群と仕様変更の起案

## Objective

`.orchestration/research/` の調査結果 4 ファイル(2026-07-09-deep-research.md / seven-keys.md / charts-and-design.md / agent-standardization.md)を根拠として、以下の設計を ADR 化し、仕様 ID を追加し、PR を作成する。**設計判断はオーケストレーターが下記のとおり確定済み**。codex は ADR の起案・整合性チェック・仕様 ID 登録を行う。

## 作業内容

1. 調査結果を `docs/research/` にコピーして commit 対象にする(`cp .orchestration/research/2026-07-09-*.md docs/research/`)。ADR からはこちらを参照する。
2. 既存 ADR(0001〜0006)の書式に従い、以下を新規作成(`.claude/skills/new-adr` の書式指針があれば従う):

- **ADR-0007: GitHub 時系列データ基盤 — webhook 駆動スナップショット蓄積**
  決定: Projects v2 は per-item 変更履歴を遡及取得できないため、org-level webhook(projects_v2_item の from/to、projects_v2_status_update)+ 既存 events テーブル経路でスナップショットを自前 DB に蓄積し、定期フルポーリングで照合(reconcile)する。取得は forward-only のため本基盤を最優先で稼働開始。rate limit はハードコードせず rateLimit オブジェクトから実行時取得。週/月/四半期/半年/年の集計はスナップショットからコード算出。
- **ADR-0008: Excel インポート方式**
  決定: exceljs を採用(npm SheetJS は CVE-2024-22363 恒久未修正のため不可)。インポート対象は Issue / Project v2 アイテム / Milestone(**PR は対象外** — PR はコード変更から生成されるものでありデータ登録の対象として不適切、と明記)。冪等性は source-row key(テンプレートの安定キー列)を issue body のマーカー + インポート台帳テーブルの両方で担保し再実行安全にする。GitHub の 2 段ミューテーション(add→update)とセカンダリリミット(コンテンツ生成 80/分・500/時)に対応するジョブキュー+進捗レポート+バリデーションエラーレポート(行番号付き)を設計に含める。取り込みテキストは 3 箇所サニタイズ規約を通す。
- **ADR-0009: チャートライブラリ — Recharts 3 の採用(REQ-010 AC-010-1 の仕様変更)**
  決定: 手書き SVG 制約を緩和し Recharts 3 を採用(React 19 peerDeps 対応・活発メンテ・a11y デフォルト有効・CSS 変数テーミングが Tailwind v4 と整合、MIT)。client component 限定である事実と、既存手書き SVG(バーンダウン/ドーナツ)の移行方針を記載。ドーナツは NN/g 指針(角度エンコード回避)に照らし原則置換。RAG 表示は色+第 2 チャネル冗長化、数値は tabular figures。**仕様変更手続き**: `.github/ISSUE_TEMPLATE/spec-change.yml` に従い spec-change issue を起票し、ADR から参照する。
- **ADR-0010: Seven Keys to Success 正典準拠**
  決定: executiveSevenKeys を正典 7 キー(Stakeholders committed / Business benefits / Work & schedule predictable / Scope managed / Team high performing / Risks mitigated / Delivery org benefits)の**プロジェクト毎 × キー毎 RAG** に刷新。direct controls(キー 3/4/5)+キー 6 の一部は GitHub 由来データからコード算出、indirect controls(キー 1/2/7)は構造化質問票入力+LLM は文章スロットのみ。現行の予算消化率は正典が排除する財務指標のため Seven Keys からは除去(必要なら別ビューへ)。月次 PDCA サイクルを報告ジョブに組み込む。
- **ADR-0011: PE 投資家向け報告ペルソナ**
  決定: ILPA Portfolio Company Metrics Template(2019 年版)を暫定ベースラインとする investor ペルソナを新設。フィールドセットをハードコードせず、2027 年 1 月の改訂版を吸収できるメトリクス定義テーブル方式にする。既存 personaResolver / reportPermissionFilter / profileReports の拡張として設計。
- **ADR-0012: AI エージェント報告の標準化**
  決定: 標準報告は CI(GitHub Actions)からの headless 生成のみとする — Claude Code は `claude -p --bare --output-format json --json-schema`、Droid は `droid exec -o json` + リポジトリ側スキーマ検証。スロット文字数の上限は両プラットフォームともスキーマで強制できない(structured outputs は maxLength 非対応)ため、shared の anthropicClient ラッパーに検証+リトライ+切詰めを実装する方針を明記。報告テンプレート/スキーマは共通ソース 1 箇所に置き、`.claude/skills` と `.factory/droids`+`.factory/skills` はそれを参照するだけにする。
- **DORA 5 メトリクス対応**(小規模のため ADR 不要なら ADR-0007〜0012 のいずれかに含めるか、spec-change issue のみでも可): deployment rework rate を doraMetrics に追加、サービス単位表示+チーム間比較禁止の表示原則を明記。

3. `packages/traceability/spec-ids/` に新規 REQ/SPEC-INT/AC ID を追加(ADR 毎に対応する ID 帯を起案。実装はまだしない — ID とプレースホルダの追加が traceability 検証を壊さないことを確認すること。壊れる場合は ID 追加は実装フェーズに送り、ADR に予定 ID として記載するだけにする)。
4. spec-change issue の起票(`gh issue create` で spec-change テンプレートに沿って REQ-010 AC-010-1 の変更を 1 件)。
5. ブランチ `agent/T06`、Conventional Commits、PR 作成(`ai-generated` ラベル)、マージ禁止。DoD: `mise run ci` green(ドキュメント中心だが traceability を壊さないこと)。

## Forbidden actions

- 実装コードの変更(このタスクは docs/ と spec-ids と issue 起票のみ。既存コードへの変更は traceability を通すための最小限のプレースホルダを除き禁止)
- main への push、PR マージ、force push
- 依存関係の追加
- 調査結果にない事実の創作(ADR の根拠は research ファイルの記載と出典 URL に限定)

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T06-report.md` — 作成 ADR 一覧、PR URL、spec-change issue URL、判断に迷った点
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T06-validation.txt` — `mise run ci` 末尾、`git show --stat HEAD`、`gh pr view --json url,labels`、`gh issue view <spec-change番号> --json url,title`
- sandbox / learning / autoskill: 同ディレクトリの T06-\*.md(不使用なら 1 行)

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T06 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 30
