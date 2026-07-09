# ADR-0003: DevOpsは常駐サービス、PrjOpsはGitHub Actionsのみで完結させる

## ステータス

採用

2026-07-09 追記: ADR-0014 はアウトバウンド配信用途に限り、PrjOps を GitHub Actions cron のみで動かす決定を更新する。配信は recipients、冪等配信ログ、監査ログ、Graph token provider を同じランタイムで使う必要があるため、常駐 server scheduler で実行する。

## コンテキスト

- PrjOps ASM-006: 「本システムの実行基盤はGitHub Actions（スケジュール実行）＋Claude Agent SDKとし、
  独自サーバは持たない」。
- PrjOps SPEC-INT-040 のジョブは最短でも「毎営業日09:00」「毎時」の粒度であり、
  GitHub Actionsの`schedule`トリガー（cron、実用上の最短間隔は概ね5分)で十分表現できる。
- DevOps DOC-INT-04 §1: 「各エージェント（AGT-BLD/DEP/INC/CHG/RPT/SEC）は独立プロセス（コンテナ）
  として稼働」。
- DevOps SPEC-INT-040: AGT-ORCHのヘルスチェックは「30秒間隔」。
- DevOps SPEC-INT-032: AGT-SECのJIT失効は「スケジューラが毎分、expires_at <= now の権限を剥奪」。

## 決定

- **PrjOps**は元資料の指示（ASM-006）どおり、GitHub Actionsのスケジュール実行のみで構築する。
  常駐サーバ・常駐コンテナは持たない。本リポジトリの`packages/prjops/src/workflows/*.yml`が
  その実装である。
- **DevOps**は、30秒間隔のヘルスチェックと毎分のJIT失効判定という、GitHub Actionsのcron機構では
  原理的に実現できない要件があるため、常駐コンテナ（DOC-INT-04 §1のとおり）が必要である。
  本番デプロイの実行トリガー（`deploy-prod.yml`）と日次/週次/月次レポート生成のみは
  GitHub Actionsのスケジュール実行で代替可能なため、そちらはワークフローとして提供する。
  常時稼働が必要な部分（イベントバス、ヘルスチェック、JIT失効ループ）は、
  DevOps運用環境表(OPS-06)が示すクラウド実行基盤（AWS/Azure等、選定は貴組織の残課題）上の
  コンテナとして稼働させることを前提とし、その旨を`runbooks/manual-ops.md`に明記する。

## 根拠

GitHub Actionsのスケジュールされたワークフローの最小間隔は実用上5分程度であり
（GitHub公式ドキュメントでも高頻度cronの遅延が明記されている）、30秒間隔のヘルスチェックや
毎分のJIT失効判定を正確に満たすことはできない。元資料自体もDevOpsについては
「独立プロセス（コンテナ）として稼働」と明記しており、PrjOpsのASM-006（独自サーバを持たない）と
は異なる前提を置いていることが読み取れる。この差異を偽って両方をGitHub Actionsのみで
実装したように見せることは、TH-007（本番権限8時間失効等）の正確な実装を損なうため避けた。

## 影響

- DevOpsの本番導入には、PrjOpsにはないクラウドホスティング（コンテナ実行環境）の追加調達が必要になる
  （DevOps OPS環境表に記載のとおり）。
- 本リポジトリのDevOpsエージェント実装（`packages/devops/src/agents/*.ts`）は、常駐プロセスの
  メインループからも、GitHub Actionsの単発実行からも呼び出せるよう、副作用のない関数として
  設計している（`AGT_ORCH.evaluateFailsafe`等はいずれも呼び出し側が任意の頻度で呼べる純粋関数）。
