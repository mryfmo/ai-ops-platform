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

## server 側認可（内部発行 JWT — Owner 裁定 2026-08-13）

- mTLS は transport 層の identity。**認可は Temporal 標準の authorizer/claim mapper
  （default）が、プラットフォーム内部発行の RS256 JWT で server 側強制する**
  （Entra / 外部 IdP は不関与 — Entra は M365 専用のまま。ENV-DEC-001 改訂）
- 資材: `./authz/gen-authz.sh <env>`（署名鍵 + JWKS。配信面は `out/<env>/public/` のみ —
  署名鍵は配信されない）。JWKS は dev では nginx sidecar、Fargate では同一タスク内
  sidecar が `http://…/jwks.json` で server に供給する
- トークン発行: `node authz/mint-token.mjs <env> worker <name>`（`aiops-<env>:write` のみ・
  非 admin）/ `... operator <name>`（admin。運用者別 identity）。既定 TTL 12h
- **強制粒度**: environment = per-env CA（TLS 拒否）、namespace + 非 admin = JWT
  authorizer（server 拒否）、task queue = worker 構成 + `@aiops/control-plane` の
  接続前 guard（Temporal の認可モデルに queue 粒度は存在しないため — Owner 裁定で
  この分担を確定）
- authorizer 有効時は auto-setup の namespace 自動登録を SKIP し、operator token で
  `registerNamespace` する（smoke-client / 本 runbook の初期化手順）

## dev 起動（docker compose）

```bash
./deploy/temporal/certs/gen-certs.sh dev
./deploy/temporal/authz/gen-authz.sh dev   # 署名鍵 + JWKS（authorizer の必須入力）
docker compose -f deploy/temporal/docker-compose.yml up -d
# authorizer 有効のため namespace は operator token で登録する:
#   TOKEN=$(node deploy/temporal/authz/mint-token.mjs dev operator ops1)
#   （smoke-client の registerNamespace と同処理。dev は smoke.sh が一括実行）
```

## dev 起動（Apple container CLI — この開発機の標準）

```bash
./deploy/temporal/certs/gen-certs.sh dev
./deploy/temporal/smoke.sh          # 起動 + 接続/拒否検証 + 破棄まで一括
KEEP=1 ./deploy/temporal/smoke.sh   # 検証後も起動したままにする
```

## namespace / task queue 初期化

- authorizer 有効のため namespace は operator identity（admin JWT + operator cert）で
  登録する（retention 既定 3 日）。dev では smoke が `aiops-dev` / `aiops-shadow` を初期化
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

## staging / prod bootstrap（Terraform apply 後の初期投入）

1. 資材生成: `certs/gen-certs.sh <env>`（`SERVER_SAN` を Cloud Map 名に合わせ上書き:
   `DNS:aiops-temporal-frontend.<env>,DNS:temporal.<env>.aiops.internal`）+
   `authz/gen-authz.sh <env>`
2. Secrets Manager へ投入（`aws secretsmanager put-secret-value`）:
   `aiops-temporal-<env>/tls/{ca,server-cert,server-key,worker-cert,worker-key,operator-cert,operator-key}`、
   `aiops-temporal-<env>/authz/{jwt-signing-key,jwks}`、`.../db-password`
3. image: ADR-0029 に従い temporal / jwks sidecar image を **ECR へミラー**し
   digest pin で `temporal_image` / `jwks_sidecar_image` に渡す（Terraform が
   ECR + digest 形式を validation で強制）
4. RDS に `temporal` / `temporal_visibility` DB と `temporal` role を作成
   （schema は auto-setup が初期化）
5. namespace 初期化: operator token（`mint-token.mjs <env> operator <name>`）で
   `registerNamespace`（実行主体は運用者。worker token では拒否される）
6. worker token 発行・配布: `mint-token.mjs <env> worker <name>`（TTL 12h）を
   運用 pipeline で定期 mint し Secrets Manager の worker-token へ格納。
   署名鍵は worker に配布しない

## 障害時

- 単一レプリカのため server 再起動 = 短時間の停止。workflow は Temporal の永続化により
  再開する（再開検証は P3 shadow 帯の受入 — ENV-DEC-001 の表）
- DB リストアは RDS PITR（staging/prod）。dev は破棄・再作成を基本とする
