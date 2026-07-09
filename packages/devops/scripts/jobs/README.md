# packages/devops/scripts/jobs/

`packages/devops/src/workflows/*.yml`から呼ばれるジョブ実行スクリプトの配置場所。
実装パターンは `packages/prjops/scripts/jobs/README.md` と同一（環境変数→クライアント組立→
DB/GitHubからデータ取得→`@aiops/devops`のagents層関数を呼ぶ→ログ出力）。

想定スクリプト: `on-build-failure.mjs`（AGT-BLD, workflow_run失敗トリガー）、
`reports.mjs`（AGT-RPT, 日次/週次/月次判定+配信）、JIT失効・ヘルスチェックの常駐ループ
（`docs/adr/0003-devops-runtime.md`のとおりGitHub Actionsではなく常駐コンテナで実装する）。
