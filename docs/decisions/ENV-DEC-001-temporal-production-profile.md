<!-- 根拠: FinalArch:PRD-003 / FinalArch:FR-CP-001 / FinalArch:NFR-REL-001 / FinalArch:GOV-003 / ADR-0021 -->

# ENV-DEC-001: Temporal 実行プロファイルの決定（P0-T07）

- 決定 ID: ENV-DEC-001 / WBS: P0-T07（risk: high、acceptance gate: GOV-003）
- Writer: claude-code-fable5-xhigh / Reviewer: codex-gpt56-sol-high
- 状態: **裁定済み（案 B' 承認、2026-08-10）**

## 決定事項

制御プレーン（ADR-0021: durable workflow / retry / timer / approval / compensation）の
Temporal 実行形態を確定する。この決定は P3（shadow 移行）〜P10（cutover）の
実装トポロジ・credential 設計（P0-T09 マトリクスの Temporal 行）・費用構造を拘束する。

## 選択肢の比較

| 観点       | A: Temporal Cloud + ACA workers                                           | B: AKS セルフホスト                                  | C: 段階（dev は compose、本番形態は P3 末に再裁定） |
| ---------- | ------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| 運用負荷   | 最小（server/persistence/upgrade はマネージド）                           | 最大（クラスタ・Cassandra/PG・upgrade を自組織運用） | 小（dev のみ）だが本番裁定を先送り                  |
| 信頼性     | SLA あり（契約条件は P0-T06 台帳の Cloud 行に従い Legal レビュー要）      | 自組織の運用成熟度に依存。現状 P0 段階では過大       | dev 品質。P3 shadow の検証には十分                  |
| 費用       | 従量（Actions 単価は order で確定。P0-T05 baseline から初期は小規模）     | インフラ固定費 + 運用工数                            | dev VM のみ。最安だが再裁定コストが残る             |
| 契約/法務  | **P0-T06 STOP: Cloud order / DPA / region / SLA の Legal 承認が発効条件** | 不要（MIT。P0-T06 で確認済み）                       | dev は不要。本番選択時に該当条件が再適用            |
| credential | P0-T09: Cloud API key/mTLS を Key Vault、worker は namespace 限定         | P0-T09: AKS workload identity + mTLS                 | dev は self-contained。本番行は裁定後に確定         |
| 撤退容易性 | namespace export + worker は形態非依存（SDK 同一）                        | 同左                                                 | 同左（SDK レベルの互換が担保）                      |

## Owner 方針の記録（2026-08-10）

Owner は本件について**新たな有償契約（Temporal Cloud 等の SaaS 契約）を意図しない**方針を
表明した。パック既定案（09_owner_decision_register.md: Default proposal = Cloud + Azure
workers）はこの方針と衝突するため、既定案をそのまま採用しない。以下の推奨は
この方針を前提に書き直したものである。

## 推奨（Writer、Owner 方針反映後）

**案 B'（セルフホスト OSS・最小形）を本番プロファイルとして採用する。**
Temporal OSS（MIT・契約不要）を既存インフラ上の単一ノード構成（compose ベース、
永続化は既存 PostgreSQL の専用データベース）で運用し、AKS などの新規クラスタ基盤は
導入しない。理由:

1. **契約ゼロ**: Temporal server/SDK は MIT（P0-T06 台帳で blob SHA 付き確認済み）。
   Cloud の order/DPA/region/SLA という Legal STOP 項目が本番経路から消え、
   P0-T06 の残作業も縮小する
2. **新規インフラ費ゼロ**: 既存の実行環境と既存 PostgreSQL を使う。AKS（案 B 原案）は
   クラスタ運用負荷と費用が現段階の規模に対して過大であり不採用
3. **規模適合**: 現ワークロード（in-process scheduler が回している定期タスク群 +
   承認フロー）の量に対し、単一ノード Temporal + PG 永続化は十分。可用性は
   「daemon 再起動で workflow が resume する」という Temporal の durable 実行そのもので
   現行 in-process scheduler より改善する
4. **撤退・昇格の容易性**: worker 実装は SDK レベルで形態非依存。将来規模が
   単一ノードの限界に達した時点で、クラスタ化や Cloud 移行を**その時の裁定**として
   再検討できる（実装の手戻りなし）

**制約の明示（NFR-REL-001 との整合）**: 単一ノード構成は HA クラスタではない。
受容できる理由: (a) 現行の in-process scheduler も単一障害点であり、durable 化は
純改善である、(b) PG 永続化 + 既存バックアップ運用で状態は保全される、
(c) P9 の監視帯で Temporal liveness を alert 対象に加える。
この受容は P3 の shadow 検証と P10 の cutover ゲートで実測により再確認する。

## 実装帰結（裁定後に有効化）

- P3-T01: Temporal Cloud namespace 発行を**廃し**、deploy/temporal/ の compose 構成
  （server + UI + 既存 PostgreSQL への専用 DB）+ 起動 runbook に差し替える（WBS 追補）
- P0-T09 マトリクス Temporal 行: Cloud API key 行を「self-host: サーバ内部接続 +
  mTLS はローカル網内不要、外部公開なし」へ改訂（P0-T09 追補として同 PR で処理可）
- `control.temporal.enabled` flag: dev で `shadow` 開始。`primary` は
  `control.legacy_scheduler.enabled=false` の明示が必須（P0-T08 実装済み・E-FLAG03）
- 将来 Cloud/クラスタ化を検討する場合は新 ENV-DEC として起票する（本判定の再解釈で
  有償契約を導入しない）

## 判定

- 判定（Owner 記入欄）: **案 B' 承認**（セルフホスト OSS 最小形: 単一ノード compose + 既存 PostgreSQL 永続化。有償契約なし・Kubernetes なし）
- 日付: 2026-08-10
- 備考: Owner 発言（セッション記録）「有償契約は意図していない」「Kubernetes まで大掛かりなことをする必要がない」「案B' 承認」に基づく。パック既定案（Cloud + Azure workers）は不採用と確定。後続追補: (1) P3-T01 を compose 構成 + 起動 runbook へ差し替える WBS 追補、(2) P0-T09 マトリクス Temporal 行の self-host 改訂。いずれも P0-T10 前の chore タスクで処理する
