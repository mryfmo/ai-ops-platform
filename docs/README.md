# Documentation Index

## 開発者向け

- [Architecture Overview](spec/overview.md)
- [Data Model](spec/data-model.md)
- [Spec ID Catalog](spec/spec-id-catalog.md)
- [Package Reference](spec/packages.md)
- [ADR](adr/)
- [Jira × GitHub governed integration ADR](adr/0030-jira-github-governed-integration.md)
- [Verification Report](../verification/VERIFICATION_REPORT.md)

## 運用者向け

- [HTTP API Reference](reference/http-api.md)
- [CLI Reference](reference/cli.md)
- [Configuration Reference](reference/configuration.md)
- [Page Agent Tools](reference/page-agent-tools.md)
- [Manual Ops Runbook](../runbooks/manual-ops.md)
- [Jira × GitHub Cutover Runbook](../runbooks/jira-github-cutover.md)
- [Observability and SLO Runbook](../runbooks/observability-slo.md)
- [Real Environment E2E Runbook](../runbooks/e2e-real-environment.md)

## 利用者向け

- [Dashboard Guide](guide/dashboard.md)
- [Reports Guide](guide/reports.md)
- [Excel Import Guide](guide/excel-import.md)

## Source Documents and Research

- [PrjOps searchable source mirror](spec/prjops/)
- [DevOps searchable source mirror](spec/devops/)
- [Best Practices Research](best-practices-research.md)
- [Research Notes](research/)
- [Teams App Docs](teams-app/README.md)

`PrjOps.zip` / `DevOps.zip` が改変しない正本で、上記2ディレクトリは検索・レビュー用の派生ミラーです。ミラーの直接編集は禁止します。更新時は先にZIP正本を置き換えてからミラーを再展開し、`pnpm run governance:check` で許可済みの14ファイル名、パス、内容ハッシュの1対1一致を確認します。不足、過剰、改名、大文字・小文字やUnicode正規化の衝突、非通常ファイル、危険なパス、内容の不一致があればCIは失敗します。ZIPと展開サイズにも上限を設け、検証処理自体のメモリ枯渇を防ぎます。
