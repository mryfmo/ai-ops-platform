# ADR-0028: Cloudflare Artifactsを採用せずAzure baselineと既存SoRを維持する

## Status
Accepted.
一部Superseded by ADR-0029（2026-08-10 Owner再裁定「AzureではなくAWSとする」）: 末尾の「Bedrock利用を理由にplatformをAWSへ移さず、ADR-0016のAzure baselineを維持する」条項はADR-0029により置換。Cloudflare Artifacts不採用と既存SoR構成の決定は引き続き有効。

## Decision
Cloudflare Artifactsをknowledge sync、agent workspace、正式保存のいずれにも採用しない。GitHubをcode/versioned knowledge原本、SharePointをformal record、S3/SharePoint Embedded等を必要に応じた一時成果物とする。Cloudflare OSは設計参照のみ。Bedrock利用を理由にplatformをAWSへ移さず、ADR-0016のAzure baselineを維持する。
