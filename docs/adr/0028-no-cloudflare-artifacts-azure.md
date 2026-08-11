# ADR-0028: Cloudflare Artifactsを採用せずAzure baselineと既存SoRを維持する

## Status

Accepted（2026-08-11 Owner 承認。根拠: 承認済み baseline-delta と pack 取込の Owner 承認（PR #152）、P0 フェーズでの本 ADR 群に基づく実行実績、および ENV-DEC-001 / ADR-0029 の Owner 裁定。取込元: docs/plans/2026-08-final-architecture/10_adrs/。承認署名 = 本 Status 変更 PR への Owner approve（ruleset 20678089 強制下）。2026-08-10 取込時は Proposed）

**一部 Superseded by ADR-0029（2026-08-10 Owner 再裁定「AzureではなくAWSとする」）**:
本 ADR 末尾の「Bedrock 利用を理由に platform を AWS へ移さず、ADR-0016 の Azure
baseline を維持する」条項は ADR-0029 により置換された。Cloudflare Artifacts 不採用と
SoR 構成（GitHub / SharePoint / 一時成果物）の決定は引き続き有効。

## Decision

Cloudflare Artifactsをknowledge sync、agent workspace、正式保存のいずれにも採用しない。GitHubをcode/versioned knowledge原本、SharePointをformal record、S3/SharePoint Embedded等を必要に応じた一時成果物とする。Cloudflare OSは設計参照のみ。Bedrock利用を理由にplatformをAWSへ移さず、ADR-0016のAzure baselineを維持する。
