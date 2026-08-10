<!-- 根拠: FinalArch:PRD-003 / FinalArch:FR-CP-001 / FinalArch:NFR-REL-001 / FinalArch:GOV-003 / ADR-0021 / ADR-0016 -->

# ENV-DEC-001: Temporal 実行プロファイルの決定（P0-T07）

- 決定 ID: ENV-DEC-001 / WBS: P0-T07（risk: high、acceptance gate: GOV-003）
- Writer: claude-code-fable5-xhigh / Reviewer: codex-gpt56-sol-high
- 状態: **方向裁定済み（案 B'、Owner、2026-08-10）。実装ゲートは下記承認表の
  残項目が埋まるまで pending**

## 決定事項

制御プレーン（ADR-0021: durable workflow / retry / timer / approval / compensation）の
Temporal 実行形態を確定する。この決定は P3（shadow 移行）〜P10（cutover）の
実装トポロジ・credential 設計（P0-T09 マトリクスの Temporal 行）・費用構造を拘束する。

## Owner 方針の記録（2026-08-10）

Owner は本件について**新たな有償契約（Temporal Cloud 等の SaaS 契約）を意図せず**、
**Kubernetes 級の基盤新設も不要**との方針を表明し、「案 B' 承認」と裁定した。
パック既定案（09_owner_decision_register.md: Default proposal = Cloud + Azure
workers）はこの方針と衝突するため不採用と確定する。

## 選択肢の比較

| 観点           | A: Temporal Cloud + ACA workers | B: AKS セルフホスト | B': セルフホスト OSS 最小形（採用）            | C: 段階（本番裁定を P3 末へ先送り） |
| -------------- | ------------------------------- | ------------------- | ---------------------------------------------- | ----------------------------------- |
| 契約           | 有償 order 必要（P0-T06 STOP）  | 不要（MIT）         | **不要（MIT、P0-T06 で確認済み）**             | 不要                                |
| 新規基盤       | ACA 従量（Cloud 分離）          | AKS クラスタ新設    | **なし（ADR-0016 の既存 Azure 基盤に載せる）** | なし（dev のみ）                    |
| 運用負荷       | 最小                            | 最大                | 小（コンテナ 1〜2 + DB 1 個の増分）            | 小だが決定負債が残る                |
| 本番形態の確定 | 今                              | 今                  | **今**                                         | P3 末へ先送り（受入条件と衝突）     |

## 案 B' の本番プロファイル（正確な定義）

**ADR-0016 の受理済み本番基盤の内側で Temporal OSS を単一レプリカ運用する。**
ADR-0016 の例外条項（VM/Docker ホスト）は使用しない。新規クラウド契約・Kubernetes・
新種のインフラは導入しない。

| 要素             | 確定内容                                                                                                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 本番コンピュート | **Azure Container Apps（ADR-0016 の受理済みベースライン）上の Temporal server 単一レプリカコンテナ**（internal TCP ingress、gRPC 7233、外部非公開）。Web UI は別コンテナ（internal HTTP、運用者のみ） |
| 永続化           | **既存の Azure Database for PostgreSQL Flexible Server に専用データベースを追加**（temporal / temporal_visibility）。新 DB 製品（Cassandra/Elasticsearch）は導入しない                                |
| dev/staging      | docker-compose 単一ノード（正典 runtime 文書どおり compose はローカル/開発専用。**本番形態ではない**）                                                                                                |
| worker           | 既存パッケージ内の Node プロセス（Temporal SDK）。実行面は ADR-0016 の ACA 上の既存 server/worker 面                                                                                                  |
| IaC              | ADR-0016 に従い Bicep 定義（P3 帯で追加）。Portal 手作業は構成ドリフトとして不受理                                                                                                                    |
| 運用責任         | ADR-0016 の既存運用境界に従う（patching/HA/秘密配布/rollout/backup/監視は Azure マネージド面 + 既存運用。新たな Owner 負担受容は不要）                                                                |

## worker 認証（P0-T09 マトリクス・P3-T01 の信頼境界を維持）

ネットワーク分離は**追加統制であり、唯一の同一性統制にしない**。

- Temporal frontend で **mTLS を有効化**する。CA・server 証明書・worker クライアント
  証明書は Key Vault 管理（P0-T09 の Key Vault 原則どおり）。dev compose も同一構成を
  既定とする（信頼境界の dev/本番乖離を作らない）
- worker ごとに個別クライアント証明書 identity を発行し、Temporal authorizer/claim
  mapper で **environment + namespace + task-queue スコープの非 admin 権限**に制限する。
  admin 操作（namespace 管理・operator API）は運用者の別 identity のみ
- P0-T09 マトリクス Temporal 行の要求（one-environment/namespace/task-queue、worker に
  admin なし）はこの構成でそのまま満たす。行の記載自体は P0-T07a（下記）で
  self-host 前提へ改訂する

## 信頼性受入（測定可能な合否と停止規則）

単一レプリカは HA クラスタではない。受容の前提と検証:

| 検証                                         | フェーズ           | 合否基準                                                                                                                | 証跡責任                       |
| -------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| server/worker 強制再起動からの workflow 再開 | P3 shadow          | 実行中 workflow が再開し、**副作用の重複実行ゼロ**（idempotency 検証を含む）                                            | P3-T01 実装タスクの validation |
| PostgreSQL リストア演習                      | P3                 | Temporal DB を PITR から復元し workflow 状態が整合（**restore 証跡必須** — バックアップ設定のみでは不合格）             | P3 帯検証タスク                |
| RPO/RTO                                      | P3/P10             | ADR-0016 目標を適用: same-region RPO ≤ 5 分 / RTO ≤ 60 分（PG Flexible Server PITR + ACA 再デプロイで達成見込みを実測） | P10 cutover ゲート             |
| 可用性                                       | P3 shadow ≥ 2 週間 | shadow 期間の Temporal 実効可用性を計測し、99.9%（NFR-REL-005/ADR-0016）に対する達成度と欠損理由を記録                  | P9 監視帯 + P10 ゲート         |
| アラート                                     | P9                 | Temporal liveness / workflow 失敗率 / DB 接続を既存 alert 集合へ追加し発報試験                                          | P9-T08                         |

**停止規則**: 上記のいずれかが不合格の間、`control.temporal.enabled` は `limited` 以下に
留め、cutover（`primary` + `legacy_scheduler=false`）を実施しない。目標未達のまま進める
場合は Owner の明示例外（本台帳への追記）を必須とする。

## 実装帰結と正典追補（担当・期限を確定）

- **P0-T07a（正典追補 chore、P0-T10 の前提）**: Writer = codex-gpt56-sol-high /
  Reviewer = claude-code-fable5-xhigh / depends_on = P0-T07 / allowed_paths =
  `docs/plans/2026-08-final-architecture/06_implementation/02_wbs.yaml`（P3-T01 行）,
  `docs/security/2026-08-10-secret-identity-migration-plan.md`（Temporal 行）。
  受入条件: (1) P3-T01 の deliverable を「Cloud namespace 発行」から「ACA 単一レプリカ
  Bicep + dev compose + mTLS worker 認証 + 起動 runbook」へ差し替え、(2) P0-T09
  マトリクス Temporal 行を self-host（Key Vault 管理の CA/証明書、admin 分離）へ改訂、
  (3) 双方の文書間矛盾ゼロ
- `control.temporal.enabled` flag: dev で `shadow` 開始。`primary` は
  `control.legacy_scheduler.enabled=false` の明示が必須（P0-T08 実装済み・E-FLAG03）
- 将来 Cloud/クラスタ化を検討する場合は新 ENV-DEC として起票する（本判定の再解釈で
  有償契約を導入しない）

## 承認表（正典 register の必須承認者）

ENV-DEC-001 の正典必須承認者は Owner / Security / Ops / Procurement
（09_owner_decision_register.md）。

| 役割                         | 状態                                                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Owner                        | **承認（案 B'、2026-08-10、セッション記録:「有償契約は意図していない」「Kubernetes まで大掛かりなことをする必要がない」「案B' 承認」）** |
| Security / Ops / Procurement | **pending** — 本環境の役割保持者確認待ち。Owner が全役割を兼任する場合はその旨の明示記録をもって充足とする（推定はしない）               |

**実装ゲート**: 承認表が完了するまで、Temporal 実装タスクは着手しない
（P0-T07a の文書追補のみ先行可）。

## 判定

- 判定（Owner 記入欄）: **案 B' 承認**（セルフホスト OSS 最小形。本番 = ADR-0016 準拠の
  ACA 単一レプリカ + 既存 Azure PostgreSQL 専用 DB。有償契約なし・Kubernetes なし）
- 日付: 2026-08-10
- 備考: 本番コンピュートの ACA 特定（ADR-0016 整合）と承認表の残役割（兼任の明示）は
  Owner の追確認 1 件で完了する。確認取得まで実装ゲートは pending
