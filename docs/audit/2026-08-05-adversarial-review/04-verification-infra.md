<!-- 根拠: PrjOps:REQ-043, DevOps:REQ-033, ADR-0006 -->

# 04 検証基盤の監査（ADV-VER）

反証対象の主張: 「CI green = 品質保証が成立している。トレーサビリティゲートと検証レポートは信頼できる」。

**判定: 反証成立。** 本日 `mise run ci` は実際に green（exit 0、1,764+ テスト合格）だが、この green が保証するのは lint/format/型/ビルド/実行されたテストの合否と、**REQ/SPEC-INT/TH の src 側「コメント参照」の存在**までである。AC/SPEC-EXT の実装、テスト側参照、カバレッジ水準、実 DB 経路、実環境検証はいずれもゲートされていない。

旧監査から CI パイプライン構成とホットスポットのカバレッジは実質改善した。残るのは「report-only カテゴリの放置」「閾値なしカバレッジ」「実 DB テストの恒久 skip」という三つの空洞である。

## ADV-VER-001 [High] AC / SPEC-EXT は report-only で exit code に影響しない

- 実証: `packages/traceability/src/verifyTraceability.ts:250-252` — `collectFailureMessages` の `mandatory = ["REQ","SPEC-INT","TH"]`。
- 現 matrix で **PrjOps AC 11 件・DevOps AC 16 件・SPEC-EXT 計 13 件が source 参照ゼロ**のまま exit 0（06 章 D3 で実測）。同ファイル 10-11 行のヘッダは DOC-05 §11「全 SPEC-INT について対応する REQ の AC を検証するテストが存在し合格」の機械チェックを自称するが、AC は src/test どちらの欠落もゲートしない。
- 影響: 「green = 受入条件が実装・検証済み」は成立しない。工数 M。

## ADV-VER-002 [High] テスト側参照は全カテゴリで非ゲート

- 実証: 同上 250-252 行。`missingFromSrc` のみ収集し、`missingFromTest` はどのカテゴリでも失敗にならない。
- 実測: SPEC-INT のテスト参照は PrjOps 81% / DevOps 58%、REQ は 71% / 67%。実装コメントに ID を書けばテスト 0 件でも green。「仕様⇔検証コード」の片翼が事実上ノーチェック。工数 M。

## ADV-VER-003 [High] substring マッチ: コメント 1 行で「実装済み」扱いとなり、0% カバレッジと両立する

- 実証: `verifyTraceability.ts:221-231`（buildCorpus はコメント込みで全文連結）、`:536-544`（corpus 内 1 出現で inSrc 判定）。
- **実データでの反例**: `packages/devops/src/agents/AGT_BLD.ts` は **カバレッジ lines 0% / functions 0%** だが、ヘッダコメントの ID 列挙により当該 REQ/SPEC-INT は「source 参照あり 100%」に計上される。`AGT_RPT.ts:4-8` のような複数 ID 一括列挙ヘッダは 1 ファイルで多数 ID を充足する。さらに `verifyTraceability.ts:4-5` 自身の docstring が PrjOps:REQ-043 / DevOps:REQ-033 の src 証拠を自給する（自己言及的充足）。
- matrix の注記（構文上の接続のみ）は正直だが、ゲートとしての exit code はその開示より大幅に緩い。工数 L。

## ADV-VER-004 [Medium] 名前空間なし bare ID は未知でも素通りする

- 実証: `verifyTraceability.ts:184-191`（barePattern は bare ID を無条件に収集し index 在籍チェックをしない。失敗するのは colliding ID の曖昧参照のみ）、`:601-611`（basisHeaderFailures は `根拠:` + `(REQ|SPEC-INT|AC|ADR)-\d{3,4}` の正規表現のみ）。
- 反例: `根拠: REQ-950`（両 index に存在しない番号）を新規ファイルに書くと、根拠ヘッダガード合格・名前空間ガード非検出・カタログガード非対象で green になる。テスト（`tests/verifyTraceability.test.ts:633,664,692,701`）は unknown canonical / unknown namespace / malformed を検証するが、「bare かつ未知の ID」ケースが欠落している。
- 付随: 非衝突 bare ID はファイルの文脈と無関係に所属 system の証拠として計上される（web のコメントが DevOps AC を充足し得る）。工数 S。

## ADV-VER-005 [Medium] 根拠ヘッダガードの走査範囲が 2 ディレクトリのみ

- 実証: `verifyTraceability.ts:601-604` — `packages/shared/src/reporting` と `packages/server/src` のみ。
- 影響: AGENTS.md 設計原則 3「新規ファイルの根拠 ID ヘッダを `mise run traceability` が検証する」は prjops / devops / web / traceability / shared(reporting 以外) には適用されていない。規約の機械保証範囲が自己申告より大幅に狭い。工数 S。

## ADV-VER-006 [Medium] dispositions は構造チェックのみで欠落 ID と連動しない

- 実証: `verifyTraceability.ts:470-514`（status enum・配列非空・basis ファイル実在・owner 非空のみ）。登録は PrjOps 3 件（REQ-011, REQ-030, SPEC-INT-010）、**DevOps 0 件**。
- 影響: source 参照なしの AC 27 件・SPEC-EXT 13 件のうち disposition を持つものは 0。「未実装だが処置記録がある」ことすら要求されず、`completed` 欄の主張は機械検証されない。工数 M。

## ADV-VER-007 [High] カバレッジ閾値がゼロ — test:coverage は装飾

- 実証: `packages/{shared,prjops,devops,server}/vitest.config.ts` に `thresholds` なし。`packages/web/vitest.config.ts` は coverage 設定自体がなく json-summary も未出力。
- 影響: カバレッジがどれだけ低下しても CI は fail しない。web は coverage-summary.json すら生成されず、パッケージ間比較・回帰検知の基盤がない。工数 S（設定追加のみ、ただし現水準の合意が必要）。

## ADV-VER-008 [Medium] リスク箇所の実測カバレッジ

本日の `coverage-summary.json` 実測:

- `packages/shared/src/reporting/`: **calculateReportMetrics 0% / finalizeReportJson 0% / printReportSchema 0% / printReportSlotsSchema 0% / validateReportJson 0%** — `report-generation.yml:47-52` が本番の週次 cron で直接実行する CLI 群が依然ユニットテスト 0%（旧監査から残存）。reportGenerator 96.8% / reportValidation 90.6% は良好。
- `packages/devops/src/agents/`: **AGT_BLD 0% (0/12)**、AGT_CHG lines 43.8% / funcs 16.7%、AGT_INC lines 58.8% / funcs 20%。
- server 全体 functions 76.5% / branches 77.0%。
- 影響: green の裏で「LLM を呼ぶ DevOps agents」と「レポート生成 CLI」という運用クリティカル経路が無検証または希薄。ただしこれらは 01 章のとおり大半が未結線であり、**カバレッジ 0% は未実装の症状であって原因ではない**。工数 M。

## ADV-VER-009 [Medium] skipped 7 件はすべて実 DB 経路で、CI では恒久 skip

- 内訳（06 章 D1 の 6+1 skipped と一致）:
  - `packages/devops/tests/reportSnapshotsSchema.test.ts:17,65` — report_snapshots migration 検証（SPEC-INT-055/081）
  - `packages/devops/tests/recipientsStableSubjectSchema.test.ts:31,78` — recipients stable subject スキーマ
  - `packages/devops/tests/recipientBackfill.test.ts:384,387` — legacy recipient backfill 実行系（SPEC-INT-054）
  - `packages/web/tests/dataApiPoolRealPgLoad.test.ts:66` — 実 PG pool 負荷（REQ-041/SPEC-INT-068、AUD-REL-001 是正証跡）
- ゲート条件は `AIOPS_TEST_DATABASE_NAME` / `AIOPS_LOAD_TEST_DATABASE_URL`。`ci.yml` に Postgres service も env 設定もない → **CI で一度も実行されず、skip のまま green に合算される**。
- 皮肉なことに、スキーマ・migration・backfill・接続数上限という回帰が最も痛い層が対象である。**本レビューの D5 で実 DB を用意すればこれらが動くことは示された**（06 章）ので、CI に Postgres service を足すだけで塞げる。工数 S。

## ADV-VER-010 [Medium] CI から呼ばれない検証資産と壊れたエントリポイント

- `verification/run_db_integration.sh` は `.github/`・`.mise.toml`・全 package.json のどこからも参照されない（旧監査から残存）。**本レビューが初めて実行し、PASS することを確認した**（06 章 D5）。価値ある資産が CI 外に放置されている。
- **本レビューで独自確認**: `package.json:22` の `"verify:all": "bash verification/run_verification.sh"` が指す `verification/run_verification.sh` は**存在しない**。Definition of Done 文書群から参照可能な位置に壊れたエントリポイントが残る。
- `acceptance:validate`（`verification/acceptance-manifest.json` 検証）も CI・governance:check に未接続。工数 S。

## ADV-VER-011 [Low] 「mise run ci = CI と同一」が不成立

- 実証: `.mise.toml:47-49` vs `.github/workflows/ci.yml:22-31`。差分は (a) `pnpm audit --prod --audit-level high` が GH CI のみ、(b) `actionlint` task は定義されている（`.mise.toml:6-8`）が **ci.yml にも mise ci にも組み込まれていない**（旧監査指摘が未解消）、(c) 実行順の相違。
- 影響: ローカル DoD green と GitHub green が同値でない。工数 S。

## ADV-VER-012 [Medium] VERIFICATION_REPORT の鮮度と実環境残件

- `verification/VERIFICATION_REPORT.md:3` — 版 1.2 / 更新 2026-07-13。本日時点で約 3 週間更新なく、直近 main の変更（GitHub App token provider、Graph 強化、audit retention partitions）が反映されていない。
- `requires-real-env` 残件（§0.2, §5）: 認証済み dashboard、実 LLM chat、実 DB 付き server 起動、Graph/Teams/GitHub webhook 実到達、report-generation 実 POST — すべて未実施。
- `runbooks/e2e-real-environment.md:119-130` のチェックリストは**全項目未チェック**、実行記録ゼロ。
- **本レビューが一部を埋めた**: 実 DB 付き server 起動・schema 適用・webhook 署名検証・イベント消化は 06 章で実測済み。VERIFICATION_REPORT にこの結果を取り込む価値がある。工数 S（記録更新）〜L（残る実環境項目）。

## ADV-VER-013 [Low] 規約文書と検証実態の乖離

- ~~`AGENTS.md` のツールバージョン記述が実態とずれている~~ — **本所見は誤りだった。撤回する。**
  レビュー対象である origin/main の `AGENTS.md:8` は「Node 22 / pnpm 11」と記載しており、`.mise.toml:3-4`（node 22 / pnpm 11.13.0）と一致している。
  誤りの原因は、190 コミット遅れたローカルブランチ `agent/T-P0-04` の `AGENTS.md` を読んだこと。**レビュー対象コミットの版を読むという本レビュー自身の前提を、この 1 点で破っていた。**
  PR #122 のレビューで指摘され、実際に `git show origin/main:AGENTS.md` で確認して撤回した。
- 「describe/it タイトルに仕様 ID を含める」規約: verifier のテスト側判定はファイル全文の substring（コメント含む）でありタイトル位置は非検証。
- ADR ガード（`verifyTraceability.ts:614-629`）は「参照された ADR ファイルが存在するか」のみで、変更が ADR 決定に反していないかは検証対象外。matrix の「存在しない ADR 参照: —」を設計整合の保証と読むのは誤り。

## 旧監査からの解消状況

| 旧指摘                                                | 現状                                                                                                     |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| CI に lint/format がない                              | **解消**（`ci.yml:26-27`）。加えて `pnpm audit --prod --audit-level high` も追加                         |
| web の test:coverage が `--if-present` で静黙スキップ | **解消**。script 追加済み、06 章 D1 で 303 件の実行とカバレッジ算出を実測                                |
| server の coverage.include 未設定で数値が甘い         | **解消**（`packages/server/vitest.config.ts` に `include: ["src/**/*.ts"]`）                             |
| claudeAgentClient 5.88%                               | **解消** — lines 100%（21/21）。専用テストが read-only 三重防御を fail-closed で検証                     |
| prjops AGT-02/03/04 が 0%                             | **解消** — いずれも lines 100%                                                                           |
| VERIFICATION_REPORT の 359/750/892 件数矛盾           | **解消** — `:113-121` で 750 件を明示撤回し 359 件を過去スナップショットと定義。ただし鮮度は ADV-VER-012 |
| actionlint が CI 未接続                               | **未解消**（ADV-VER-011）                                                                                |
| run_db_integration.sh が CI 未接続                    | **未解消**（ADV-VER-010）                                                                                |

## 総括

CI green が保証するもの: lint/format/型/ビルド合格、実行された 1,764+ テストの合否、REQ/SPEC-INT/TH の src コメント参照の存在、ID 名前空間・カタログの構造整合、gitleaks、依存監査。

保証しないもの: AC/SPEC-EXT の実装とテスト（001/002）、参照の実体（003/004）、カバレッジ水準（007/008）、実 DB・実環境経路（009/010/012）。

旧監査が「規約文書は一流だが、規約を機械が強制する層が一段欠けている」と表現した構造は、**強制層が明確に厚くなった一方で、最後の一段（意味的整合と実環境）はなお欠けている**というのが現時点の正確な描写である。
