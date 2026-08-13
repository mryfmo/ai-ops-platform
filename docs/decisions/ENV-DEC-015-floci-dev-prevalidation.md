<!-- 根拠: DEV-T01 / ADR-0029 / FinalArch:GOV-004 -->

# ENV-DEC-015: Floci は dev-only Terraform 事前検証に限定する

- 決定 ID: ENV-DEC-015 / Task: DEV-T01
- 状態: **採用（dev-only、2026-08-13 Owner 指示）**
- 対象: `deploy/aws/temporal/` と、将来明示的に追加される AWS Terraform module

## 決定

実 AWS development environment の準備前に Terraform の provider 配線、resource
graph、task definition、Secrets Manager、Cloud Map などの早期不整合を見つける補助として
Floci を使用する。Floci `1.6.0`（MIT）の公式 OCI index digest を固定し、全サービスを
loopback `127.0.0.1:4566` に向け、資格情報は固定 dummy 値だけを許可する。

本番 module には provider override を読み込ませない。`.tf.example` を一時 copy でだけ
有効化し、production `main.tf` / `variables.tf` / state / provider behavior を変えない。
実 AWS profile、session/role credential、service-specific endpoint、非 loopback endpoint
が存在すれば、Docker や Terraform を起動する前に停止する。

## 境界

| 項目                                                   | 判定                                                     |
| ------------------------------------------------------ | -------------------------------------------------------- |
| ローカル Terraform init/validate/plan                  | 補助的に使用可                                           |
| task definition / secrets / Cloud Map の bounded apply | 明示 opt-in 後、Floci 内だけで使用可                     |
| CI gate・受入証跡・staging/prod 判断                   | **使用禁止**                                             |
| 実 AWS credential / endpoint                           | **使用禁止**                                             |
| SG/IAM/mTLS、Fargate network、RDS durability の証明    | 対象外。実 AWS 検証を置換しない                          |
| Bedrock Runtime                                        | stub。P2-T03/T04/T10 の実 gateway/model 証跡を置換しない |

Floci の ECS/RDS は Docker socket を使用する。本開発機の Apple `container` CLI は
Docker Compose/socket の代替ではないため、Colima 等の導入・起動は Owner 操作とする。
自動インストールは行わず、runtime または network がなければ検証結果を明示的に
`SKIP` と記録する。

## 運用と再評価

- image version と digest は同一 PR で更新し、公式 release・registry manifest・MIT
  license を再確認する。
- Floci の結果だけで AWS rollout、Temporal cutover、model acceptance を進めない。
- rollback は dev-only directory、override example、本決定 note の削除であり、production
  Terraform の rollback は発生しない。
- 実 AWS development environment が利用可能になっても、本チェックは任意の早期 lint
  としてのみ残し、正規の staging/prod gate は ADR-0029 と各 WBS acceptance に従う。
