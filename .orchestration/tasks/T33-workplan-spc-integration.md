# T33: 実行計画への SPC 所見統合と陳腐化値の訂正

## 目的

T32(仕様内容監査、受入済)の成果を T31 の実行計画に統合し、計画を「50 所見に対して完全」から「76 所見(PRG 50 + SPC 26)に対して完全」へ引き上げる。同時に、T31 成果物に残る陳腐化した数値を訂正する。

これは T31 が自ら定義した「T32 受入後のカバレッジ拡張手順」(`remediation_workplan.md` の該当節)の実行である。その手順に従うこと。

## 入力(受入済・改変禁止)

- `.orchestration/audit/production_readiness_gap_audit.md`(PRG-001〜050)
- `.orchestration/audit/specification_content_audit.md`(SPC-001〜026)
- `.orchestration/audit/spec_reconstruction.md`(264 件)
- `.orchestration/acceptance/T31.acceptance.md`、`T32.acceptance.md`

## 作業 1: 陳腐化値の訂正

以下 4 ファイルに残る旧値を、T32 の確定値へ訂正する:

- 対象: `.orchestration/plan/remediation_workplan.md`、`.orchestration/plan/remediation_phases.md`、`.orchestration/reports/T31-report.md`、`.orchestration/validation/T31-validation.txt`
- 訂正内容: 「32 defined / 263 undefined」→ **「カタログ定義行 32 / 索引済み定義 31 / 未定義 264(89.5%)」**。DevOps の REQ 欠番 17 件(004〜009、013、014、032〜040)を追記し、欠番は計 25 件とする。孤児定義(DevOps `REQ-032`)に言及する
- 訂正箇所は全て grep で洗い、残存ゼロを検証すること

## 作業 2: SPC 所見のタスク化

SPC-001〜026 を `TASK-SPC001`〜`TASK-SPC026` として `remediation_workplan.md` に追加する。**T31 と同一のスキーマ 13 項目を全項目埋めること**(対応所見 / 観点 / 現状 / 精査で判明した欠陥 / 改善 / 許可ファイル / 禁止事項 / 前提・停止条件 / 完了条件チェックボックス / 検証手順(verified-integration と requires-real-env の区分 + 偽装禁止)/ 証跡置き場 / 依存 / 仕様トレース / ステータス)。

設計判断が要る箇所は選択肢を列挙して推奨を 1 つ決め切ること(「ワーカーが適切に判断」は禁止句)。

**重要な依存関係の明示**:

- SPC-022〜026 は T30 の実装所見(PRG-041/042/044/047/048)の**根本原因**である。各 TASK-SPC は対応する TASK-PRG の**前提**として `依存` に現れなければならない(仕様を直さずに実装だけ直すと再発するため)。逆向き(TASK-PRG が TASK-SPC に先行)は禁止
- SPC-024(レポートスキーマの provenance 欠落)は `TASK-PRG044` の前提
- 正典喪失系(SPC-001 系、復元不能 64 件)は `TASK-PRG023` に統合し、二重管理しない

## 作業 3: カバレッジ表とフェーズ計画の再生成

- カバレッジ表を **PRG-001〜050 + SPC-001〜026 = 76 所見**に拡張し、見出しから「SPC 未反映」の限定文言を削除する。漏れゼロを表で証明する
- フェーズ計画 `remediation_phases.md` に TASK-SPC を配置する。SPC の多くは正典・仕様の確立であり、GATE-0(Decision Baseline)または GATE-1 に属するはずである。実装 TASK-PRG より後ろに置いてはならないものを特定し、ゲート所属を根拠付きで決める
- 各ゲートの完了チェックリストを更新する

## 制約

- `.orchestration/` 配下のみ書き込み可。**製品コード・docs・仕様・スキーマの変更禁止**
- forbidden_actions: code-edits、push、merge、dependency-changes、real-llm-calls、git-checkout/reset、**監査正本(production_readiness_gap_audit.md / specification_content_audit.md / spec_reconstruction.md)の所見内容の改変**
- 受入済み acceptance ファイルの改変禁止
- 数値は T32 の確定値のみを使う。独自集計で新しい数値を作らない(必要なら `node .orchestration/validation/T32-analyze.mjs` で再生成し、差異が出たら AGMSG-NOTE で照会する)

## revise 第 1 巡(orchestrator 検証)

作業 1・2・3 の大半は達成されている(旧値の残存ゼロ、TASK-SPC 26 件でスキーマ 13 項目全埋め、TBD ゼロ、カバレッジ 76 行、フェーズに TASK-SPC 26 件配置、dangling 依存ゼロ、そして最重要の **SPC-022〜026 が対応 TASK-PRG の依存に前提として現れ、逆向きの辺は 1 本も無い**)。

しかし依存グラフに**循環が 2 件**あり、当該タスクは永久に着手不能である。

**MUST 1(循環の解消)**

```
TASK-PRG005 依存: TASK-PRG004, TASK-PRG048
TASK-PRG048 依存: TASK-PRG005, TASK-PRG023, TASK-PRG043, TASK-SPC026   ← PRG005 ⇄ PRG048

TASK-PRG027 依存: ..., TASK-PRG049
TASK-PRG049 依存: TASK-PRG003, TASK-PRG017, TASK-PRG027                ← PRG027 ⇄ PRG049
```

両者を**真の前提関係**に基づいて一方向に直すこと。決め打ちで辺を消すのではなく、どちらが他方の成果物を実際に必要とするかを根拠付きで判定し、`前提/停止条件` の文言も整合させる。

判定の手掛かり(そのまま採用してよいが、反証してもよい。結論の根拠を書くこと):

- PRG-048(監査主体へ不変の個人 ID を伝播)が必要とするのは `raw.authorAadId` であり、これは既に受信済みで PRG-005 の成果物に依存しない。一方 PRG-005(本番 stakeholder provider への差し替え)は、認可判断に個人 ID を使うなら PRG-048 の伝播経路を前提としうる。少なくとも**相互依存ではない**
- PRG-027(本番組成・コンテナ・hosted workflow のテスト)は、コンテナをビルド・起動して検証する。PRG-049(non-root 最小化)は**その CI 基盤を前提とする**。逆に PRG-027 がハードニング済みイメージを前提とする必然性はない

**MUST 2(検証の欠落 — 自己検証スクリプトの穴)**

T33 の validation は「全 assertion pass」と報告したが、**非循環性(DAG)を検査していなかった**ため、この 2 件を見逃した。以下を検査する検証スクリプトを `.orchestration/validation/T33-validate.mjs` として作成し、実行出力を validation ファイルへ記録すること:

- [ ] 依存グラフが DAG(循環ゼロ)。循環があれば経路を出力して非ゼロ終了
- [ ] dangling 依存ゼロ(存在しない TASK-ID を参照しない)
- [ ] タスク総数 76、カバレッジ表 76 行、PRG/SPC の対応に漏れ・重複なし
- [ ] スキーマ 13 項目が 76/76 タスクで全て存在
- [ ] `TBD` / `未定` / 「適切に判断」の禁止句がゼロ(as-is 記述としての「未定」は許容 — その場合は行単位で許可リスト化して根拠を書く)
- [ ] SPC-022〜026 が対応 TASK-PRG(041/042/044/047/048)の依存に含まれ、かつ TASK-SPC から TASK-PRG への逆辺がゼロ
- [ ] 陳腐化値(`263`、`32 defined`)の残存ゼロ

**SHOULD**

- 依存グラフのトポロジカル順序(実行可能な直列順)を計画末尾に出力し、フェーズ割当と矛盾しないことを確認せよ。矛盾があればフェーズ側を直す

## 完了条件

- [ ] 作業 1: 4 ファイルの旧値がゼロ(grep で証明。証跡を validation へ)
- [ ] 作業 2: TASK-SPC001〜026 がスキーマ 13 項目全埋め、TBD・空欄・「適切に判断」ゼロ
- [ ] SPC-022〜026 が対応する TASK-PRG(041/042/044/047/048)の依存に前提として現れている
- [ ] 作業 3: カバレッジ表 76 行、限定文言削除、フェーズ計画に全 TASK-SPC 配置とゲート根拠
- [ ] AGMSG-RESULT v1 送信(成果物パスを全て含める)
