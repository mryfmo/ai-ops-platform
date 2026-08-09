# ADR-0028: Cloudflare Artifactsを採用せずAzure baselineと既存SoRを維持する

## Status
Accepted.

## Decision
Cloudflare Artifactsをknowledge sync、agent workspace、正式保存のいずれにも採用しない。GitHubをcode/versioned knowledge原本、SharePointをformal record、S3/SharePoint Embedded等を必要に応じた一時成果物とする。Cloudflare OSは設計参照のみ。Bedrock利用を理由にplatformをAWSへ移さず、ADR-0016のAzure baselineを維持する。
