# ADR-0026: Wispr、Confluence、SharePoint、Plane、GitHubの会議・知識・実行責務を分離する

## Status

Proposed（2026-08-10 取込。Owner 承認後に Accepted 化。取込元: docs/plans/2026-08-final-architecture/10_adrs/）

## Decision

Wisprはmeeting intelligence、Confluenceはworking technical knowledge、SharePointはformal records/evidence、Planeはoperational actions、GitHubはdevelopment tasks/code/PRを担当する。会議ノートはhuman review後に必要な正本へ分配し、全文を全systemへ複製しない。Notionはbaselineから除外する。
