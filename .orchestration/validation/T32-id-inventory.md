# T32 ID Space Inventory

Generated: 2026-07-10T10:39:39.081Z

> exact-token検索。spec-id JSON、生成済みtraceability output、verifyTraceability自身、.orchestrationは参照corpusから除外した。
> 公式値は295 indexed IDs / 32 catalog definition lines / 31 indexed definitions / 264 undefined (89.5%)。差分1件はcatalog-only `DevOps:REQ-032`。

## 集計規則

- 集計キー: ID文字列単体ではなく `(system, id)` の複合キー（全295キー）。cross-system同番号56件を統合しない。
- system scope: `packages/prjops/**` はPrjOpsだけ、`packages/devops/**` はDevOpsだけへ計上する。`packages/shared/**`、`packages/server/**`、`packages/web/**`、`.github/**` は両systemへ計上する。
- kind: `/tests/` 配下または `*.test.*` は`test`。`docs/**`、`runbooks/**`、`README.md`、`AGENTS.md`は`doc`。それ以外の対象実装は`source`。
- dead: namespaced IDのexact-token参照が`source`にも`test`にも0件の場合。`doc`参照だけではdeadを解除しない。
- testless AC: namespaced ACのexact-token `test`参照が0件の場合。source/doc参照の有無は問わない。
- 除外: `spec-ids/*.json`、生成済みtraceability output、`verifyTraceability.ts`、`.orchestration/**`、`.git`、`node_modules`、`dist`、`.next`、`coverage`。
- 再生成: repository rootで `node .orchestration/validation/T32-analyze.mjs`。検算は `node .orchestration/validation/T32-validate.mjs`。

## Statistics

| System | Category | Total | Defined | Undefined | Dead | Testless AC |
| --- | --- | --- | --- | --- | --- | --- |
| PrjOps | REQ | 34 | 7 | 27 | 0 | - |
| PrjOps | SPEC-EXT | 27 | 0 | 27 | 5 | - |
| PrjOps | SPEC-INT | 30 | 8 | 22 | 0 | - |
| PrjOps | ISS | 10 | 0 | 10 | 9 | - |
| PrjOps | TOBE | 10 | 0 | 10 | 8 | - |
| PrjOps | ASM | 7 | 0 | 7 | 3 | - |
| PrjOps | AC | 38 | 7 | 31 | 9 | 11 |
| DevOps | REQ | 25 | 3 | 22 | 0 | - |
| DevOps | SPEC-EXT | 25 | 0 | 25 | 6 | - |
| DevOps | SPEC-INT | 30 | 3 | 27 | 0 | - |
| DevOps | TH | 7 | 0 | 7 | 0 | - |
| DevOps | ISS | 8 | 0 | 8 | 8 | - |
| DevOps | AC | 44 | 3 | 41 | 16 | 25 |

## Sequence Gaps

Git history check: every numeric base listed below was absent in every revision of its registry file; no intentional deletion/removal trace was found. This does not prove the gaps intentional.

| System | Category | Range | Missing numeric bases |
| --- | --- | --- | --- |
| PrjOps | REQ | 1-42 | 22, 23, 24, 25, 26, 27, 28, 29 |
| PrjOps | SPEC-EXT | 1-39 | 4, 5, 6, 7, 8, 9, 15, 16, 17, 18, 19, 29 |
| PrjOps | SPEC-INT | 1-69 | 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 28, 29, 34, 35, 36, 37, 38, 39, 41, 42, 43, 44, 45, 46, 47, 48, 49, 55, 56, 57, 58, 59 |
| PrjOps | TH | n/a | category absent from this system index |
| PrjOps | AC | 1-42 | 11, 12, 13, 14, 15, 16, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35 |
| PrjOps | ISS | 1-10 | none |
| PrjOps | TOBE | 1-10 | none |
| PrjOps | ASM | 1-7 | none |
| DevOps | REQ | 1-42 | 4, 5, 6, 7, 8, 9, 13, 14, 32, 33, 34, 35, 36, 37, 38, 39, 40 |
| DevOps | SPEC-EXT | 1-44 | 4, 5, 6, 7, 8, 9, 13, 14, 18, 19, 27, 28, 29, 34, 35, 36, 37, 38, 39 |
| DevOps | SPEC-INT | 1-83 | 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 17, 18, 19, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 42, 43, 44, 45, 46, 47, 48, 49, 58, 59, 65, 66, 67, 69, 71, 72, 73, 74, 75, 76, 77, 78, 79 |
| DevOps | TH | 1-7 | none |
| DevOps | AC | 1-42 | 4, 5, 6, 7, 8, 9, 13, 14, 33, 34, 35, 36, 37, 38, 39, 40 |
| DevOps | ISS | 1-8 | none |
| DevOps | TOBE | n/a | category absent from this system index |
| DevOps | ASM | n/a | category absent from this system index |

## Undefined IDs (full list)

### PrjOps REQ (27)

REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-011, REQ-012, REQ-013, REQ-014, REQ-015, REQ-016, REQ-017, REQ-018, REQ-019, REQ-020, REQ-021, REQ-030, REQ-031, REQ-032, REQ-033, REQ-034, REQ-035

### PrjOps SPEC-EXT (27)

SPEC-EXT-001, SPEC-EXT-002, SPEC-EXT-003, SPEC-EXT-010, SPEC-EXT-011, SPEC-EXT-012, SPEC-EXT-013, SPEC-EXT-014, SPEC-EXT-020, SPEC-EXT-021, SPEC-EXT-022, SPEC-EXT-023, SPEC-EXT-024, SPEC-EXT-025, SPEC-EXT-026, SPEC-EXT-027, SPEC-EXT-028, SPEC-EXT-030, SPEC-EXT-031, SPEC-EXT-032, SPEC-EXT-033, SPEC-EXT-034, SPEC-EXT-035, SPEC-EXT-036, SPEC-EXT-037, SPEC-EXT-038, SPEC-EXT-039

### PrjOps SPEC-INT (22)

SPEC-INT-001, SPEC-INT-010, SPEC-INT-020, SPEC-INT-021, SPEC-INT-022, SPEC-INT-023, SPEC-INT-024, SPEC-INT-025, SPEC-INT-026, SPEC-INT-027, SPEC-INT-030, SPEC-INT-031, SPEC-INT-032, SPEC-INT-033, SPEC-INT-040, SPEC-INT-050, SPEC-INT-051, SPEC-INT-052, SPEC-INT-053, SPEC-INT-054, SPEC-INT-060, SPEC-INT-061

### PrjOps ISS (10)

ISS-001, ISS-002, ISS-003, ISS-004, ISS-005, ISS-006, ISS-007, ISS-008, ISS-009, ISS-010

### PrjOps TOBE (10)

TOBE-01, TOBE-02, TOBE-03, TOBE-04, TOBE-05, TOBE-06, TOBE-07, TOBE-08, TOBE-09, TOBE-10

### PrjOps ASM (7)

ASM-001, ASM-002, ASM-003, ASM-004, ASM-005, ASM-006, ASM-007

### PrjOps AC (31)

AC-001-1, AC-001-2, AC-002-1, AC-002-2, AC-003-1, AC-003-2, AC-003-3, AC-004-1, AC-004-2, AC-005-1, AC-005-2, AC-005-3, AC-006-1, AC-006-2, AC-007-1, AC-007-2, AC-008-1, AC-008-2, AC-009-1, AC-009-2, AC-010-1, AC-010-2, AC-010-3, AC-017-1, AC-017-2, AC-018-1, AC-018-2, AC-019-1, AC-020-1, AC-020-2, AC-021-1

### DevOps REQ (22)

REQ-001, REQ-002, REQ-003, REQ-010, REQ-011, REQ-012, REQ-015, REQ-016, REQ-017, REQ-018, REQ-019, REQ-020, REQ-021, REQ-022, REQ-023, REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-029, REQ-030

### DevOps SPEC-EXT (25)

SPEC-EXT-001, SPEC-EXT-002, SPEC-EXT-003, SPEC-EXT-010, SPEC-EXT-011, SPEC-EXT-012, SPEC-EXT-015, SPEC-EXT-016, SPEC-EXT-017, SPEC-EXT-020, SPEC-EXT-021, SPEC-EXT-022, SPEC-EXT-023, SPEC-EXT-024, SPEC-EXT-025, SPEC-EXT-026, SPEC-EXT-030, SPEC-EXT-031, SPEC-EXT-032, SPEC-EXT-033, SPEC-EXT-040, SPEC-EXT-041, SPEC-EXT-042, SPEC-EXT-043, SPEC-EXT-044

### DevOps SPEC-INT (27)

SPEC-INT-001, SPEC-INT-010, SPEC-INT-011, SPEC-INT-020, SPEC-INT-021, SPEC-INT-030, SPEC-INT-031, SPEC-INT-032, SPEC-INT-033, SPEC-INT-040, SPEC-INT-041, SPEC-INT-050, SPEC-INT-051, SPEC-INT-052, SPEC-INT-053, SPEC-INT-054, SPEC-INT-055, SPEC-INT-056, SPEC-INT-057, SPEC-INT-060, SPEC-INT-061, SPEC-INT-062, SPEC-INT-063, SPEC-INT-064, SPEC-INT-068, SPEC-INT-070, SPEC-INT-080

### DevOps TH (7)

TH-001, TH-002, TH-003, TH-004, TH-005, TH-006, TH-007

### DevOps ISS (8)

ISS-01, ISS-02, ISS-03, ISS-04, ISS-05, ISS-06, ISS-07, ISS-08

### DevOps AC (41)

AC-001a, AC-001b, AC-001c, AC-002a, AC-002b, AC-003a, AC-003b, AC-010a, AC-010b, AC-010c, AC-011a, AC-011b, AC-012a, AC-012b, AC-012c, AC-015a, AC-015b, AC-015c, AC-016a, AC-016b, AC-017a, AC-017b, AC-018a, AC-018b, AC-018c, AC-019a, AC-020a, AC-020b, AC-021a, AC-021b, AC-022a, AC-023a, AC-023b, AC-024a, AC-025a, AC-026a, AC-027a, AC-028a, AC-029a, AC-030a, AC-041-1

## Dead IDs (no exact source/test reference)

PrjOps:SPEC-EXT-002, PrjOps:SPEC-EXT-022, PrjOps:SPEC-EXT-028, PrjOps:SPEC-EXT-031, PrjOps:SPEC-EXT-033, PrjOps:ISS-002, PrjOps:ISS-003, PrjOps:ISS-004, PrjOps:ISS-005, PrjOps:ISS-006, PrjOps:ISS-007, PrjOps:ISS-008, PrjOps:ISS-009, PrjOps:ISS-010, PrjOps:TOBE-02, PrjOps:TOBE-03, PrjOps:TOBE-04, PrjOps:TOBE-05, PrjOps:TOBE-06, PrjOps:TOBE-07, PrjOps:TOBE-08, PrjOps:TOBE-09, PrjOps:ASM-001, PrjOps:ASM-005, PrjOps:ASM-007, PrjOps:AC-001-2, PrjOps:AC-002-2, PrjOps:AC-003-1, PrjOps:AC-003-2, PrjOps:AC-003-3, PrjOps:AC-004-1, PrjOps:AC-005-3, PrjOps:AC-006-1, PrjOps:AC-020-2, DevOps:SPEC-EXT-002, DevOps:SPEC-EXT-011, DevOps:SPEC-EXT-012, DevOps:SPEC-EXT-031, DevOps:SPEC-EXT-032, DevOps:SPEC-EXT-044, DevOps:ISS-01, DevOps:ISS-02, DevOps:ISS-03, DevOps:ISS-04, DevOps:ISS-05, DevOps:ISS-06, DevOps:ISS-07, DevOps:ISS-08, DevOps:AC-001a, DevOps:AC-001b, DevOps:AC-010b, DevOps:AC-010c, DevOps:AC-015a, DevOps:AC-015b, DevOps:AC-016a, DevOps:AC-016b, DevOps:AC-018c, DevOps:AC-019a, DevOps:AC-020a, DevOps:AC-021a, DevOps:AC-022a, DevOps:AC-027a, DevOps:AC-029a, DevOps:AC-030a

## AC IDs without exact test reference

PrjOps:AC-001-2, PrjOps:AC-002-2, PrjOps:AC-003-1, PrjOps:AC-003-2, PrjOps:AC-003-3, PrjOps:AC-004-1, PrjOps:AC-004-2, PrjOps:AC-005-3, PrjOps:AC-006-1, PrjOps:AC-008-1, PrjOps:AC-020-2, DevOps:AC-001a, DevOps:AC-001b, DevOps:AC-002a, DevOps:AC-002b, DevOps:AC-003b, DevOps:AC-010b, DevOps:AC-010c, DevOps:AC-012b, DevOps:AC-015a, DevOps:AC-015b, DevOps:AC-015c, DevOps:AC-016a, DevOps:AC-016b, DevOps:AC-018c, DevOps:AC-019a, DevOps:AC-020a, DevOps:AC-020b, DevOps:AC-021a, DevOps:AC-022a, DevOps:AC-025a, DevOps:AC-026a, DevOps:AC-027a, DevOps:AC-028a, DevOps:AC-029a, DevOps:AC-030a

## Source/test references absent from both indexes

| ID | References | Classification |
| --- | --- | --- |
| AC-016-1 | packages/prjops/src/templates/index.ts:4<br>packages/prjops/tests/reportTemplates.test.ts:177 | real implementation/test trace candidate missing from index |
| REQ-999 | packages/server/tests/standardReportsRepo.test.ts:29 | synthetic negative-test fixture |

## Cross-system exact ID collisions

AC-041-1, AC-042-1, REQ-001, REQ-002, REQ-003, REQ-010, REQ-011, REQ-012, REQ-015, REQ-016, REQ-017, REQ-018, REQ-019, REQ-020, REQ-021, REQ-030, REQ-031, REQ-041, REQ-042, SPEC-EXT-001, SPEC-EXT-002, SPEC-EXT-003, SPEC-EXT-010, SPEC-EXT-011, SPEC-EXT-012, SPEC-EXT-020, SPEC-EXT-021, SPEC-EXT-022, SPEC-EXT-023, SPEC-EXT-024, SPEC-EXT-025, SPEC-EXT-026, SPEC-EXT-030, SPEC-EXT-031, SPEC-EXT-032, SPEC-EXT-033, SPEC-INT-001, SPEC-INT-010, SPEC-INT-020, SPEC-INT-021, SPEC-INT-030, SPEC-INT-031, SPEC-INT-032, SPEC-INT-033, SPEC-INT-040, SPEC-INT-050, SPEC-INT-051, SPEC-INT-052, SPEC-INT-053, SPEC-INT-054, SPEC-INT-060, SPEC-INT-061, SPEC-INT-062, SPEC-INT-063, SPEC-INT-064, SPEC-INT-068

Undefined collisions have unknowable semantic equivalence. Defined shared IDs must still use `(system, id)` because the definitions differ or delegate separately.

| ID | PrjOps meaning/evidence | DevOps meaning/evidence |
| --- | --- | --- |
| AC-041-1 | catalog: Reasoning/tool output is visible in chat and successful tool output can be pinned to the page. (docs/spec/spec-id-catalog.md:31) | normative text absent; current reference: 根拠: ADR-0005（WebUIダッシュボード：チャットによる動的表示切替）/ * ADR-0013 / REQ-041 / SPEC-INT-068 / AC-041-1。POST /api/chat — * 本ファイルは本番用DI（auth() + pg.Pool + createAnth… (packages/web/src/app/api/chat/route.ts:5) |
| AC-042-1 | catalog: Missing delivery config is disabled with audit; valid reports are ingested and delivered idempotently without investor leaks. (docs/spec/spec-id-catalog.md:32) | catalog: Missing delivery config is disabled with audit and duplicate standard reports are not delivered twice. (docs/spec/spec-id-catalog.md:47) |
| REQ-001 | normative text absent; current reference: サンプルデータ: プロジェクトマスタ（REQ-001, SPEC-INT-021） # パス規約: projects/{PJ-nnn}.yaml id: PJ-001 (packages/prjops/src/data/projects/PJ-001.yaml:1) | normative text absent; current reference: packages/devops/src/agents/AGT_BLD.ts * * 根拠: REQ-001 ビルド失敗の自動一次調査 / REQ-002 修正案の自動生成 / SPEC-INT-011 * * 注意: 本ファイルは @anthropic-ai/sdk（分類）と @anthropic… (packages/devops/src/agents/AGT_BLD.ts:4) |
| REQ-002 | normative text absent; current reference: サンプルデータ: 企業マスタ（REQ-002, SPEC-INT-023） # パス規約: organizations/{ORG-nnn}.yaml id: ORG-001 (packages/prjops/src/data/organizations/ORG-001.yaml:1) | normative text absent; current reference: packages/devops/src/agents/AGT_BLD.ts * * 根拠: REQ-001 ビルド失敗の自動一次調査 / REQ-002 修正案の自動生成 / SPEC-INT-011 * * 注意: 本ファイルは @anthropic-ai/sdk（分類）と @anthropic… (packages/devops/src/agents/AGT_BLD.ts:4) |
| REQ-003 | normative text absent; current reference: * * REQ-003 進捗報告依頼の自動送付 / SPEC-EXT-010 報告依頼メッセージ / SPEC-EXT-030 通知一覧(依頼)。 * 毎週水曜09:00 JSTに、全activeプロジェクトの報告担当者へTeams/メールで報告依頼を送付する（TOBE-01）。 * 件名形式: … (packages/prjops/src/agents/AGT05_distributor.ts:165) | normative text absent; current reference: packages/devops/src/agents/AGT_DEP.ts * * 根拠: REQ-003 ステージング自動昇格 / REQ-010 本番デプロイの人間承認 / REQ-012 自動ロールバック * SPEC-INT-020 デプロイ状態機械 * (packages/devops/src/agents/AGT_DEP.ts:4) |
| REQ-010 | normative text absent; current reference: packages/prjops/src/agents/AGT04_reportGenerator.ts * * 根拠: REQ-010〜016 プロファイル別レポート生成 / SPEC-INT-031 * 数値・色・表はコード算出、LLMは文章スロット（結論3行・トピック要約等）のみ生成する。 *… (packages/prjops/src/agents/AGT04_reportGenerator.ts:4) | normative text absent; current reference: packages/devops/src/agents/AGT_CHG.ts * * 根拠: SPEC-INT-031 AGT-CHG 承認パッケージ生成 / REQ-010, REQ-011 * 入力: 対象リリースのPR一覧・diff・CI結果。処理: 差分要約(PROMPT-CHG-01、最大… (packages/devops/src/agents/AGT_CHG.ts:4) |
| REQ-011 | normative text absent; current reference: - すべて純粋関数。祝日データ（HolidayCalendar）を明示的に注入することで、 * 同一入力に対し常に同一出力を返す決定的な実装とする * （PrjOps REQ-007 AC-007-1 および DevOps REQ-011 AC-011a と同じ設計原則を踏襲）。 * - 日付は … (packages/shared/src/calendar/businessCalendar.ts:12) | normative text absent; current reference: packages/devops/src/agents/AGT_CHG.ts * * 根拠: SPEC-INT-031 AGT-CHG 承認パッケージ生成 / REQ-010, REQ-011 * 入力: 対象リリースのPR一覧・diff・CI結果。処理: 差分要約(PROMPT-CHG-01、最大… (packages/devops/src/agents/AGT_CHG.ts:4) |
| REQ-012 | normative text absent; current reference: } // ---------- PRF-02 リーダー (REQ-012) ---------- export interface LeaderProjectRow { id: string; (packages/prjops/src/templates/profileReports.ts:92) | normative text absent; current reference: packages/devops/src/agents/AGT_DEP.ts * * 根拠: REQ-003 ステージング自動昇格 / REQ-010 本番デプロイの人間承認 / REQ-012 自動ロールバック * SPEC-INT-020 デプロイ状態機械 * (packages/devops/src/agents/AGT_DEP.ts:4) |
| REQ-015 | normative text absent; current reference: } // ---------- PRF-05 投資元 (REQ-015) ---------- export interface InvestorProjectPage { id: string; (packages/prjops/src/templates/profileReports.ts:253) | normative text absent; current reference: packages/devops/src/agents/AGT_INC.ts * * 根拠: REQ-015 一次切り分けの自動化 / REQ-016 時限エスカレーション / REQ-017 誤検知の抑制 * SPEC-INT-030 * (packages/devops/src/agents/AGT_INC.ts:4) |
| REQ-016 | normative text absent; current reference: * * packages/prjops/src/templates/index.ts * REQ-010〜016（REQ-016: 多言語生成。ja/en切り替えでcommon.langを指定するだけで全プロファイルが * 対応する。AC-016-1: 同一データから生成したja版とen版で数値・… (packages/prjops/src/templates/index.ts:3) | normative text absent; current reference: packages/devops/src/agents/AGT_INC.ts * * 根拠: REQ-015 一次切り分けの自動化 / REQ-016 時限エスカレーション / REQ-017 誤検知の抑制 * SPEC-INT-030 * (packages/devops/src/agents/AGT_INC.ts:4) |
| REQ-017 | normative text absent; current reference: packages/prjops/src/lib/approvalTimer.ts * * 根拠: REQ-017 承認ゲート / AC-017-2 / SPEC-INT-050 / SPEC-EXT-038（承認依頼/承認督促の通知一覧項目） * 承認期限24時間超過で代理承認者へ、さらに24時間… (packages/prjops/src/lib/approvalTimer.ts:4) | normative text absent; current reference: packages/devops/src/agents/AGT_INC.ts * * 根拠: REQ-015 一次切り分けの自動化 / REQ-016 時限エスカレーション / REQ-017 誤検知の抑制 * SPEC-INT-030 * (packages/devops/src/agents/AGT_INC.ts:4) |
| REQ-018 | normative text absent; current reference: packages/prjops/src/agents/AGT05_distributor.ts * * 根拠: REQ-018 配信 / SPEC-INT-052 冪等配信 / ADR-0014 REQ-042 SPEC-INT-069 AC-042-1 * 承認済み（PRF-04/05）または検… (packages/prjops/src/agents/AGT05_distributor.ts:4) | normative text absent; current reference: packages/devops/src/agents/AGT_SEC.ts * * 根拠: REQ-018 JIT権限付与と自動失効 / REQ-019 月次棚卸し / SPEC-INT-032 / SPEC-INT-053 * 妥当性チェック（決定的ロジック）: 申請者の所属プロジェクト一致、理… (packages/devops/src/agents/AGT_SEC.ts:4) |
| REQ-019 | normative text absent; current reference: packages/prjops/src/agents/AGT07_verifier.ts * * 根拠: REQ-019 配信前検証 / SPEC-INT-051 * AGT-07は配信前に次を機械検証する: * (a) レポート内数値と正本データの一致 (packages/prjops/src/agents/AGT07_verifier.ts:4) | normative text absent; current reference: packages/devops/src/agents/AGT_SEC.ts * * 根拠: REQ-018 JIT権限付与と自動失効 / REQ-019 月次棚卸し / SPEC-INT-032 / SPEC-INT-053 * 妥当性チェック（決定的ロジック）: 申請者の所属プロジェクト一致、理… (packages/devops/src/agents/AGT_SEC.ts:4) |
| REQ-020 | normative text absent; current reference: 根拠: * - PrjOps REQ-020/021, SPEC-INT-053: 全エージェント入出力・人間介入を追記型で記録、改変不可、5年保持。 * - DevOps REQ-028, SPEC-INT-056: 全エージェント判断・人間承認・権限操作を追記専用ログに記録、1年保持、 * U… (packages/shared/src/auditLog.ts:5) | normative text absent; current reference: packages/devops/src/agents/AGT_RPT.ts * * 根拠: REQ-020〜024 プロファイル別定期報告 / SPEC-INT-033 / ADR-0014 REQ-042 SPEC-INT-083 AC-042-1 * 数値はスナップショットから直接埋め込み、L… (packages/devops/src/agents/AGT_RPT.ts:4) |
| REQ-021 | normative text absent; current reference: packages/prjops/src/lib/logicalDelete.ts * * 根拠: SPEC-INT-027 削除 / REQ-021 上書き・介入の記録 / AC-021-1 * 「物理削除禁止。deleted: true の論理削除のみ。操作可能者はPRF-03、delete_r… (packages/prjops/src/lib/logicalDelete.ts:4) | normative text absent; current reference: } /** PRF-M日次レポートの配信（REQ-021） */ export async function deliverMemberDailyReport( common: DevOpsComposeCommon, (packages/devops/src/agents/AGT_RPT.ts:40) |
| REQ-030 | normative text absent; current reference: 根拠: * - PrjOps REQ-032（認証情報は暗号化シークレットストアのみで保持、コード・ログに平文で現れない） * - DevOps REQ-030 / SPEC-INT-070（シークレットを平文でログ・レポート・PRコメントに出力しない。 * LLMへの入力からシークレットパターン… (packages/shared/src/secretSanitizer.ts:6) | normative text absent; current reference: rollback: DROP TABLE project_channels; -- ADR-0005: チャネル会話の写し。保存前に sanitizeSecrets() を必ず通すこと（REQ-030）。 -- Teams側の編集/削除は last_modified_at / deleted_at… (packages/devops/src/db/schema.sql:239) |
| REQ-031 | normative text absent; current reference: actor: "AGT-05", action: "deliver_card_failed", basis: "REQ-031", detail: { reportId: target.reportId, recipientId: target.recipientId, error: String… (packages/prjops/src/agents/AGT05_distributor.ts:115) | catalog: DevOps manager views must be able to use GitHub time-series snapshots for DORA and operational change-over-time views. (docs/spec/spec-id-catalog.md:38) |
| REQ-041 | catalog: The dashboard page agent must use reasoning UI and generative UI through ViewSpec/tool calls, without letting the LLM invent metrics. (docs/spec/spec-id-catalog.md:16) | catalog: DevOps page-agent behavior follows the shared Web page-agent requirement. (docs/spec/spec-id-catalog.md:40) |
| REQ-042 | catalog: Integrated report delivery must connect standard report ingest, active recipients, Outlook/Teams delivery, and Web dashboard deep links. (docs/spec/spec-id-catalog.md:17) | catalog: DevOps standard report delivery follows the integrated server ingest and delivery path. (docs/spec/spec-id-catalog.md:41) |
| SPEC-EXT-001 | normative text absent; current reference: repo: string; issueOrPrNumber: number; body: string; // SPEC-EXT-001形式のMarkdown等 } (packages/shared/src/clients/githubClient.ts:67) | normative text absent; current reference: repo: string; issueOrPrNumber: number; body: string; // SPEC-EXT-001形式のMarkdown等 } (packages/shared/src/clients/githubClient.ts:67) |
| SPEC-EXT-002 | normative text absent; no exact source/test evidence (meaning unrecoverable) | normative text absent; no exact source/test evidence (meaning unrecoverable) |
| SPEC-EXT-003 | normative text absent; current reference: Issue/PRコメント・デプロイをGitHub API経由で実行する（AC-025aはSPEC-INT-010のディスパッチ * 60秒以内要件、本クライアントはそのAPI呼び出し部分を担当）。 * - PrjOps SPEC-EXT-003 / REQ-004(c): GitHub構造化ファイ… (packages/shared/src/clients/githubClient.ts:8) | normative text absent; current reference: Issue/PRコメント・デプロイをGitHub API経由で実行する（AC-025aはSPEC-INT-010のディスパッチ * 60秒以内要件、本クライアントはそのAPI呼び出し部分を担当）。 * - PrjOps SPEC-EXT-003 / REQ-004(c): GitHub構造化ファイ… (packages/shared/src/clients/githubClient.ts:8) |
| SPEC-EXT-010 | normative text absent; current reference: * * REQ-003 進捗報告依頼の自動送付 / SPEC-EXT-010 報告依頼メッセージ / SPEC-EXT-030 通知一覧(依頼)。 * 毎週水曜09:00 JSTに、全activeプロジェクトの報告担当者へTeams/メールで報告依頼を送付する（TOBE-01）。 * 件名形式: … (packages/prjops/src/agents/AGT05_distributor.ts:165) | normative text absent; current reference: 根拠: SPEC-INT-031 AGT-CHG 承認パッケージ生成 / REQ-010, REQ-011 * 入力: 対象リリースのPR一覧・diff・CI結果。処理: 差分要約(PROMPT-CHG-01、最大10行)、 * リスクスコア(SPEC-INT-021)、ロールバック手順を組み立て… (packages/devops/src/agents/AGT_CHG.ts:6) |
| SPEC-EXT-011 | normative text absent; current reference: packages/prjops/src/lib/freeTextValidation.ts * * 根拠: REQ-005 自由文の構造化 / SPEC-EXT-011, 012 / SPEC-INT-030 * 自由文報告の6項目: ①進捗率(0-100の整数%) ②自己申告ステータス(順調/注… (packages/prjops/src/lib/freeTextValidation.ts:4) | normative text absent; no exact source/test evidence (meaning unrecoverable) |
| SPEC-EXT-012 | normative text absent; current reference: AC-005-2: 聞き返しは最大3回。3回で充足しない場合は運用担当へエスカレーション、「不完全」フラグ。 * SPEC-INT-030手順3: 必須6項目の欠落判定は構造化後にコードで実施（LLMに判定させない）。 * SPEC-EXT-012 / SPEC-EXT-032（通知一覧の聞き返し… (packages/prjops/src/lib/freeTextValidation.ts:10) | normative text absent; no exact source/test evidence (meaning unrecoverable) |
| SPEC-EXT-020 | normative text absent; current reference: packages/prjops/src/templates/reportShell.ts * * 根拠: REQ-010（共通要件）/ SPEC-EXT-020（共通仕様） * - 自己完結型HTML（外部CSS/JS参照なし、1ファイル）。全レポートに生成日時、対象期間、 * レポートID、デー… (packages/prjops/src/templates/reportShell.ts:4) | normative text absent; current reference: 配信名簿はAGT-SEC管理の名簿を唯一のソースとし、配信直前に毎回読み直す（REQ-024）。 * * DevOpsのプロファイル別レポート仕様（SPEC-EXT-020〜025）は構造化データの表示が中心で、 * PrjOps PRF-04のような自由文の「結論」スロットを必須としないため、本… (packages/devops/src/agents/AGT_RPT.ts:9) |
| SPEC-EXT-021 | normative text absent; current reference: packages/prjops/src/lib/reportPermissionFilter.ts * * 根拠: DOC-03 §4.5（プロファイル別要件・閲覧権限）, SPEC-EXT-021（プロファイル別レイアウト）, * AC-011〜015共通-1: 各プロファイルのレポートに「非表… (packages/prjops/src/lib/reportPermissionFilter.ts:4) | normative text absent; current reference: packages/devops/src/lib/reportPermissionFilter.ts * * 根拠: SPEC-EXT-021/022/024（プロファイル別レイアウト）, SPEC-EXT-026（閲覧権限） * REQ-021 PRF-M: 本人の担当分のみ（他人の個人別データは… (packages/devops/src/lib/reportPermissionFilter.ts:4) |
| SPEC-EXT-022 | normative text absent; no exact source/test evidence (meaning unrecoverable) | normative text absent; current reference: REQ-022 PRF-L: 担当プロジェクトのみ。メンバー別ではなくタスク種別別の滞留状況 * REQ-023 PRF-G: 全50プロジェクト横断 * SPEC-EXT-022 PRF-L日次(5): 滞留状況はメンバー個人名別の集計を表示しない */ (packages/devops/src/lib/reportPermissionFilter.ts:8) |
| SPEC-EXT-023 | normative text absent; current reference: 配信前に prjops-reports/delivery_log/{RPT-id}.yaml の存在を確認し、存在すればスキップ。 * 送信成功後に記録を書く（記録失敗時は再送許容だが件名 (再送) を付与）。 * SPEC-EXT-023: 重複して2通届くことはない。 */ (packages/prjops/src/lib/idempotentDelivery.ts:7) | normative text absent; current reference: packages/devops/src/templates/profileReports.ts * * 根拠: SPEC-EXT-021 PRF-M日次 / SPEC-EXT-022 PRF-L日次 / SPEC-EXT-023 PRF-L週次 / * SPEC-EXT-024 PRF-G週次 /… (packages/devops/src/templates/profileReports.ts:4) |
| SPEC-EXT-024 | normative text absent; current reference: "logical_delete", // PrjOps: 正本データの論理削除 (PRF-03のみ) "grant_revoke_manual_override", // DevOps: 手動権限変更の検出時の是正 "approval_reject", // 承認差し戻し（コメント必須, SPEC… (packages/shared/src/auditLog.ts:41) | normative text absent; current reference: 根拠: SPEC-EXT-021 PRF-M日次 / SPEC-EXT-022 PRF-L日次 / SPEC-EXT-023 PRF-L週次 / * SPEC-EXT-024 PRF-G週次 / SPEC-EXT-025 PRF-G月次 * 数値はすべて data-src 属性付きで埋め込み、AG… (packages/devops/src/templates/profileReports.ts:5) |
| SPEC-EXT-025 | normative text absent; current reference: const PROFILE_REQUIREMENTS: Record<ParsedCommand["kind"], ReadonlyArray<"PRF-01" \\| "PRF-02" \\| "PRF-03">> = { action_add: ["PRF-02", "PRF-03"], ac… (packages/prjops/src/lib/commandParser.ts:137) | normative text absent; current reference: 根拠: SPEC-EXT-021 PRF-M日次 / SPEC-EXT-022 PRF-L日次 / SPEC-EXT-023 PRF-L週次 / * SPEC-EXT-024 PRF-G週次 / SPEC-EXT-025 PRF-G月次 * 数値はすべて data-src 属性付きで埋め込み、AG… (packages/devops/src/templates/profileReports.ts:5) |
| SPEC-EXT-026 | normative text absent; current reference: 本モジュールは「どのプロジェクト/課題/個人名をレポート対象データに含めてよいか」を決定的に判定する。 * テンプレート層はこのフィルタを通過したデータのみを描画に用いる（禁止語彙の後付け除去には頼らない設計。 * SPEC-EXT-026「配信名簿はAGT-SEC管理の名簿を唯一のソースとする」… (packages/prjops/src/lib/reportPermissionFilter.ts:17) | normative text absent; current reference: 根拠: REQ-020〜024 プロファイル別定期報告 / SPEC-INT-033 / ADR-0014 REQ-042 SPEC-INT-083 AC-042-1 * 数値はスナップショットから直接埋め込み、LLMによる数値の再生成は行わない（AC-020bの捏造防止）。 * 配信: プロファ… (packages/devops/src/agents/AGT_RPT.ts:6) |
| SPEC-EXT-030 | normative text absent; current reference: * * REQ-003 進捗報告依頼の自動送付 / SPEC-EXT-010 報告依頼メッセージ / SPEC-EXT-030 通知一覧(依頼)。 * 毎週水曜09:00 JSTに、全activeプロジェクトの報告担当者へTeams/メールで報告依頼を送付する（TOBE-01）。 * 件名形式: … (packages/prjops/src/agents/AGT05_distributor.ts:165) | normative text absent; current reference: JIT失効: スケジューラが毎分、expires_at <= now の権限を剥奪する。 * 手動変更を検出した場合は差分をSev3インシデントとして起票する。 * 外部企業アカウントに関する見え方はSPEC-EXT-030(障害通知)/031(障害受付)/032(アクセス権の見え方、 * 期限7… (packages/devops/src/agents/AGT_SEC.ts:9) |
| SPEC-EXT-031 | normative text absent; no exact source/test evidence (meaning unrecoverable) | normative text absent; no exact source/test evidence (meaning unrecoverable) |
| SPEC-EXT-032 | normative text absent; current reference: AC-005-2: 聞き返しは最大3回。3回で充足しない場合は運用担当へエスカレーション、「不完全」フラグ。 * SPEC-INT-030手順3: 必須6項目の欠落判定は構造化後にコードで実施（LLMに判定させない）。 * SPEC-EXT-012 / SPEC-EXT-032（通知一覧の聞き返し… (packages/prjops/src/lib/freeTextValidation.ts:10) | normative text absent; no exact source/test evidence (meaning unrecoverable) |
| SPEC-EXT-033 | normative text absent; no exact source/test evidence (meaning unrecoverable) | normative text absent; current reference: 入力: 対象リリースのPR一覧・diff・CI結果。処理: 差分要約(PROMPT-CHG-01、最大10行)、 * リスクスコア(SPEC-INT-021)、ロールバック手順を組み立て、SPEC-EXT-010カードをTeamsへ送信。 * 承認完了イベントを受けた場合、影響対象の関連企業へSP… (packages/devops/src/agents/AGT_CHG.ts:7) |
| SPEC-INT-001 | normative text absent; current reference: parse: (raw) => raw as StructuredStatusUpdate, maxAttempts: 2, // SPEC-INT-030: LLM呼び出しは最大2回 allowEscalation: true, // (a)自由文構造化のみ昇格対象（SPEC-INT-001） … (packages/prjops/src/agents/AGT02_collector.ts:102) | normative text absent; current reference: ADR-0005: Graphサブスクリプション台帳。renew対象・プロセス再起動後の復元・deltaLink永続化の正本。 -- mode: notification=change notification受信中 / polling=renew失敗時の5分deltaフォールバック（SPEC-I… (packages/devops/src/db/schema.sql:262) |
| SPEC-INT-010 | normative text absent; current reference: 根拠: * - DevOps REQ-025 GitHub連携: リポジトリイベント(push, workflow_run, PR)をWebhookで受信し、 * Issue/PRコメント・デプロイをGitHub API経由で実行する（AC-025aはSPEC-INT-010のディスパッチ * 6… (packages/shared/src/clients/githubClient.ts:6) | normative text absent; current reference: 2026-07-10 ADR-0005 / SPEC-INT-010: eventsキューのretry/DLQ/lease回収とwebhook冪等キー。 -- attempts/next_attempt_atは失敗イベントの指数backoff再試行、claimed_atはdispatched le… (packages/devops/src/db/migrations/202607100001_events_retry_dedupe.sql:1) |
| SPEC-INT-020 | normative text absent; current reference: 1. 受信 → 発信者をstakeholderマスタと突合。不一致は運用担当へ通知し破棄（E-ING01）。 * 2. 対象PJ特定: 件名のPJ-nnn → 本文中のPJ-nnn → 発信者の担当PJが1件ならそれ、の優先順（E-ING02）。 * 3. LLM構造化: 温度0、SPEC-INT… (packages/prjops/src/agents/AGT02_collector.ts:9) | normative text absent; current reference: 根拠: REQ-003 ステージング自動昇格 / REQ-010 本番デプロイの人間承認 / REQ-012 自動ロールバック * SPEC-INT-020 デプロイ状態機械 * * 決定的な判断（TH-001/TH-002/TH-003評価、状態遷移検証）はlib/配下の純粋関数に委譲し、 (packages/devops/src/agents/AGT_DEP.ts:5) |
| SPEC-INT-021 | normative text absent; current reference: サンプルデータ: プロジェクトマスタ（REQ-001, SPEC-INT-021） # パス規約: projects/{PJ-nnn}.yaml id: PJ-001 (packages/prjops/src/data/projects/PJ-001.yaml:1) | normative text absent; current reference: 根拠: SPEC-INT-031 AGT-CHG 承認パッケージ生成 / REQ-010, REQ-011 * 入力: 対象リリースのPR一覧・diff・CI結果。処理: 差分要約(PROMPT-CHG-01、最大10行)、 * リスクスコア(SPEC-INT-021)、ロールバック手順を組み立て… (packages/devops/src/agents/AGT_CHG.ts:6) |
| SPEC-INT-030 | normative text absent; current reference: packages/prjops/src/agents/AGT02_collector.ts * * 根拠: REQ-004 マルチチャネル取り込み / REQ-005 自由文の構造化 / SPEC-INT-030 * * パイプライン（SPEC-INT-030）: (packages/prjops/src/agents/AGT02_collector.ts:4) | normative text absent; current reference: 根拠: REQ-015 一次切り分けの自動化 / REQ-016 時限エスカレーション / REQ-017 誤検知の抑制 * SPEC-INT-030 * * 分類（severity_candidate等）はLLM（PROMPT-INC-01）、TH-005エスカレーション・TH-006誤検知判定は (packages/devops/src/agents/AGT_INC.ts:5) |
| SPEC-INT-031 | normative text absent; current reference: packages/prjops/src/agents/AGT04_reportGenerator.ts * * 根拠: REQ-010〜016 プロファイル別レポート生成 / SPEC-INT-031 * 数値・色・表はコード算出、LLMは文章スロット（結論3行・トピック要約等）のみ生成する。 *… (packages/prjops/src/agents/AGT04_reportGenerator.ts:4) | normative text absent; current reference: packages/devops/src/agents/AGT_CHG.ts * * 根拠: SPEC-INT-031 AGT-CHG 承認パッケージ生成 / REQ-010, REQ-011 * 入力: 対象リリースのPR一覧・diff・CI結果。処理: 差分要約(PROMPT-CHG-01、最大… (packages/devops/src/agents/AGT_CHG.ts:4) |
| SPEC-INT-032 | normative text absent; current reference: packages/prjops/src/lib/statusJudge.ts * * 根拠: REQ-007 ステータス自動判定 / SPEC-INT-032 * * 判定基準（REQ-007から一字一句変更せず実装する）: (packages/prjops/src/lib/statusJudge.ts:4) | normative text absent; current reference: packages/devops/src/agents/AGT_SEC.ts * * 根拠: REQ-018 JIT権限付与と自動失効 / REQ-019 月次棚卸し / SPEC-INT-032 / SPEC-INT-053 * 妥当性チェック（決定的ロジック）: 申請者の所属プロジェクト一致、理… (packages/devops/src/agents/AGT_SEC.ts:4) |
| SPEC-INT-033 | normative text absent; current reference: packages/prjops/src/lib/commandParser.ts * * 根拠: SPEC-EXT-014 Teamsコマンド / SPEC-INT-033 コマンドパーサ * 本システム宛のTeamsメッセージで次の定型コマンドを受け付ける（PRF-02以上）: * /actio… (packages/prjops/src/lib/commandParser.ts:4) | normative text absent; current reference: packages/devops/src/agents/AGT_RPT.ts * * 根拠: REQ-020〜024 プロファイル別定期報告 / SPEC-INT-033 / ADR-0014 REQ-042 SPEC-INT-083 AC-042-1 * 数値はスナップショットから直接埋め込み、L… (packages/devops/src/agents/AGT_RPT.ts:4) |
| SPEC-INT-040 | normative text absent; current reference: エージェント処理が失敗した場合、AGT-01が同一ジョブを最大2回リトライ（間隔10分）し、 * 3回目失敗でPMO運用担当（PRF-03が指名する1名）へTeams通知する。 * SPEC-INT-040（DOC-05 §5）: ジョブの依存順序（analyze→report→verify→de… (packages/prjops/src/agents/AGT01_orchestrator.ts:7) | normative text absent; current reference: packages/devops/src/agents/AGT_ORCH.ts * * 根拠: SPEC-INT-040 AGT-ORCH / REQ-029 可用性・失敗時挙動 * 各エージェントのヘルスチェック（30秒間隔）。エージェント不応答が3回連続した場合、 * REQ-029のフェイルセ… (packages/devops/src/agents/AGT_ORCH.ts:4) |
| SPEC-INT-050 | normative text absent; current reference: packages/prjops/src/lib/approvalTimer.ts * * 根拠: REQ-017 承認ゲート / AC-017-2 / SPEC-INT-050 / SPEC-EXT-038（承認依頼/承認督促の通知一覧項目） * 承認期限24時間超過で代理承認者へ、さらに24時間… (packages/prjops/src/lib/approvalTimer.ts:4) | normative text absent; current reference: packages/devops/src/db/schema.sql -- -- 根拠: DevOps DOC-INT-04 §3 データ構造（SPEC-INT-050番台） -- データストアはRDB（PostgreSQL想定）。本ファイルは全テーブル定義の正本。 -- 変更時は通常のPRレビュー… (packages/devops/src/db/schema.sql:3) |
| SPEC-INT-051 | normative text absent; current reference: packages/prjops/src/agents/AGT07_verifier.ts * * 根拠: REQ-019 配信前検証 / SPEC-INT-051 * AGT-07は配信前に次を機械検証する: * (a) レポート内数値と正本データの一致 (packages/prjops/src/agents/AGT07_verifier.ts:4) | normative text absent; current reference: 根拠: * - PrjOps SPEC-INT-051 (c): プレースホルダ（{{ }} / undefined / null の出現ゼロ検査）。 * - PrjOps SPEC-INT-051 (a): レポートHTML内の data-src="{path}#{field}" 属性付き数値を… (packages/shared/src/html/htmlSanitizeCheck.ts:5) |
| SPEC-INT-052 | normative text absent; current reference: packages/prjops/src/agents/AGT05_distributor.ts * * 根拠: REQ-018 配信 / SPEC-INT-052 冪等配信 / ADR-0014 REQ-042 SPEC-INT-069 AC-042-1 * 承認済み（PRF-04/05）または検… (packages/prjops/src/agents/AGT05_distributor.ts:4) | normative text absent; current reference: return `PRJ-${pad(seq, 3)}`; } /** DevOps: INC-nnn（SPEC-INT-052） */ export function formatIncidentId(seq: number): string { return `INC-${pad(seq, 4)… (packages/shared/src/ids.ts:95) |
| SPEC-INT-053 | normative text absent; current reference: 根拠: * - PrjOps REQ-020/021, SPEC-INT-053: 全エージェント入出力・人間介入を追記型で記録、改変不可、5年保持。 * - DevOps REQ-028, SPEC-INT-056: 全エージェント判断・人間承認・権限操作を追記専用ログに記録、1年保持、 * U… (packages/shared/src/auditLog.ts:5) | normative text absent; current reference: packages/devops/src/agents/AGT_SEC.ts * * 根拠: REQ-018 JIT権限付与と自動失効 / REQ-019 月次棚卸し / SPEC-INT-032 / SPEC-INT-053 * 妥当性チェック（決定的ロジック）: 申請者の所属プロジェクト一致、理… (packages/devops/src/agents/AGT_SEC.ts:4) |
| SPEC-INT-054 | normative text absent; current reference: 根拠: * - PrjOps SPEC-INT-054（営業日カレンダー。「第n営業日」判定の唯一の根拠） * - PrjOps DOC-02 §2（月次=毎月第1営業日、四半期=四半期初月第3営業日） * - DevOps SPEC-INT-033（AGT-RPTの営業日判定）、SPEC-INT… (packages/shared/src/calendar/businessCalendar.ts:5) | normative text absent; current reference: CREATE INDEX IF NOT EXISTS idx_grants_subject ON grants (subject); -- SPEC-INT-054 配信名簿（recipients） CREATE TABLE IF NOT EXISTS recipients ( user_id T… (packages/devops/src/db/schema.sql:141) |
| SPEC-INT-060 | normative text absent; current reference: - PrjOps REQ-035 データ所在: 外部送信されるデータは Anthropic API・Microsoft Graph・GitHub に限定する * （外部通信allowlist: api.anthropic.com, graph.microsoft.com, github.com/a… (packages/shared/src/clients/anthropicClient.ts:13) | normative text absent; current reference: rollback: DROP TABLE graph_subscriptions; -- ADR-0005: LLM使用量台帳（PgCostGuard。SPEC-INT-060: 日次コスト上限をバッチ+WebチャットでSYSTEM全体共有） CREATE TABLE IF NOT EXISTS … (packages/devops/src/db/schema.sql:275) |
| SPEC-INT-061 | normative text absent; current reference: AC-019-1: (a)〜(d)のいずれかがNGのレポートは配信されず、NG理由コード付きで運用担当へ通知される * （SPEC-EXT-039 検証NG・障害通知）。 * SPEC-INT-061エラーコード: E-VER0A〜0D 検証NG(a〜d) */ import { (packages/prjops/src/agents/AGT07_verifier.ts:12) | normative text absent; current reference: 60秒以内要件、本クライアントはそのAPI呼び出し部分を担当）。 * - PrjOps SPEC-EXT-003 / REQ-004(c): GitHub構造化ファイルのコミット/PR受付。 * - DevOps SPEC-INT-061: GitHub App認証（installation to… (packages/shared/src/clients/githubClient.ts:9) |
| SPEC-INT-062 | catalog: Normalize PM events/snapshots and aggregate them into selectable periods with persona filtering. (docs/spec/spec-id-catalog.md:18) | normative text absent; current reference: 2026-07-10 ADR-0007 / SPEC-INT-062 / SPEC-INT-081: pm_events subject_typeの拡張。 ALTER TABLE pm_events DROP CONSTRAINT IF EXISTS pm_events_subject_type_… (packages/devops/src/db/migrations/202607100000_pm_events_subject_type.sql:1) |
| SPEC-INT-063 | catalog: Excel import parser/engine must validate sheets, sanitize text, dedupe by `source_key`, throttle writes, and respect GraphQL rate limits. (docs/spec/spec-id-catalog.md:19) | normative text absent; current reference: 2026-07-09 ADR-0008 / REQ-037 / SPEC-INT-063: Excelインポート台帳。 CREATE TABLE IF NOT EXISTS import_ledger ( source_key TEXT PRIMARY KEY, (packages/devops/src/db/migrations/202607100004_import_ledger.sql:1) |
| SPEC-INT-064 | catalog: Web charts use Recharts 3 client components with tabular numeric display and non-color-only RAG cues. (docs/spec/spec-id-catalog.md:20) | normative text absent; current reference: - PrjOps ASM-002: 報告言語は受信者ごとにja/enを選択可能。既定値は国内企業=ja、海外企業=en。 * - PrjOps DOC-05 §8: stakeholder.preferred_language未設定時は organization.country が JP なら j… (packages/shared/src/language.ts:7) |
| SPEC-INT-068 | catalog: Page agent chat must expose tools by persona, stream reasoning, cap tool steps, and keep outputs to ViewSpec declarations. (docs/spec/spec-id-catalog.md:24) | normative text absent; current reference: 根拠: ADR-0005（WebUIダッシュボード：チャットによる動的表示切替）/ * ADR-0013 / REQ-041 / SPEC-INT-068 / AC-041-1。POST /api/chat — * 本ファイルは本番用DI（auth() + pg.Pool + createAnth… (packages/web/src/app/api/chat/route.ts:5) |

## Registry-to-registry substring containment pairs

| Short | Long |
| --- | --- |
| ISS-01 | ISS-010 |
