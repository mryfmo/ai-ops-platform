# 04. テスト・検証ギャップ 監査レポート

- 監査日: 2026-07-11 / 監査対象コミット: `39b95944e9f17dffce500c21f40989f6fa86092d`
- 監査観点: 「テストが通っている」ことと「本番で動くことが検証された」ことの距離を測る。

## 1. 対象範囲と監査観点

全パッケージのテスト（約 113 ファイル）、カバレッジ実測値、verification/VERIFICATION_REPORT.md の主張、CI ゲート構成。

## 2. あるべき姿

- セキュリティ保証を担うコード（read-only 強制・サニタイズ・権限フィルタ）はカバレッジ例外にしない
- 「検証済み」を掲げる文書は内部矛盾なく、検証範囲の限定を定量的に示す（現行文書は正直な二層開示をしており方向性は正しい）
- 受入基準（AC）に性能値がある場合、その検証手段（負荷試験）が存在する
- CI で強制されないゲートは存在しないのと同じ（ローカル手順は忘れられる）

## 3. 指摘事項サマリ

| ID          | タイトル                                                              | Severity | 工数 |
| ----------- | --------------------------------------------------------------------- | -------- | ---- |
| AUD-VER-001 | claudeAgentClient の read-only 強制が実質未テスト（カバレッジ 5.88%） | High     | M    |
| AUD-VER-002 | LLM 経路エージェント（AGT-02/03/04）がカバレッジ 0%                   | High     | M    |
| AUD-VER-003 | 実環境 E2E（実 DB・実 LLM・実 Graph/Teams・Excel 取込）が未実施       | High     | L    |
| AUD-VER-004 | 負荷・性能・セキュリティテストが存在しない                            | Medium   | L    |
| AUD-VER-005 | CI が lint / format を実行しない（ローカル ci タスクとの乖離）        | Medium   | S    |
| AUD-VER-006 | VERIFICATION_REPORT の内部矛盾（359 件 vs 750 件）と陳腐化            | Medium   | S    |
| AUD-VER-007 | traceability パッケージ自体にテストがない                             | Low      | S    |

## 4. 個別指摘

### AUD-VER-001: claudeAgentClient の read-only 強制が実質未テスト

| Severity | 工数 | 関連仕様                                       | 関連指摘    |
| -------- | ---- | ---------------------------------------------- | ----------- |
| High     | M    | AC-002b（read-only diff 提案）の受入検証が不在 | AUD-DEP-003 |

**現状**: `claudeAgentClient.ts` はカバレッジ 5.88% で専用テストファイルがない。allowedTools/disallowedTools/canUseTool の三重書込防止は**このシステムで唯一エージェント的自律実行を許す箇所の安全装置**だが、その動作をテストが一切検証していない。しかも依存する claude-agent-sdk は pre-1.0（現行 0.1.77、最新 0.3.207）でオプション名変更があり得るとヘッダ自身が警告している。
**根拠**: `packages/shared/src/clients/claudeAgentClient.ts`、カバレッジ実測（shared 総計 88.3% に対し当ファイル 5.88%）
**あるべき姿**: 安全装置は最優先のテスト対象。SDK 更新で deny リストが無言で無効化されるリグレッションを検出できること。
**推奨対応**: canUseTool フックに書込系ツール名を与えて deny されること、disallowedTools の網羅、diff パースのフォールバックをモック SDK で検証するテストを追加（ネットワーク不要で書ける構造は既にある）。

### AUD-VER-002: LLM 経路エージェントがカバレッジ 0%

| Severity | 工数 | 関連仕様                                       | 関連指摘    |
| -------- | ---- | ---------------------------------------------- | ----------- |
| High     | M    | REQ 系（収集・分析・報告生成）の結線検証が不在 | AUD-VER-003 |

**現状**: AGT-02（収集）/AGT-03（分析）/AGT-04（報告生成）が 0%。lib/ の純粋関数（94-100%）は厚くテストされているが、「LLM 応答を受けてどの分岐に入るか」「サニタイズが呼ばれる順序」「監査ログがどの branch で書かれるか」という結線自体が未検証。ヘッダは「ネットワーク SDK が必要なためオフライン検証除外」とするが、AnthropicStructuredClient は注入可能でありモックで結線テストは書ける（実際 anthropicClient.test.ts は 96% をモックで達成している）。
**根拠**: `packages/prjops/src/agents/AGT02_collector.ts`（0%）、`AGT03_analyzer.ts`（0%）、`AGT04_reportGenerator.ts`（0%）
**推奨対応**: モック AnthropicStructuredClient を注入し、ingestOne の clarify/accept/escalate 3 分岐、escalation 時の監査ログ、AGT-04 の数値ストリップ結線を検証するテストを追加。設計原則 7（クライアント注入可能）が既に満たされているため障害はない。

### AUD-VER-003: 実環境 E2E が未実施

| Severity | 工数 | 関連仕様                                        | 関連指摘    |
| -------- | ---- | ----------------------------------------------- | ----------- |
| High     | L    | リリース基準（パイロット 5PJ×2 週間）到達の前提 | AUD-OPS-007 |

**現状**: VERIFICATION_REPORT が自己申告するとおり、実 PostgreSQL での /readyz・マイグレーション、実 LLM 呼び出し、実 Graph/Teams webhook 到達、実 /reports/ingest POST、Excel 取込（ADR-0008、検証時点でコード自体が対象外）はすべて未実施。`verification/postgres.compose.yml` と `run_db_integration.sh`、`runbooks/e2e-real-environment.md` という実施手段は用意済みだが実行記録がない。
**根拠**: `verification/VERIFICATION_REPORT.md`（requires-real-env 節）
**推奨対応**: e2e-real-environment.md のチェックリストを 1 周実行し、結果を verification/ に日付付きで追記する。特に Graph サブスクリプション作成 → 通知受信 →channel_messages 格納の一連と、マイグレーション済み DB での全スケジューラタスク起動を優先。

### AUD-VER-004: 負荷・性能・セキュリティテストが存在しない

| Severity | 工数 | 関連仕様                                     | 関連指摘                 |
| -------- | ---- | -------------------------------------------- | ------------------------ |
| Medium   | L    | AC-018-1（2000 通/2h）等の性能受入が検証不能 | AUD-IMP-004, AUD-REL-001 |

**現状**: 負荷試験・性能試験・自動セキュリティテスト（DAST 等）に該当するものがない。AUD-REL-001（接続リーク）のような負荷でのみ顕在化する欠陥を検出する層が存在しない。
**推奨対応**: 本格的な負荷試験基盤は不要。(a) AC に数値がある項目（2000 通/2h、ingest→dispatch 5 分以内）への k6 等による単発測定、(b) web データ API への数百リクエスト連投で接続数を観測する軽量チェック、の 2 点で最低線を満たす。

### AUD-VER-005: CI が lint / format を実行しない

| Severity | 工数 | 関連仕様                                                              | 関連指摘    |
| -------- | ---- | --------------------------------------------------------------------- | ----------- |
| Medium   | S    | AGENTS.md「Definition of Done: mise run ci が green」と CI 実体の乖離 | AUD-TRC-001 |

**現状**: `.github/workflows/ci.yml` は governance → install → build → typecheck → test:coverage → traceability のみ実行（実測確認済み）。lint と format はローカルの `mise run ci` にしか存在せず、CI では強制されない。AI エージェントが PR を作る運用では「ローカルで走らせたはず」は成立しない。
**根拠**: `.github/workflows/ci.yml:21-27`、`.mise.toml`（ci タスク定義）
**推奨対応**: ci.yml に `pnpm run lint` と `pnpm run format`（チェックモード）の 2 ステップを追加（数行）。

### AUD-VER-006: VERIFICATION_REPORT の内部矛盾と陳腐化

| Severity | 工数 | 関連仕様 | 関連指摘    |
| -------- | ---- | -------- | ----------- |
| Medium   | S    | —        | AUD-TRC-005 |

**現状**: 同一文書内で §2 は「全 359 件合格」（72,101,115 行）、§6 は「750 件全て合格（mise run ci を実際に実行して確認済み）」（224 行）と矛盾する。また spec-ids JSON の件数（現行: PrjOps REQ34 等）と文書中の件数表（REQ27 等）が乖離。検証文書は監査証跡なので、数字の矛盾は文書全体の信頼性を毀損する。
**根拠**: `verification/VERIFICATION_REPORT.md:72,101,115,224`
**推奨対応**: 359（検証シム実行分）と 750（mise run ci 全体）の関係を 1 段落で定義し直し、件数表を現行 JSON から再生成。以後は件数を手書きせず生成物参照にする。

### AUD-VER-007: traceability パッケージ自体にテストがない

| Severity | 工数 | 関連仕様 | 関連指摘    |
| -------- | ---- | -------- | ----------- |
| Low      | S    | —        | AUD-TRC-001 |

**現状**: CI の合否を決める検証ツール自身がテスト 0 件。照合ロジックのリグレッション（例: corpus 構築のパス漏れ）が起きても検出されず、「全 ID 参照済み」が偽陽性で通り得る。
**推奨対応**: 「存在しない ID を混ぜたフィクスチャで fail すること」「テスト側欠落が missingFromTest に載ること」の 2 ケースだけでも追加。

## 5. 良好事項

- lib/ 純粋関数の境界値テストは厚く（多くが 90-100%）、describe/it への仕様 ID 記載規約も守られている。
- HTTP ハンドラは `app.request()` によるポートレスなインテグレーションテストが 136 件あり、server の結線検証としては水準以上。
- VERIFICATION_REPORT が「検証済み」と「実環境待ち」を明示的に二層開示している姿勢は正しい（本監査の指摘は開示内容の矛盾と未実施項目の残量であり、開示方式ではない）。
- 実環境検証の手段（postgres.compose.yml / run_db_integration.sh / e2e runbook）は準備済みで、残るのは実行のみ。
