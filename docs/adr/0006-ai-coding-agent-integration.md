# ADR-0006: AIコーディングエージェント（Claude Code / Droid）をタスク指示・実行・可視化の3面で統合する

## ステータス

採用

## コンテキスト

- 開発者は日常的にClaude Code / Droid（Factory）でコーディングを行っている。
- 新要件: (a) Teams/WebUIからコーディングタスクを指示しエージェントが修正PRを作成する、
  (b) エージェント稼働状況（実行タスク・生成PR・レビュー状況）をプラットフォームで可視化する、
  (c) 本プラットフォーム自体の開発をAIエージェントで進める前提を整備する。
- 既存制約: REQ-002 AC-002b「修正案がリポジトリへ自動コミット・自動マージされない」。
  既存AGT-BLDはClaude Agent SDKをread-only権限（Read/Grep/Globのみ）で使用している（ADR-0002）。

## 決定

1. **コーディングタスクの実行環境はGitHub Actionsランナー**とする（常駐コンテナ内での
   Agent SDK直接実行は不採用）。`.github/workflows/coding-task.yml`（workflow_dispatch）が
   `anthropics/claude-code-action`（または`droid exec`）でタスクを実行する。
   実行はcomposite action化し、agentパラメータ（claude-code | droid）で差し替え可能にする。
2. **AC-002bの整合解釈**: 同ACの本質は「mainへの自動コミット・自動マージの禁止」である。
   コーディングエージェントは (1) `agent/{task-id}` ブランチへのpushのみ、(2) PR作成まで
   （マージはブランチ保護+CODEOWNERS必須レビューにより人間のみ）、(3) 生成PRに
   `ai-generated` ラベルを必ず付与、(4) 指示者・指示文・trace_idを coding_tasks テーブルと
   audit_log に記録する。この4条件の下で「修正PRの自動作成」を許可する。
3. **指示フロー**: Teams `/code fix PJ-nnn "..."` またはWebUI → 確認カード
   （Action.OpenUrlでWebUI確認画面へ。誤発火防止のため人間の明示クリック必須）→
   coding_tasks INSERT（status=queued）→ workflow_dispatch（status=running）→
   workflow_run webhookでstatus追跡（pr_created / failed）→ TeamsスレッドへPRリンク返信。
4. **可視化は決定的集計のみ**（LLM不使用。AGT-RPT原則の踏襲）: coding_tasksテーブルと
   PR分類（head branchプレフィクス `agent/` + `ai-generated` ラベル）から、実行中タスク・
   生成PR一覧・レビュー状況・マージ率を算出する。WebUIのAgentActivityViewと、
   AGT-RPTマネージャーレポートの「AI起源PR比率・AI PR変更失敗率」に反映する。
5. **開発前提の整備**: リポジトリルートのCLAUDE.md（正本）とAGENTS.md（エイリアス）、
   `.claude/skills/`（add-traced-module / db-migration / new-adr / new-runbook / release-check）、
   `.claude/agents/`（spec-reviewer / security-reviewer）、PR/Issueテンプレート、CODEOWNERSを整備する。
   `.claude/settings.json`（権限allowlist・hooks）はエージェント自身が書き込まず、
   docs/claude-code-setup.md の内容を開発者が手動で適用する。

## 根拠

- GitHub Actions実行はタスクごとの完全分離・GitHub Environmentsによる権限統制・
  workflow runへのログ保全（監査整合）を標準機構で得られる。常駐コンテナ内実行は
  リソース競合（30秒ヘルスチェックへの影響）と権限分離の自前実装が必要になる。
- ブランチ保護+CODEOWNERSによる「マージは人間のみ」は、アプリケーションコードではなく
  GitHubプラットフォームの機構で強制されるため、エージェントの不具合や
  プロンプトインジェクションでも突破できない。
- ai-generatedラベル+ブランチ命名規則による決定的分類は、可視化・DORA拡張指標を
  LLM判定なしで安定して算出するための前提。

## 影響

- GitHub Organization側の設定作業（人間）: mainブランチ保護（必須レビュー+CODEOWNERS有効化）、
  `ai-generated` ラベル作成、ANTHROPIC_API_KEY / FACTORY_API_KEY のsecrets登録。
- CODEOWNERSの `@OWNER` プレースホルダは組織導入時に実ユーザー/チームへ置換する（残課題）。
- Droid実行ステップ（droid exec）はFactory側のCI実行方式確定後に有効化する（残課題。
  coding-task.yml内にプレースホルダとして手順を記載）。
- コスト: コーディングタスク1件あたりのLLM使用はGitHub Actions側のANTHROPIC_API_KEYで
  発生し、PgCostGuardの管轄外。必要になれば使用量APIでの取り込みを検討する（残課題）。

## Amendment（2026-08-10、P0-T03）

ADR-0027（Proposed）が Droid 有効化・one-writer lock・gateway credential・独立 Codex review を追加する（拡張）。branch/PR/human merge の原則は維持。
最終アーキテクチャ計画: docs/plans/2026-08-final-architecture/（PR #152、Owner 承認済み baseline-delta 適用）。
