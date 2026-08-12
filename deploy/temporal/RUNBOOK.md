# Temporal 起動 runbook（P3-T01）

根拠: FinalArch:TMP-001 / ADR-0021 / ADR-0029 / ENV-DEC-001（案 B'）

## 構成の全体像

- dev: `deploy/temporal/docker-compose.yml`（単一ノード。**本番形態ではない**）
- staging/prod: `deploy/aws/temporal/`（ECS Fargate 単一サービス + RDS 追加 DB
  `temporal` / `temporal_visibility`。apply は AWS baseline / ENV gate 整備後）
- namespace は環境単位: `aiops-dev` / `aiops-staging` / `aiops-prod`
- task queue は正典 workflow kind と 1:1（`@aiops/control-plane` の `WORKFLOW_KINDS`）

## mTLS identity（ENV-DEC-001）

| identity | CN                              | 用途                                                          |
| -------- | ------------------------------- | ------------------------------------------------------------- |
| CA       | `aiops-temporal-ca.<env>`       | 環境スコープの server 側強制点（越境 cert は handshake 拒否） |
| server   | `aiops-temporal-frontend.<env>` | frontend TLS                                                  |
| worker   | `aiops-temporal-worker.<env>`   | 非 admin。workflow/activity 実行のみ                          |
| operator | `aiops-temporal-operator.<env>` | admin 操作（namespace 管理・operator API）専用の別 identity   |

- 発行/ローテーション: `./certs/gen-certs.sh <env>`（既定 90 日。`CERT_DAYS` で変更）。
  ローテーションは新証明書発行 → Secrets Manager 更新（staging/prod）または
  `certs/out/<env>` 差し替え（dev）→ server/worker 再起動、の順。CA ローテーションは
  新旧 CA の重複期間を設けず環境単位で一斉切替（単一レプリカのため停止を伴う —
  ENV-DEC-001 の可用性受入と同枠で計画する）
- 証明書実体は git 管理外（`certs/out/` は gitignore。staging/prod は Secrets Manager
  `aiops-temporal-<env>/tls/*`）
- **既知の制約（P3 帯 follow-up）**: OSS Temporal の設定のみでは mTLS identity →
  claim（namespace / task queue / 非 admin）の server 側強制ができない
  （custom claim mapper = Go 拡張が必要）。現段階の担保は
  (1) per-env CA による環境スコープの server 強制、
  (2) `@aiops/control-plane` の接続前 fail-closed guard（E-TMP01）、
  (3) operator 資格の別 identity 運用。server 側 claim 強制（claim mapper 同梱の
  派生 image）は P3 帯の専用タスクとして起票する

## dev 起動（docker compose）

```bash
./deploy/temporal/certs/gen-certs.sh dev
docker compose -f deploy/temporal/docker-compose.yml up -d
```

## dev 起動（Apple container CLI — この開発機の標準）

```bash
./deploy/temporal/certs/gen-certs.sh dev
./deploy/temporal/smoke.sh          # 起動 + 接続/拒否検証 + 破棄まで一括
KEEP=1 ./deploy/temporal/smoke.sh   # 検証後も起動したままにする
```

## namespace / task queue 初期化

- `DEFAULT_NAMESPACE=aiops-<env>` により auto-setup が namespace を作成する
  （retention 既定 3 日 — 変更は operator identity で
  `temporal operator namespace update`）
- task queue は worker が polling を開始した時点で自動作成されるため事前登録不要。
  queue 名は `WORKFLOW_KINDS`（meeting / coding-task / incident / report /
  plane-sync / graph-subscription / knowledge-publication）以外を使わない

## worker 接続（packages/control-plane）

```ts
import { buildConnectionProfile, createTemporalConnection } from "@aiops/control-plane";
const profile = buildConnectionProfile("dev", "127.0.0.1:7233");
const connection = await createTemporalConnection(profile, {
  clientCertPem,
  clientKeyPem,
  serverRootCaPem, // Secrets Manager / certs/out から注入
});
```

- 接続前に証明書 CN / issuer / 期限 / environment 整合が検証される（E-TMP01 fail-closed）
- worker identity は gRPC metadata `aiops-worker-identity` として送出（監査用）

## 障害時

- 単一レプリカのため server 再起動 = 短時間の停止。workflow は Temporal の永続化により
  再開する（再開検証は P3 shadow 帯の受入 — ENV-DEC-001 の表）
- DB リストアは RDS PITR（staging/prod）。dev は破棄・再作成を基本とする
