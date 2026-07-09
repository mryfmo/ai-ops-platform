# ADR-0001: モノレポ構成でPrjOpsとDevOpsを統合する

## ステータス

採用

## コンテキスト

- 元資料は PrjOps・DevOps を別々の文書体系（PrjOps DOC-00〜07 / DevOps DOC-ANL-01〜OPS-06）として
  独立に定義しており、正本データも別リポジトリ（PrjOps: `prjops-data`/`prjops-system`/`prjops-reports`、
  DevOps: 単一リポジトリ+PostgreSQL）を前提にしている。
- 一方、提案書（PPTX）は「2つの運用を、1つのAIオペレーション基盤へ」統合する構想を示しており、
  共通ツール基盤（GitHub・Microsoft Teams・Outlook・Claude）を共有する設計としている。
- 開発体制は1名（PrjOps ASM-007）を前提とする。

## 決定

`ai-ops-platform` という単一のnpmワークスペース・モノレポとし、以下のパッケージに分割する。

- `packages/shared`: 両システムが共通して必要とする基盤（営業日カレンダー、ID体系、監査ログ、
  秘密情報サニタイザ、外部APIクライアント）。
- `packages/prjops`: PrjOps AI基盤固有のドメインロジック・エージェント。
- `packages/devops`: DevOps運用基盤固有のドメインロジック・エージェント。
- `packages/traceability`: 仕様⇔実装⇔テストの相互参照検証ツール。

一方で、以下の論理的分離は元資料の要求どおりパッケージ境界・データ層で維持する。

- 監査ログの保持期間（PrjOps 5年 / DevOps 1年）は別々の保持ポリシーとして実装する。
- 正本データストア（PrjOpsはGitリポジトリのYAML、DevOpsはPostgreSQL）は統合しない。
- 権限（GitHubリポジトリの書込権限）は元資料のRACIどおり別々に設定する
  （`prjops-data`はマシンアカウント+PRF-03、DevOpsのgrantsテーブルは別のJIT権限モデル）。

## 根拠

- 1名開発という制約下では、共通基盤（Graph API連携、GitHub連携、監査ログ、営業日カレンダー等）の
  実装・テスト・保守を1箇所に集約する方が総工数が小さい。
- 提案書のROI試算（開発1名・1か月）は、この種の共通化を前提にしていると解釈できる
  （提案書スライド2「重複投資を排除する」）。
- モノレポ内であっても、パッケージ単位でのnpm publish・個別デプロイは技術的に可能であり、
  将来チームが分かれた場合の分割コストは相対的に小さい。

## 影響

- テスト・ビルドはワークスペース単位（`npm run test --workspace=@aiops/prjops`等）で独立に実行できる。
- `packages/shared`の変更は両システムに影響するため、変更時は両方のテストスイートを実行する
  運用ルールとする（`.github/workflows/ci.yml`で自動化済み）。
