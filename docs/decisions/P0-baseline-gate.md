<!-- 根拠: FinalArch:GOV-001 / FinalArch:GOV-002 / FinalArch:GOV-003 / FinalArch:GOV-004 / FinalArch:GOV-005 / ADR-0029 -->

# Phase-0 Baseline Gate（P0-T10）

- WBS: P0-T10（risk: critical）/ Writer: claude-code-fable5-xhigh / Reviewer: codex-gpt56-sol-high
- 判定対象: 最終アーキテクチャ WBS の Phase P0「Baseline and governance」の exit
- 正典: `docs/plans/2026-08-final-architecture/06_implementation/03_phase_acceptance.md`（P0 行）、
  `08_verification/02_acceptance_test_catalog.yaml`（GOV-001〜005）

## 1. P0 タスク完了台帳（10/10 + 追補）

| タスク                                      | PR   | merge commit | 主要証跡                                                                            |
| ------------------------------------------- | ---- | ------------ | ----------------------------------------------------------------------------------- |
| （取込）pack 正本化 + 承認済み delta        | #152 | `1f8e12c`    | `docs/plans/2026-08-final-architecture/`、IMPORT_NOTES、PACK-IMPORT-REVIEW/REREVIEW |
| P0-T01 baseline 再検証                      | #153 | `e41e6e6`    | fresh disposable DB `mise run ci` exit 0、baseline 分類                             |
| P0-T02 branch protection                    | #165 | `92ce8aa`    | ruleset 20678089 active、負証明 5+2 件、`runbooks/production-gates.md` Evidence     |
| P0-T03 FinalArch traceability 統合          | #154 | `192889a`    | 5 族 ID(PRD/FR/NFR/INV/GATE)が `mise run traceability` で毎 CI 検証                 |
| P0-T04 fitness checks                       | #158 | `ac83e7e`    | `mise run governance`（INV 20 行マトリクス、fail-closed scanner）                   |
| P0-T05 性能 baseline                        | #155 | `7304597`    | `verification/` 性能 baseline 記録                                                  |
| P0-T06 ライセンス台帳                       | #157 | `af28bbe`    | `docs/security/2026-08-10-license-service-review-register.md`                       |
| P0-T07 Temporal プロファイル（ENV-DEC-001） | #160 | `8b42a88`    | 案 B' + ADR-0029(AWS)。3 ラウンド独立レビュー（所見 001〜012）                      |
| P0-T07a 正典追補（AWS 読み替え）            | #164 | `e0dde07`    | P3-T01 改訂、P0-T09 マトリクス AWS 化、読み替え表、SHA256SUMS 全行 OK               |
| P0-T08 feature flag / kill-switch 契約      | #156 | `f179156`    | 正本 YAML 完全鏡 + fail-closed（E-FLAG03 等）                                       |
| P0-T09 secret/identity 移行計画             | #159 | `c8d891a`    | credential マトリクス + break-glass（P0-T08 flag 文法準拠）                         |

補助: evidence 同期 #163（`eb4ebf9`）、dependabot #133（`6089d76`、App token merge）、
本ゲート文書 #168（`f89541b`、初版）+ 前提修正 #169（`b1be788`）+ 本改訂 PR（P0-T10b）。
#152〜#165 の各タスクは「Codex/Claude の相互独立レビュー → 全スレッド解決 →
exact-head checks green → squash merge → main CI green」のゲートを通過。
**例外は #168 と #169 で、§5 に逸脱として記録**し、本改訂 PR の exact-head 最終レビューを
補償ゲートとする。P0-T02 merge（`92ce8aa`）以降、ruleset はレビュー統制（§4 の
実強制内容を参照）をプラットフォーム強制し、AI の App token push/PR 作成は
プロジェクト運用規約（ruleset 強制ではない）として併用する。

## 2. Acceptance gates（GOV-001〜005）

| Gate    | 内容                                                    | 判定                      | 証跡                                                                                                                                                                                                                                                                                                     |
| ------- | ------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GOV-001 | Baseline and delta approved                             | **PASS**                  | #152（承認済み baseline-delta 適用、`IMPORT_NOTES.md` 正本）+ #153（fresh DB `mise run ci` exit 0）。Owner 承認はセッション記録 + PR merge                                                                                                                                                               |
| GOV-002 | Main branch protection effective                        | **PASS**                  | ruleset **20678089** active / bypass_actors 空。負証明: AI(App) token main 直接 push 拒否、承認なし merge 405、force push 拒否、red check merge 405、別トークン merge 405（`runbooks/production-gates.md` Evidence、`.orchestration/validation/P0-T02-probes.log`）                                      |
| GOV-003 | Architecture ADRs and supersession complete             | **PASS（条件付き — §3）** | ADR-0020〜0028 の Status を **Accepted 化（#169 merge `b1be788`、Owner approve = 採択署名）**。ADR-0029 が ADR-0016 を置換、ADR-0028 の一部置換を両正典コピーへ明記（#160/#164）。traceability green（毎 CI）                                                                                            |
| GOV-004 | Cloudflare Artifacts / Notion excluded by fitness check | **PASS**                  | `mise run governance` の fitness check が immutable-off flag を毎 CI 検証（#158。#165 exact-head run 31461602149 green に含まれる）                                                                                                                                                                      |
| GOV-005 | One-writer contract machine-validated                   | **PASS**                  | `mise run governance` → `governance:check` が実行する `check-architecture-fitness.mjs` の **DUPLICATE_OWNER 検証**（yaml 厳密パース: parse error / 重複キー / 欠落・空値 / writer==reviewer を fail-closed 拒否）+ 永続 negative fixture と敵対 9 ケースの durable テスト（#169）。実 WBS 113 tasks pass |

Phase acceptance（03_phase_acceptance.md P0 行）との対応: branch protection 証跡 = GOV-002、
ADR-0020..0028(+0029) = GOV-003、ENV decision = ENV-DEC-001/011 裁定記録、
現行 CI baseline = P0-T01。STOP 条件「main 保護なし」= 解消、「baseline failure 未分類」= P0-T01 で分類済み、
「法務/データ境界未決」= §3 の条件付き完了として Owner 裁定で明示繰延。

## 3. 条件付き完了（Owner 明示繰延。binding のまま）

以下は P0 exit を妨げないが、**各項目の解消まで対応フェーズ/機能の go-live を封鎖する**
（既存 STOP 条件はすべて効力維持。license register の go-live チェックリストが正本）。

| #   | 項目                                                                           | 封鎖対象                                                                                                         | 解消期限/フェーズ                                                                                                                                          |
| --- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | license register の全 OPEN/STOP 品目（register 2026-08-11 版が正本）           | **製品ごとに §3-1 の「封鎖境界」列が唯一の境界**（承認済み評価の範囲外で製品を有効化しない register 規則は維持） | §3-1 の各行のとおり                                                                                                                                        |
| 2   | license register「Decision record」表の Legal/Security/Procurement 行          | 各製品 go-live                                                                                                   | Owner 役割兼任（`docs/decisions/owner-role-consolidation.md`）により Owner 承認 1 件で充足可。ただし Legal 相当の判断（AGPL 境界等）は製品導入時に個別記録 |
| 3   | App `aiops-pr-bot` の `issues:write` 未付与                                    | coding-task workflow での `AIOPS_PR_TOKEN` 使用（P8 帯）                                                         | Owner の App 設定操作（`runbooks/production-gates.md` AI PR Token 節）                                                                                     |
| 4   | Upstream rate limiting（LB/WAF）ゲート                                         | 本番トラフィック開放（P10）                                                                                      | P10 cutover 前（`runbooks/production-gates.md`）                                                                                                           |
| 5   | E2E・実環境最終テスト（ENV 制約で保留）                                        | 該当フェーズの exit                                                                                              | 各フェーズの実環境ゲート（ENV-blocked ≠ pass 規律を維持）                                                                                                  |
| 6   | ENV-DEC-012（用語リスト）/ 013（プロファイル別報告範囲）/ 014（code scanning） | P6 / P6 / P8 の該当タスク                                                                                        | 各フェーズ entry まで                                                                                                                                      |

### §3-1 内訳（register の状態を転記。profile 裁定済みでも残証跡がある限り open）

| 製品         | register 状態                             | 残項目（要旨）                                                    | 封鎖境界                                                             |
| ------------ | ----------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| Temporal     | OPEN（profile は ENV-DEC-001 で確定済み） | exact pinned version/image、依存インベントリ、license notice 証跡 | **P3 go-live 前**（P3 の実装・shadow 作業は可、本番 cutover を封鎖） |
| LiteLLM      | OPEN                                      | exact artifact の pin、enterprise 機能境界のライセンス確認        | **P2-T02 の proxy 稼働開始前**（タスク開始境界）                     |
| agentgateway | OPEN                                      | Apache notice レビュー                                            | **P4 の gateway 稼働開始前**（P4-T01 系タスク開始境界）              |
| OPA          | OPEN                                      | Apache notice レビュー（vendor 配布物は別扱い）                   | **P4 の policy engine 稼働開始前**（同上）                           |
| Work IQ      | **OPEN / STOP**                           | delegated-surface 適格性、tenant/license、OBO、データ境界、課金   | **P5 の Work IQ 接続タスク開始前**（phase entry 境界）               |
| Wispr Flow   | **OPEN / STOP**                           | 同意、residency/retention、Privacy Mode/Cloud Sync、subprocessors | **P4-T08 connector 有効化前**（タスク開始境界）                      |
| Confluence   | OPEN                                      | 支配契約/order の特定、Rovo MCP の別途承認                        | **P4-T07 connector 有効化前**（タスク開始境界）                      |
| OpenTag      | OPEN                                      | license notice 保持と exact package/version の pin                | **P7 での UI 組込タスク開始前**                                      |
| CopilotKit   | OPEN                                      | 公開ライセンス記述の齟齬解消、OSS/Cloud/premium 境界選択          | **P7 での runtime 組込タスク開始前**                                 |
| Plane CE     | **OPEN / STOP**                           | AGPL の deployment/modification/integration 境界の Legal 承認     | **P4-T06 connector 有効化前**（タスク開始境界）                      |

## 4. Owner 承認（Phase-0 exit 裁定）

- 承認方式: 本文書を含む PR への **GitHub approve + merge**。ruleset 20678089 が
  実際に強制する統制は「CODEOWNER による approving review 1 件を、**最後に push した
  者以外**が exact head に対して行うこと（push 時に stale review は自動 dismiss）+
  全レビュースレッド解決 + required checks（build-test / gitleaks）green +
  bypass_actors 空」である。本プロジェクトの運用では AI（App `aiops-pr-bot`）が
  author かつ最終 pusher であるため、この統制下で成立する approve は Owner
  （mryfmo、唯一の CODEOWNER）のものに限られ、プロジェクトのゲート署名記録として扱う。
- 役割包含: `docs/decisions/owner-role-consolidation.md`（2026-08-10 Owner 裁定）により、
  Owner 承認 1 件で Security / Ops / Procurement の承認を充足する。
- 裁定内容: 上記 §1〜2 の証跡に基づき Phase P0 の exit を承認し、§3 の 6 項目を
  条件付き（binding）で明示繰延する。
- 日付: 2026-08-11（approve のタイムスタンプが正）

## 5. 改訂記録（レビュー逸脱の記録を含む）

- **逸脱 1（#168）**: 初版は P0-T10-REVIEW が **request_changes（所見 001〜004、
  「Owner must not approve or merge」）を出している状態のまま** Owner 判断で
  merge された（`f89541b`）。
- **逸脱 2（#169）**: 独立レビューの approve は head `3ad246a` に対するもので、
  その後 `Merge branch main` commit（`ffe85e6`）が追加され、**再レビューなしに**
  その別 head を Owner が approve・merge した（差分は main の取込のみだが、
  exact-head 再レビュー規律からの逸脱である）。
- 所見の実体是正は #169（ADR-0020..0028 Accepted 化、GOV-005 機械検証、register 整合）で
  main に入り、本改訂（P0-T10b）が文書記載（GOV-003/005 の証跡、§3-1 の全 OPEN 品目列挙、
  §4 の統制記述、本節の逸脱記録）を実態へ一致させた。**本改訂 PR の exact-head 独立
  レビュー + Owner approve を、上記 2 逸脱に対する補償ゲートとする**（歴史の遡及的な
  書き換えは主張しない）。レビュー証跡: `.orchestration/reviews/P0-T10-REVIEW.md` /
  `P0-T10a-REVIEW.md`。

merge をもって P0 は完了し、P1「Contracts and scaffolding」（P1-T01 scaffold から、
ADR-0029 により Azure 前提記述は AWS へ読み替え）へ進む。
