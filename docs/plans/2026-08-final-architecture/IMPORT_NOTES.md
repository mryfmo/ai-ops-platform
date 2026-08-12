# IMPORT_NOTES — 原本 zip からの意図的差分（2026-08-10）

原本: `references/ai-ops-platform-final-implementation-pack_2026-08-09.zip`（不変・SHA256 記録済み）。
本コピーは Owner 承認済み baseline-delta
（`.orchestration/plan/2026-08-10-pack-adversarial-review/02-baseline-delta.md`）の是正を適用済み（適用範囲は本表が正: PACK-01..08 / DELTA-01..07。旧記述の DELTA-08 は番号誤りで存在しない）。

| 是正ID | 変更ファイル | 内容 |
|---|---|---|
| PACK-01 | 05_contracts/control-api.openapi.yaml | WorkflowSignal から client 供給の actorId を排除（認証主体から導出） |
| PACK-02 | 06_implementation/02_wbs.yaml | P8-T04/T06 の pack 相対パスを repo パスへ正規化 |
| PACK-03 | 06_implementation/02_wbs.yaml | P0-T05 の実在しない `mise run verify:load` を実コマンドへ |
| PACK-04 | 06_implementation/02_wbs.yaml | P0-T03 に traceability 文法/カタログ拡張設計を追加 |
| PACK-05 | 06_implementation/08_feature_flags.yaml | 現行 coding-task 経路の grandfather 規則を明記 |
| PACK-06 | 02_wbs.yaml / 09_owner_decision_register.md | P0-T02 の前提 = ENV-DEC-011（GitHub プラン） |
| PACK-07 | 05_contracts/control-api.openapi.yaml | /health/* と既存 /healthz//readyz の一本化注記 |
| PACK-08 + DELTA-02 | 05_contracts/ledger-migration-design.sql | 既存 approvals/deployments の evolve 方針注記 |
| DELTA-01 | 02_wbs.yaml | P3-T09 の shadow 対象 = 現行 scheduler 15本、P3-T13 新設 |
| DELTA-05 | 02_wbs.yaml | P2-T06 の LLM consumer 一覧を #147 後の現実へ |
| DELTA-03 | 02_wbs.yaml (P1-T05) / ledger-migration-design.sql | 既存 approvals/deployments の authority mapping（並行正本の禁止） |
| DELTA-04 | 02_wbs.yaml (P9-T08) | 既存監視資産（KQL 6ルール・httpMetrics・rolling gauges）の拡張を明記、allowed_paths に ops/azure-monitor-alerts/** |
| DELTA-06 | 02_wbs.yaml (P0-T04) | agt-dep-th001-evidence 契約の保存を受入条件化 |
| PACK-IMPORT-002..005 | docs/adr/0020..0028 / VALIDATION_REPORT / DOCUMENT_INDEX / PACK_MANIFEST / APPLY / Makefile / scripts/validate_pack.py | 独立レビュー是正: repo 側 ADR コピーの prettier 正規化（pack 原本は byte 忠実のまま）、再検証記録（113/64）、再現可能な検証コマンド（uv）、YAML `#` 切詰め防止 assertion |
| DELTA-07 | 02_wbs.yaml / 02_acceptance_test_catalog.yaml / 09_owner_decision_register.md | P6-T11（A054）・P9-T09（A053）新設、ING-001/AIO-006 ゲート追加、D-14/15/16 を ENV-DEC-012..014 として統合 |
| — | BASELINE.md / PACK_MANIFEST.yaml | 承認済み delta の記録、統計更新（113 tasks / 64 gates） |
| — | 10_wbs_task_summary.md / SHA256SUMS | 再生成 |
| PACK-IMPORT-006 | 10_adrs/0028-no-cloudflare-artifacts-azure.md / SHA256SUMS | ADR-0029（Owner 再裁定 AWS、PR #160）による Azure 維持条項の一部 supersession 注記を Status へ追記、当該行の SHA256 更新 |
| P0-T07a | 06_implementation/02_wbs.yaml / docs/security/2026-08-10-secret-identity-migration-plan.md / SHA256SUMS | ENV-DEC-001 / ADR-0029 の実装帰結として P3-T01 を Fargate セルフホスト構成へ改訂し、P0-T09 資格マトリクスと pack 内 Azure 固有語を下表の AWS 等価へ読み替え |
| P2-ENTRY | 06_implementation/02_wbs.yaml / SHA256SUMS | Owner 裁定（LiteLLM enterprise 同梱受容・無効化拘束、2026-08-12）を binding にするため P2-T02 の acceptance/verification へ enterprise 無効・telemetry off の証明を追加 |
| P2-T02-PRE | 06_implementation/02_wbs.yaml / 06_implementation/07_file_by_file_change_plan.md / 06_implementation/10_wbs_task_summary.md / 01_current_state/03_repository_change_map.md / 08_verification/02_acceptance_test_catalog.yaml / SHA256SUMS | P0-T07a 読み替え規則を binding フィールドへ実体化（2026-08-12）: allowed_paths の deploy/azure/** を deploy/aws/** へ（12 箇所）、P10 exit_intent と P10-T01 の title/deliverables/acceptance/verification を Terraform/AWS 等価へ、REL 系 environment を aws-staging / aws-dr へ、deploy ツリー記述（change plan / repository change map）を aws/ Terraform 構成へ修正。既存実資産 ops/azure-monitor-alerts/** は現存パスのため対象外。IaC 実装は引き続き P10-T01 の管轄 |

## P0-T07a: ADR-0029 AWS 読み替え規則

ENV-DEC-001、ADR-0029、WBS P3-T01、P0-T09 資格マトリクスの間では、pack 内の旧 Azure
固有語を次の AWS 等価として読む。Teams / Graph / Work IQ の Entra 資格は M365 アクセス専用で
維持し、AWS workload identity の代替には使わない。

| Pack 内の旧 Azure 記述 | ADR-0029 の AWS 等価 | 適用上の注記 |
| --- | --- | --- |
| Azure Container Apps (ACA) | Amazon ECS on Fargate | Temporal は単一サービス、Kubernetes なし |
| Azure Key Vault | AWS Secrets Manager (KMS) | staging / production 分離、IAM task role で解決 |
| Entra Workload ID / managed identity | IAM role / ECS task role | Entra は M365 専用資格としてのみ維持 |
| Bicep | Terraform | 全 AWS resource を immutable IaC とする |
| Azure Monitor / Log Analytics | CloudWatch + OTel Collector | logs / metrics / traces / alerts の正本 |
| Azure Front Door + WAF | CloudFront + WAF → ALB | ECS origin と RDS endpoint は非公開 |
| Azure Database for PostgreSQL | Amazon RDS for PostgreSQL | private subnet、PITR / cross-region snapshot |
| Azure Container Registry | Amazon ECR | SBOM / provenance 付き immutable digest |
