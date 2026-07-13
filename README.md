# AI Ops Platform — PrjOps AI基盤 × AIエージェント主導DevOps運用基盤

統合14エージェント（PrjOps 7体 + DevOps 7体）による、プロジェクト運営（進捗・報告・ポートフォリオ）と
開発・運用（CI/CD・リリース・インシデント・権限）の自動化基盤。

- 元資料: `PrjOps.zip`（DOC-00〜07）、`DevOps.zip`（DOC-ANL-01〜OPS-06）、
  提案書 `AI_PrjOps-DevOps_守屋案_20260703_vol003.pptx`
- 対象規模: プロジェクト約50件（設計上限100件）、関連企業国内外数十社（設計上限100社）
- 前提ツール: Claude Code / GitHub / Microsoft Teams / Outlook（PRE-01）

このドキュメントは、成果物の全体像・設計判断の根拠・セットアップ手順・検証状況を1か所にまとめたもの。
**検証状況の詳細（何を実際にテストし、何が未検証か）は [`verification/VERIFICATION_REPORT.md`](./verification/VERIFICATION_REPORT.md) を必ず参照すること。**
実装に即した仕様・参照・利用ガイドの入口は [`docs/README.md`](./docs/README.md) にまとめている。

---

## 1. 全体構成

```
ai-ops-platform/
├── packages/
│   ├── shared/        # 両システム共通基盤（営業日カレンダー、ID体系、監査ログ、秘密情報サニタイザ、
│   │                   #  Anthropic/Claude Agent SDK/Microsoft Graph/GitHubクライアント）
│   ├── prjops/         # PrjOps AI基盤: AGT-01〜07
│   │   ├── src/lib/         決定的ロジック（ステータス判定、督促スケジュール、コマンドパーサ 等）
│   │   ├── src/templates/   5プロファイル×日英の自己完結HTMLレポート生成
│   │   ├── src/agents/      AGT-01(オーケストレーター)〜AGT-07(検証)
│   │   ├── src/workflows/   GitHub Actionsワークフロー定義（配信先リポジトリへ配置する想定）
│   │   └── scripts/jobs/    ワークフローから呼ばれるジョブ実行スクリプト（実装例）
│   ├── devops/         # DevOps運用基盤: AGT-ORCH/BLD/DEP/INC/CHG/RPT/SEC
│   │   ├── src/lib/         リスクスコア、TH-001〜007評価、デプロイ状態機械、DORA指標
│   │   ├── src/templates/   3プロファイルの自己完結HTMLレポート生成
│   │   ├── src/agents/      7エージェント
│   │   ├── src/db/          PostgreSQLスキーマ（SPEC-INT-050番台）
│   │   └── src/workflows/   deploy-prod.yml 等
│   └── traceability/   仕様ID⇔実装⇔テストの相互参照検証ツール
├── docs/
│   ├── adr/                 主要な設計判断の記録（Architecture Decision Records）
│   └── best-practices-research.md   採用したベストプラクティスと出典
├── runbooks/
│   ├── manual-ops.md         エージェント停止時の手動運用手順（SPEC-INT-060, REQ-029）
│   └── e2e-real-environment.md  実環境E2E検証の前提・手順・チェックリスト
├── verification/
│   ├── VERIFICATION_REPORT.md
│   └── test-results/
└── .github/workflows/ci.yml  このリポジトリ自身のCI
```

## 2. セットアップ（実運用に進める場合）

ツール（Node.js/pnpm）のバージョンは [mise](https://mise.jdx.dev/)（`.mise.toml`）で管理する。
`mise install` で初回のみツール本体を導入し、以降は `mise run <task>` でタスクを実行する
（`pnpm` 自体もmise管理下のため、素の `pnpm` コマンドも `mise exec -- pnpm ...` 相当で動く）。

```bash
mise install                # Node.js 20 / pnpm 9 を導入
mise run install             # = pnpm install
mise run build               # 全パッケージのビルド
mise run test                # 全パッケージのユニットテストを実行
mise run typecheck           # 全パッケージの型チェック
mise run traceability        # 仕様トレーサビリティ検証
mise run ci                  # 上記をCIと同順序で一括実行
```

実運用に必要な外部リソース（GitHub Organization、Microsoft 365テナント、Anthropic APIキー等）の
一覧・概算費用は、元資料 `PrjOps DOC-06/07`・`DevOps DOC-DEV-05/OPS-06` を参照（本リポジトリには
価格情報は含めていない。契約前に必ず一次情報で最新価格を再確認すること、と元資料にも明記されている）。

## 3. なぜこの構成か（設計判断の要点）

詳細は `docs/adr/` を参照。要点のみ:

1. **モノレポ + ワークスペース分割**: PrjOpsとDevOpsは元資料上は別システム（別リポジトリ・別DB・
   別保持期間）だが、開発体制1名（ASM-007）・共通ツール基盤（Claude/GitHub/Teams/Outlook）という
   前提に基づき、開発効率を優先してモノレポ化した。ただし論理的な分離（正本データ・監査ログの
   保持期間5年 vs 1年等）はパッケージ境界で維持している（`docs/adr/0001-monorepo.md`）。
2. **決定的ロジックとLLM呼び出しの物理的分離**: `src/lib/`（外部npm依存ゼロの純粋関数）と
   `src/agents/`（LLM・外部API呼び出しを含む薄いオーケストレーション層）を分けた。
   これにより判定・スコアリング・状態遷移の正しさをLLMの非決定性から独立してテストできる
   （REQ-007 AC-007-1、DevOps AC-011a等が要求する決定性の直接的な実装手段）。
3. **Claude API利用の使い分け**: 構造化JSON抽出（分類・要約）は `@anthropic-ai/sdk` の
   Messages APIをツール強制（`tool_choice`）方式で、コード修正案生成のみ
   `@anthropic-ai/claude-agent-sdk`（Claude Code相当）をread-onlyワークスペースで、という
   使い分けをしている（`docs/adr/0002-claude-sdk-usage.md`）。
4. **GitHub Actions vs 常駐サービス**: PrjOpsはGitHub Actionsのスケジュール実行のみで完結する
   設計（ASM-006）だが、DevOpsは30秒間隔のヘルスチェックや毎分のJIT失効判定など
   GitHub Actionsのcron粒度（最短5分）では実現できない要件があるため、常駐コンテナが必要になる
   （`docs/adr/0003-devops-runtime.md`）。

## 4. 検証について（要点）

- 現行テストスイートの合否と件数は、固定値を本文へ転記せず `mise run ci` の出力を正とする。
  過去スナップショットとの範囲差および最新の検証証跡は
  [`verification/VERIFICATION_REPORT.md`](./verification/VERIFICATION_REPORT.md) に記録している。
- Phase V では Web を `next build` + `next start` で実起動し、`/app/login` と `/app/api/health`
  の実HTTP 200、未認証時の `/app/dashboard` 307、`/app/api/data/*` と `/app/api/chat` の 401 を確認した。
  認証済みダッシュボード、実DB、実LLM、GitHub/Teams webhook は実環境必須であり、ローカルのモックや
  スタブを E2E として扱っていない。
- LLM呼び出しを直接含むコード（Anthropic SDK依存）は、ネットワーク遮断の著者環境の制約により
  実行はできなかったが、周辺の決定的ガード処理は分離してテスト済み。SDKの使い方自体は
  2026年7月時点の公式ドキュメントに基づく（`docs/best-practices-research.md`）。
- 仕様ID（REQ/SPEC-INT/TH）は実装コードから機械的に検索可能で、必須カテゴリは100%の参照率。
- 実環境で完了させる E2E の前提と手順は [`runbooks/e2e-real-environment.md`](./runbooks/e2e-real-environment.md)
  を参照すること。

**この状況を偽らず、`verification/VERIFICATION_REPORT.md` に完全に開示している。**

## 5. ライセンス・免責

本リポジトリは依頼者向けの成果物として作成された。実運用移行前に、元資料が明記する残課題
（PrjOps ASM-001「現状分析は標準参照モデル」、DevOps DOC-ANL-01「残課題OPEN-001」）を
貴組織の実態で検証すること。移行計画書・テスト計画書は元資料・本成果物ともスコープ外
（PrjOps DOC-03 §7、提案書スライド14補足に明記）。
