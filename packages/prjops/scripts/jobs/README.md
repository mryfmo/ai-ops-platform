# packages/prjops/scripts/jobs/

ADR-0014 により、PrjOps のアウトバウンド配信は package-local workflow / pseudo MSAL job ではなく、resident server scheduler へ移行した。

このディレクトリにあった `request-weekly.mjs` は削除済み。標準 report の生成は `.github/workflows/report-generation.yml` が担い、検証済み `report.json` は server の `POST /reports/ingest` へ渡される。実配信は `packages/server/src/scheduler/tasks/reportDeliveryTask.ts` が recipients、冪等配信ログ、Graph client、監査ログを使って実行する。
