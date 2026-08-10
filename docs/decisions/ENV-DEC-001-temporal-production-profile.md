<!-- 根拠: FinalArch:PRD-003 / FinalArch:FR-CP-001 / FinalArch:NFR-REL-001 / FinalArch:GOV-003 / ADR-0021 -->

# ENV-DEC-001: Temporal 実行プロファイルの決定（P0-T07）

- 決定 ID: ENV-DEC-001 / WBS: P0-T07（risk: high、acceptance gate: GOV-003）
- Writer: claude-code-fable5-xhigh / Reviewer: codex-gpt56-sol-high
- 状態: **Owner 裁定待ち**（本書の判定欄が空欄の間、Temporal への実装着手・契約・
  本番設定は一切行わない）

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

## 推奨（Writer）

**案 A（Temporal Cloud + ACA workers）を本番プロファイルとして採用**し、同時に
dev/staging は compose ベースの使い捨て構成を P3 shadow 検証に用いる。理由:

1. 現組織の運用成熟度で 24/7 の stateful クラスタ自主運用（案 B）は
   NFR-REL-001 の達成手段として過大リスク
2. worker 実装は SDK レベルで形態非依存のため、案 A 採用後も撤退・変更が可能
3. 発効条件（Cloud order/DPA/region の Legal 承認 = P0-T06 STOP 項目）が
   明示されており、契約前に実装が先行しても手戻りは dev 構成に閉じる

**発効条件**: 本判定「承認（案 A）」は、P0-T06 台帳の Temporal 行 STOP
（order / DPA / region / SLA の Legal 承認）が完了するまで**本番接続を許可しない**。
それまでに許可されるのは dev/staging compose 構成と worker 実装のみ。

## 実装帰結（裁定後に有効化）

- P3-T01: Temporal Cloud namespace 発行 + Key Vault 登録（P0-T09 マトリクス Temporal 行）
- deploy/temporal/: dev compose 構成（本 PR には含めない。P3 帯タスクで追加）
- `control.temporal.enabled` flag: dev で `shadow` 開始。`primary` は
  `control.legacy_scheduler.enabled=false` の明示が必須（P0-T08 実装済み・E-FLAG03）
- 案 A 不承認・案 C 選択の場合: P3 末の再裁定タスクを WBS へ追補し、
  P0-T10 は「本番形態未確定」の条件付き完了として記録する

## 判定

- 判定（Owner 記入欄）: ＿＿＿＿（案 A 承認 / 案 B 承認 / 案 C 承認 / 差戻し）
- 日付: ＿＿＿＿
- 備考: ＿＿＿＿
