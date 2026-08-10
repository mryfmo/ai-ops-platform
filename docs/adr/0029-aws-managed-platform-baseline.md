# ADR-0029: AWS managed platform replaces Azure as the production baseline

## Status

Accepted — 2026-08-10（Owner 裁定。セッション記録「Azure ではなく AWS とする」。
ADR-0016 の再裁定条項「The owner approves a replacement ADR with equivalent identity,
private network, backup, DR, cost, and E2E evidence」に基づく置換）

## Context

ADR-0016（2026-07-13 受理）は本番基盤を Azure（Container Apps / PostgreSQL Flexible
Server / Key Vault / Front Door / Log Analytics）と定めた。Owner は 2026-08-10 の
ENV-DEC-001 裁定過程で、本番コンピュート基盤を AWS とする方針を裁定した。
実環境は未プロビジョニング（deploy workflow は未実装、E2E は ENV 保留）であり、
本置換はドキュメント・IaC 設計層で完結し、稼働中資産の移行を伴わない。

最終アーキテクチャ（ADR-0022）は LLM 推論を LiteLLM 経由の AWS Bedrock 既定と
定めており、本置換により推論と実行基盤が同一クラウドに揃う（egress・IAM 統合の簡素化）。

## Decision

ADR-0016 の各決定を AWS の等価物へ一対一で置換する。信頼性・分離・不変 IaC の
要求水準は維持する。

- server / web ランタイムは **Amazon ECS on Fargate**（サービス単位のマネージド
  コンテナ、クラスタ運用なし・Kubernetes なし）で運用する
- イメージは **Amazon ECR** に保存し、SBOM・provenance 付きの不変 digest をデプロイする
- データベースは **Amazon RDS for PostgreSQL**（private subnet、public アクセス不可）
- 秘密情報は **AWS Secrets Manager**（KMS 暗号化）から、staging / production で分離した
  **IAM ロール**（タスクロール）経由で解決する。ワークロード同一性は IAM が担う
- 公開エントリポイントは **CloudFront + WAF → ALB** のみ。ECS origin と RDS endpoint は
  公開しない
- ログ・メトリクス・トレース・アラートは **CloudWatch**（+ OTel Collector、ADR 系の
  OpenTelemetry 方針を維持）
- 全 AWS リソースは **Terraform** で定義する。コンソール手作業の本番リソースは
  構成ドリフトであり受入を満たさない
- リージョンは **ap-northeast-1（東京）を primary、ap-northeast-3（大阪）を DR** とする
- staging / production は最低限アカウント分離（AWS Organizations）または
  タグ・ロール・VPC・DB・シークレット・GitHub environment の完全分離
- リリースは immutable digest の段階トラフィック（smoke → 段階増加 → 100%）。
  ゲート不合格時は直前 digest へ戻す
- RDS 自動バックアップ 35 日、クロスリージョンスナップショットで長期保持
- 目標値は ADR-0016 から不変: same-region RPO ≤ 5 分 / RTO ≤ 60 分、
  regional-disaster RPO ≤ 60 分 / RTO ≤ 4 時間、月次可用性 99.9%

**Microsoft 連携の扱い**: Teams / Outlook / Graph / Work IQ は SaaS API として利用を
継続する。Entra アプリ登録・委任/OBO・Graph 資格は **M365 アクセス専用の SaaS 資格**
として残る（保管は Secrets Manager）。ワークロード同一性（コンピュート側）は IAM で
あり、Entra Workload ID は使用しない。

具体的なアカウント ID・リソース ID・DNS・証明書・SKU・予算・通知先は ENV 入力であり、
アーキテクチャ選択ではない。秘密としてコミットしない。

## Supersession

本 ADR は **ADR-0016 の全決定を置換**する（ADR-0016 は歴史的記録として残す）。
ADR-0003 / ADR-0005 の常駐サーバ・スケジューリング・Hono・Graph・権限の決定、
および ADR-0020〜0028 のアーキテクチャ方針は影響を受けない。ただし ADR-0020 系文書内の
Azure 固有記述（ACA / Key Vault / Entra Workload ID 等）は AWS 等価物へ読み替え、
正典追補タスク（P0-T07a）で明文化する。

## Alternatives rejected

| Alternative                                | Reason rejected now                                     | Reconsider only if                               |
| ------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------ |
| Azure 基盤の維持（ADR-0016）               | Owner 裁定（2026-08-10）により置換                      | Owner が再裁定する場合                           |
| マルチクラウド分割（Temporal のみ AWS 等） | 単一コンポーネントのための運用面・IAM・網の二重化は過大 | 特定コンポーネントが単一クラウドで成立しない場合 |
| セルフマネージド Kubernetes（EKS 含む）    | ADR-0016 と同じ理由。現ワークロードにクラスタ運用は不要 | Fargate が実測要件を満たせない場合               |

## Consequences

- P0-T09 credential マトリクスの Azure 前提行（Key Vault / Entra Workload ID / ACA）は
  AWS 等価（Secrets Manager / IAM ロール / Fargate）へ改訂する（P0-T07a）
- 最終アーキテクチャ pack 内の Azure 前提記述は読み替え規則を P0-T07a で追記する
- Bedrock（ADR-0022）とは同一クラウドとなり、STS フェデレーション（Azure→AWS）は
  不要になる。IAM ロールで直接 Bedrock を許可する
- AWS コストとサービス結合は受容されたトレードオフであり、予算・不変 IaC・
  リストア実証・置換 ADR 要求で統制する
- Bicep 前提の記述はすべて Terraform に読み替える

## References

- [ADR-0016](0016-azure-platform.md)（置換対象）
- [ADR-0021](0021-temporal-durable-control-plane.md) / [ADR-0022](0022-litellm-bedrock-anthropic.md)
- ENV-DEC-001 決定記録（docs/decisions/ENV-DEC-001-temporal-production-profile.md）
