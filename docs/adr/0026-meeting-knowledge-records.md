# ADR-0026: Wispr、Confluence、SharePoint、Plane、GitHubの会議・知識・実行責務を分離する

## Status

Accepted（2026-08-11 Owner 承認。根拠: 承認済み baseline-delta と pack 取込の Owner 承認（PR #152）、P0 フェーズでの本 ADR 群に基づく実行実績、および ENV-DEC-001 / ADR-0029 の Owner 裁定。取込元: docs/plans/2026-08-final-architecture/10_adrs/。承認署名 = 本 Status 変更 PR への Owner approve（ruleset 20678089 強制下）。2026-08-10 取込時は Proposed）

## Decision

Wisprはmeeting intelligence、Confluenceはworking technical knowledge、SharePointはformal records/evidence、Planeはoperational actions、GitHubはdevelopment tasks/code/PRを担当する。会議ノートはhuman review後に必要な正本へ分配し、全文を全systemへ複製しない。Notionはbaselineから除外する。
