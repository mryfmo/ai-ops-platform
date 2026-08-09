# ADR-0026: Wispr、Confluence、SharePoint、Plane、GitHubの会議・知識・実行責務を分離する

## Status
Accepted proposal subject to vendor/data approval.

## Decision
Wisprはmeeting intelligence、Confluenceはworking technical knowledge、SharePointはformal records/evidence、Planeはoperational actions、GitHubはdevelopment tasks/code/PRを担当する。会議ノートはhuman review後に必要な正本へ分配し、全文を全systemへ複製しない。Notionはbaselineから除外する。
