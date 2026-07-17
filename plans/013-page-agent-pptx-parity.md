# Plan 013: 内部ページエージェントをPPTX/ワイヤーフレームの約束どおり全ペルソナで動かし、alibaba/page-agent不採用を確定する

> Planned at: `main` commit `017f609b0274007178f8796d6142bbce990465fe`
> Decision source: `docs/adr/0018-page-agent-architecture.md`（本Planと同一PRで収載。用語・採用/不採用・新規仕様ID定義の正本。Planは決定を参照するのみとする）
> Executor: Claude Code Fable-5 (effort: high) — orchestrator / Codex gpt-5.6-sol (effort: high) — autonomous worker agent

## Status

`TODO`

- Priority: P1
- Effort: L
- Risk: MEDIUM — 認可済みLLM経路の到達範囲拡大（4ペルソナから8ペルソナ相当へ）と、会話本文の監査保存を同時に扱う。外部通信先・依存・DBスキーマの変更はない。
- Depends on: 001（DONE。監査台帳 `PgAuditLog` を使用）。`show_project_board` の公開再開はPlan 010 `P010-F02-T10..T14` の成果到達後の別作業であり、本Planはそれに依存しない。
- Category: direction / correctness / security
- Wireframe/抽出: `ai-ops-platform-wireframe_4.html`（タイトル表記v3.0が正。ファイル名 `_4` は連番）。パネルUI・フッター文言・ショートカットの正本として参照する。
- Official references checked: 2026-07-17（UTC）。alibaba/page-agent v1.12.2（tagコミット `5485e8cffb44`、MIT）を10:43に一次情報で確認し、12:37にtag一覧を再確認した。不採用のため依存追加はない。

## Goal

ADR-0018の決定を実装し、「解決可能なすべてのペルソナが、ダッシュボードの内部ページエージェントパネルから、権限内の画面へ自然文で到達でき、会話が追記専用監査ログに記録される」状態にする。PPTXスライド（リポジトリ正本12枚版スライド5、添付14枚版スライド11・14）とワイヤーフレームのフッター文言が約束する挙動を、テストで実証可能な形で成立させる。alibaba/page-agent由来のコード・依存は0行のままとする。

## Scope

含むもの:

- ADR-0018収載とplans/README登録を1本の決定PRで行うPhase 0
- PrjOps `PRF-01`/`PRF-02`、DevOps `PRF-M`/`PRF-L` の「準備中」フォールバック廃止と `DashboardClient`＋パネル表示（Phase 1）
- `show_project_board` の公開ゲート（`PROJECT_BOARD_DATA_AVAILABLE = false`）（Phase 1）
- DevOps `PRF-L` への `showAgentActivity` 公開（tools・data route・文書）（Phase 2）
- 会話の追記専用監査（`chatHandler` と脅威モデル§2の追記）（Phase 3）
- パネルUIのワイヤーフレーム準拠（フローティングFAB、⌘K/Ctrl+K、サジェスト、フッター文言）（Phase 4）
- 新規仕様ID6件のカタログ/traceability登録（各フェーズの初参照コードと同一PR）と `docs/reference/page-agent-tools.md` / `docs/guide/dashboard.md` / `verification/VERIFICATION_REPORT.md` の整合

含まないもの:

- alibaba/page-agent（本体・Chrome拡張・MCP Server）の導入（ADR-0018決定1）
- `projectBoard` データ取得経路の実装（Plan 010 `P010-F02-T10..T14` の領分。本Planは公開ゲートのみ）
- PRF-01/02専用のリッチビュー（ワイヤーフレームのREQ-011/012相当レイアウトのダッシュボード移植）とダッシュボードの日英切替（Open Questions TBD(HUMAN)-2）
- ADR-0013・ADR-0005の変更、`teamsConversationAgent` 系・Teams経路の変更
- DBスキーマ変更、新規環境変数、新規依存の追加
- 実LLM・実tenantを使うsmoke（`verification/VERIFICATION_REPORT.md` の `requires-real-env` 区分に従い将来のENV課題として記録）

## Assumptions

- 仕様値はADR-0018が正本であり、orchestrator/workerは変更しない。変更が必要ならP013-F00-T04の決定PRを改訂し、owner承認を得るまでSTOPする。
- 本Planの現状分析はZIPスナップショットで実測した。P013-F00-T01のdrift checkで実行時HEADと照合し、Current Stateの `file:line` が1件でもずれたら実装せずPlan改訂へ戻す。
- 添付PPTX（14枚版、SHA-256先頭 `45999c34`）はリポジトリ正本（12枚版、SHA-256先頭 `b5451e04` = P010-F00-T03保持）と異なる第3の資料である。ページエージェントの約束は両版で矛盾しないため本Planの目的に使えるが、現在形の未実装主張（14枚版スライド13・14の一部）を仕様根拠にしない。矛盾時はリポジトリ内文書を優先する。
- 実装体制: orchestrator（Claude Code Fable-5）がtask発行・diff/テスト証跡の直接確認・受入・PRを担い、worker（Codex gpt-5.6-sol）が実装・テスト・文書更新を担う。workerの完了報告は要約で受理せず、orchestratorがdiffと実行ログを読む。`Owner:` が曖昧なtaskはorchestratorが担う。
- Git workflow: フェーズごとにブランチ `agent/p013-f0N-<slug>` を作り、フェーズ1本のPR（`ai-generated` ラベル・draft）で受け入れる。人間reviewer承認前にmergeしない。commitはConventional Commits。taskのAllowed files以外を変更せず、必要になったらSTOPして報告する。plans/READMEの横断規則（テスト先行、`mise run ci`、`git diff --check`、秘密値の不記載）を各PRで満たす。
- ファイル交差の直列化: Phase 1〜4は `packages/web` の同系ファイルを触るため並行せず番号順に実行する。Plan 010/012のtaskで `packages/web/src/server/chat/**`、`packages/web/src/app/dashboard/**`、`packages/web/src/components/**`、`docs/reference/page-agent-tools.md` を触るものとは同時にASSIGNしない。
- Definition of Doneは `mise run ci`。direct pnpm成功だけで最終DoDを代替しない。

## Design

決定の全文はADR-0018にあり、ここでは実装配置・検出した問題箇所・登録計画だけを規定する。

### 1. 実装配置

- **全ペルソナ到達性（決定2）**: `packages/web/src/app/dashboard/page.tsx` の末尾フォールバック（178行目の「準備中」Card）を、`DashboardClient` 呼び出し（`initialViewSpec: { kind: "projectList" }`、初期データは `listScopedProjectSummaries` / `listDevOpsScopedProjectSummaries` で構築）へ置き換える。`/app/api/data/projects` は全ドメイン対応済み（`projectsHandler.ts` 30-41行目）、`/app/api/data/timeseries` は `choosePersona` のフォールバックとペルソナ別スコープで全ペルソナ対応済み（`timeseriesHandler.ts` 61-86行目）のため、データ層の新設は不要。
- **boardゲート（決定4）**: `packages/web/src/server/chat/tools.ts` の `buildToolsForPersona`（167行目）で、`show_project_board` の公開を同ファイル内定数 `PROJECT_BOARD_DATA_AVAILABLE`（`false`、根拠コメントに `DashboardClient.tsx` の `E-VIEW02` とPlan 010 `P010-F02-T10..T14` を記載）で条件化する。tool実装 `buildShowProjectBoardTool` とスコープ検査は削除しない。
- **PRF-L公開（決定3）**: `tools.ts` の `isDevopsManager` 判定を `showAgentActivity` 用に `PRF-G | PRF-L` へ広げる関数 `canSeeAgentActivity` に置き換え、`/app/api/data/agent-activity` の認可（`agentActivityHandler.ts` と route）を同じ集合へ拡張する。データのスコープ制御は既存 `agentActivityData.ts` の `isProjectInScope` に委ねる（同ファイル16-18行目の残課題コメントを解消し、コメントも更新する）。
- **会話監査（決定5）**: `packages/web/src/server/chat/chatHandler.ts` の `onFinish`（184行目）で、`PrjOps:SPEC-INT-090` / `DevOps:SPEC-INT-090` に定義したレコードを `auditLog.append` で1件追記する。`auditLog` / `traceIdProvider` は既に `route.ts` が本番結線済み（`auditLogForDomain` 56行目、`traceIdProvider` 57行目）。追記失敗はエラーとして記録し黙殺しない。保存する文字列はすべて `sanitizeForLlmInput` 適用後とする。
- **パネルUX（決定6）**: `packages/web/src/components/chat/ChatPanel.tsx` をフローティングFAB＋パネル構成へ変更し、`DashboardClient.tsx` の右カラム（353行目付近）を廃止して `position: fixed` の描画に切り替える。⌘K/Ctrl+Kで開閉、Escで閉じる。サジェストは公開ToolSetのtool名から決定的に導出した固定文言チップ、フッターはワイヤーフレームの文言「権限フィルタ適用済み: このペルソナで見られる画面のみ切替可能。会話は監査ログに記録されます。」とする。LLM呼び出し契約は変更しない。

### 2. 検出した問題箇所（14件）と対処

すべて一次証跡に基づく。対処列のtask IDが是正の実施点。「決定」はADR-0018で確定済み。

| ID    | 分類       | 問題                                                                                                                                                 | 一次証跡                                                                                                     | 対処                                                                                      |
| ----- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| PA-01 | 名称・境界 | 「page-agent」が内部実装（ADR-0013）とOSSで同名衝突                                                                                                  | `docs/adr/0013-*.md`、OSS README、`docs/spec/threat-model.md` §2のpath名も `page-agent`                      | ADR-0018用語定義。新規文書は「内部ページエージェント」/「OSS page-agent (alibaba)」を使用 |
| PA-02 | 名称・境界 | OSS page-agent (alibaba) のDOM直接操作は設計原則2と「人が決める」境界に対する新規攻撃面で、対応する約束（要件）が資料に存在しない                    | OSS README（tag v1.12.2）、AGENTS.md原則2、両版PPTXとワイヤーフレームの全ページエージェント記述              | 不採用（ADR-0018決定1・根拠表）                                                           |
| PA-03 | 到達性     | PrjOps PRF-01/02とDevOps PRF-M/Lは「準備中」フォールバックでパネル自体が表示されず、PPTX「6ペルソナ到達」とワイヤーフレーム全ビューFABに反する       | `page.tsx:178`（準備中Card）、同9行目コメント、添付PPTXスライド11・14                                        | P013-F01-T01〜T03                                                                         |
| PA-04 | 到達性     | `show_project_board` は全ペルソナへ公開されるが、データ取得が未実装で必ず失敗する（失敗が約束されたtool）                                            | `tools.ts:170`、`DashboardClient.tsx:275`（E-VIEW02）                                                        | P013-F01-T02/T03の公開ゲート。経路実装はPlan 010の領分                                    |
| PA-05 | 到達性     | DevOps PRF-Lへの `showAgentActivity` 公開が残課題のまま（データ層は対応可能と明記済み）                                                              | `tools.ts:14-16`、`agentActivityData.ts:16-18`                                                               | P013-F02-T01〜T03                                                                         |
| PA-06 | 監査       | ワイヤーフレームは「会話は監査ログに記録されます」と約束するが、`chatHandler` の監査追記は価格フォールバック時のみで会話本文は記録されない           | ワイヤーフレームのフッター文言、`chatHandler.ts:135`（唯一のappend）、`PrjOps:REQ-020`                       | P013-F03-T01〜T03                                                                         |
| PA-07 | UI         | パネルはインラインCardで、ワイヤーフレームのフローティングFAB＋パネル・⌘K/Ctrl+K・サジェスト・フッター文言が未実装                                   | `DashboardClient.tsx:353`、`ChatPanel.tsx`（該当実装なし）、ワイヤーフレームのagent-fab定義とkeydownハンドラ | P013-F04-T01〜T03                                                                         |
| PA-08 | 文書       | `docs/reference/page-agent-tools.md` のtool表に `show_project_board` 行がなく、ペルソナマトリクスに4ペルソナしかない（実装と不一致）                 | 同ファイルのToolsとPersona Matrix節、`tools.ts:167-192`                                                      | P013-F01-T04・P013-F02-T03で実装と同一PR更新                                              |
| PA-09 | 資料正本性 | 添付PPTX（14枚版）はリポジトリ正本（12枚版）と不一致で、P010-F00-T03が不採用とした現在形主張を含む。ただしページエージェントの約束は両版で矛盾しない | 両ファイルの実測SHA-256、`plans/010` P010-F00-T03、両版の該当スライド抽出                                    | Assumptionsで扱いを固定                                                                   |
| PA-10 | 資料正本性 | ワイヤーフレームはファイル名 `_4` とタイトル `v3.0` が不一致で、リポジトリ内に言及0件。版対応が未記録                                                | ファイル名とtitle要素、`git grep` 0件                                                                        | P013-F05-T01で版対応を記録                                                                |
| PA-11 | 横断統制   | ADR番号0017は `P012-F00-T03` のAllowed filesが予約済みで、0017採番は将来衝突する                                                                     | `plans/012` P012-F00-T03                                                                                     | ADR-0018として採番し欠番0017を保持                                                        |
| PA-12 | スコープ   | ワイヤーフレームのPRF-01/02向けリッチビュー（REQ-011/012相当レイアウト）とダッシュボード日英切替は未実装だが、ページエージェントの約束の範囲外       | ワイヤーフレームのmember/leaderビューとJA/EN切替、`views/` の実在4コンポーネント                             | 本Plan対象外。TBD(HUMAN)-2で別Plan化を提起                                                |
| PA-13 | 検証       | 実LLMを用いたページエージェントのsmokeは未実施（環境に `ANTHROPIC_API_KEY` なし）                                                                    | `verification/VERIFICATION_REPORT.md` §0.1                                                                   | P013-F05-T01で `requires-real-env` として追記                                             |
| PA-14 | 監査       | 会話監査の追加により監査ログへ会話本文（サニタイズ済み）が保存され、保存データ面が増えるが脅威モデル§2に未反映                                       | `docs/spec/threat-model.md:29`（page-agent行のside effect欄）                                                | P013-F03-T03                                                                              |

### 3. 仕様ID登録計画

新規6 ID（定義正本はADR-0018決定7）。`verifyTraceability.ts` は参照0件のREQ/SPEC-INTをエラーにするため、カタログ・`packages/traceability/spec-ids/*.json` への登録は初参照コードと同一フェーズPRで行う: `PrjOps:REQ-044` `DevOps:REQ-044` `PrjOps:AC-044-1` `DevOps:AC-044-1` はPhase 1、`PrjOps:SPEC-INT-090` `DevOps:SPEC-INT-090` はPhase 3。カタログのCanonical source列はADR-0018の該当アンカー（例: `../adr/0018-page-agent-architecture.md#prjopsreq-044`）へリンクする。既存 `REQ-041` / `SPEC-INT-068` / `AC-041-1` の行は変更しない。

## Current State

基準はZIPスナップショット（`ai-ops-platform-main.zip`、679エントリ）。以下はすべて実測。実行時HEADとの照合はP013-F00-T01で行う。

- `plans/` は001〜012。次の空き番号は013。`docs/adr/` は0001〜0016で、0017は `P012-F00-T03` が予約済み。仕様ID最大値は `REQ-043` / `SPEC-INT-084` / `AC-043`。
- 内部ページエージェントの実装と根拠ID: `packages/web/src/server/chat/tools.ts`（ヘッダにADR-0005/ADR-0013/REQ-041/SPEC-INT-068/AC-041-1）、`chatHandler.ts`（同）、`ChatPanel.tsx`（同）。テストは `packages/web/tests/chat/`（ChatPanel.test.tsx、chatRoute.test.ts、systemPrompt.test.ts、tools.test.ts）。
- ペルソナモデル（`personaResolver.ts:26-29`）: `{ domain: "prjops", profile: PRF-01〜05 }` / `{ domain: "investor", profile: "investor" }`（PRF-05はinvestorとして解決、同109行目）/ `{ domain: "devops", profile: PRF-M|L|G }`。ペルソナ選択UIは実装済み（`PersonaSelector`、`personaSelectionHandler.ts`）。
- `page.tsx` の分岐: PRF-04（97行目）・investor（114行目）・PRF-03（128行目）・PRF-G（142行目）のみ `DashboardClient` を表示し、その他は178行目の「対応するビューは準備中です」Cardで終わる（パネルなし）。
- tool公開（`tools.ts:167-192`）: 共通 `listProjects` `show_project_board` `show_projects_table` `show_timeseries`。PRF-04に `showExecutiveSummary` `show_seven_keys`、PRF-03/PRF-Gに `showManagerSummary` `show_burndown` `show_dora`、PRF-Gのみ `showAgentActivity`、investorに `showInvestorSummary` `show_investor_kpis`。PRF-L公開は残課題と明記（14-16行目）。
- `DashboardClient.tsx`: ViewSpec別fetch分岐（252-276行目）。`projectBoard` は275行目で `E-VIEW02: project board data endpoint is not available` を投げる。パネルは右カラムのインラインCard（353行目）。
- データ経路: `/app/api/data/projects` は全ドメイン・全プロファイル対応（`projectsHandler.ts:30-41`）。`/app/api/data/timeseries` は `choosePersona` が要求ビュー該当なしなら保有先頭ペルソナへフォールバックし（`timeseriesHandler.ts:61-79`）、`canSeeProject` でスコープ検査する（81-86行目）。`/app/api/data/agent-activity` はPRF-G専用に絞られている（`agentActivityData.ts:16-18` のコメントどおり）。
- 監査: `chatHandler.ts` の `auditLog` / `auditLogForDomain` / `traceIdProvider` はDI済み（53-57行目）で、追記は価格フォールバック時の1箇所のみ（135行目）。`route.ts` は `PgAuditLog`（devops→ `devops_1y`、それ以外→ `prjops_5y`）と `randomUUID` を結線済み（56-57行目）。コストガードは `PgCostGuard.reserve` / `reconcileReservation`（`CHAT_COST_AGENT = "WEB-CHAT"`、`PrjOps:SPEC-INT-060`）。
- `ChatPanel.tsx`: 推論の折りたたみ表示あり（130-133行目）。フローティングFAB・キーボードショートカット・サジェスト・権限フッターは実装なし。`KNOWN_VIEW_TOOL_NAMES` は12種（26-39行目）。
- 脅威モデル: `docs/spec/threat-model.md` §2のLLM経路8件に `page-agent` 行あり（29行目。side effect欄に監査追記の記載なし）。
- `docs/reference/page-agent-tools.md`: tool表に `show_project_board` 行がなく、Persona MatrixはPRF-04/PRF-03/PRF-G/Investorの4行のみ。
- 約束の一次証跡（ADR-0018コンテキストに転記済み）: リポジトリ正本PPTXスライド5、添付PPTXスライド11・14、ワイヤーフレームのagent-fab定義・⌘KハンドラJS・フッター文言・設計根拠コメント。
- OSS page-agent (alibaba): v1.12.2、tagコミット `5485e8cffb44`、MIT。2026-07-17 10:43 UTCに一次情報確認、12:37 UTCにtag一覧再確認。本リポジトリへの参照は0件（`pnpm ls page-agent` 該当なし、`git grep -i "alibaba"` 0件）。
- ツールチェーン: mise `node = "22"`、pnpm 11.13.0、DoD = `mise run ci`（traceability・actionlint含む）。

## Implementation

共通規則（全taskに適用）:

- Task IDは `^#### P013-F[0-9]{2}-T[0-9]{2} ` 形式。`Owner:` はorchestrator（判断・整合確認・受入・PR）またはworker（実装・テスト・文書）を示し、orchestratorはworkerの完了報告を要約で受理せず、diff・変更ファイル全文・テストログを直接読む。
- コード変更taskはテスト先行（RED確認→最小実装→GREEN）。REDは「対象仕様の不在」を理由とする失敗であること。
- 新規・変更ファイルの冒頭コメントに根拠ID（該当する `PrjOps:`/`DevOps:` 付き仕様IDとADR-0018）を維持・追記する（AGENTS.md設計原則3）。
- Phase 1〜4は番号順に直列実行する（Assumptionsの交差規則）。各フェーズは1ブランチ・1 PR。
- 秘密値・PII・生プロンプトをplan・ログ・PR本文・証跡へ書かない。

### Phase 0: 決定と正本文書を整備する

ブランチ `agent/p013-f00-decision`。

#### P013-F00-T01 実行基準を固定しdrift checkを行う

- Owner: orchestrator
- Preconditions: clean checkout、`origin/main` fetch済み。
- Allowed files: `plans/013-page-agent-pptx-parity.md`（Planned at行の記入のみ）
- Work: (1) `git rev-parse origin/main` の実HEADを本Plan冒頭の `Planned at` へ記入する。(2) Current Stateに列挙した全 `file:line` をHEADで再確認する。(3) `docs/adr/` の実ファイル一覧で0017が未使用・0018が空きであること、`plans/README.md` の次番号が013であることを確認する。
- Verify: 照合コマンドと結果の記録。1件でも不一致があれば実装せず本Plan改訂へ戻す。
- STOP: `file:line` 不一致、ADR/Plan番号の衝突、`plans/013-*.md` が別内容で既に存在する。

#### P013-F00-T02 ADR-0018を収載する

- Owner: worker（review: orchestrator）
- Preconditions: P013-F00-T01完了。
- Allowed files: `docs/adr/0018-page-agent-architecture.md`（新規）
- Work: 納品済みのADR-0018本文を無改変で配置する（ステータスは「提案」のまま。「採用」への更新はP013-F00-T04で行う）。
- Verify: `mise run format` のcheck、`.claude/skills/new-adr/SKILL.md` の5節（ステータス/コンテキスト/決定/根拠/影響）と仕様ID6件の `###` アンカーの存在、`git diff --stat` が新規1ファイルのみ。
- STOP: 0017の採番、既存ADRの編集、本文の改変。

#### P013-F00-T03 本Planをplans/README.mdへ登録する

- Owner: worker（review: orchestrator）
- Preconditions: P013-F00-T01完了。
- Allowed files: `plans/README.md`
- Work: (1) 実行順序表へ「| 013 | 0–5 | 内部ページエージェントを全ペルソナで動かしalibaba/page-agent不採用を確定する | P1 | L | 001 | TODO |」の1行を追加する。(2) Current notesへ「Plan 013: ADR-0018の範囲のみ。projectBoardデータ経路はPlan 010の領分で、公開ゲートの `true` 化はPlan 010成果到達後の作業」を1行追加する。(3) 他Planの行・本文は変更しない。
- Verify: Prettier check、`git diff plans/README.md` が追加行のみであること。

#### P013-F00-T04 Phase 0受入 — 決定PRを作成しowner承認を得る（human gate）

- Owner: orchestrator
- Preconditions: P013-F00-T01〜T03がREVIEWED以上。最新 `origin/main` へrebase済み。
- Allowed files: `docs/adr/0018-page-agent-architecture.md`（ステータス行の「提案」から「採用 — <承認日>」への更新のみ）
- Work: (1) stage内容がT01〜T03の成果と完全一致することを `git diff --cached --name-status` で確認し、`ai-generated` ラベル付きdraft PRを作成する。(2) PR本文に、OSS不採用の要旨、監査保存が増えるデータ影響、Open QuestionsのTBD(HUMAN)-1の承認依頼を明記する。(3) owner承認取得後、ADRステータスを「採用」へ更新し、hosted checks greenでmergeする。承認記録（PR URL・承認者・日時）を証跡に残す。
- Verify: `mise run ci`、post-mergeのancestry確認、承認記録の存在。
- STOP: owner承認なしのmerge、CI redでのmerge。承認が得られない場合はPhase 1以降を `BLOCKED: HUMAN` とし、TBD(HUMAN)-1の書式で報告する。

### Phase 1: 全ペルソナへパネル到達性を完成させ、boardを公開ゲートする

ブランチ `agent/p013-f01-persona-reach`。開始条件: P013-F00-T04 ACCEPTED。

#### P013-F01-T01 到達性とtool公開マトリクスのREDテストを追加する

- Owner: worker
- Allowed files: `packages/web/tests/chat/tools.test.ts`, `packages/web/tests/ui.test.tsx`
- Work: (1) `tools.test.ts` へ「ペルソナ×tool公開」の網羅表テストを追加する: PrjOps PRF-01/02は共通tool（`listProjects` `show_projects_table` `show_timeseries`）のみ、DevOps PRF-Mは同様、管理系tool（`showExecutiveSummary` `showManagerSummary` `showAgentActivity` `showInvestorSummary` ほか別名）は該当ペルソナ以外のToolSetに存在しない、`show_project_board` はデータ経路が無効な間はどのペルソナにも公開されない。(2) `ui.test.tsx` へ「PRF-01/PRF-02/PRF-M/PRF-Lでdashboard pageがDashboardClient（＝ページエージェントパネルを含む）を描画し、『準備中です』文言を含まない」テストを追加する。
- Verify: 追加テストが「準備中Cardの存在」「`show_project_board` の公開」を理由にREDであること。既存テストはGREENのまま。
- STOP: 既存assertの仕様変更（削除・緩和）。

#### P013-F01-T02 dashboard pageのフォールバック廃止とboardゲートを実装する

- Owner: worker（review: orchestrator、adversarial観点必須）
- Preconditions: P013-F01-T01完了。
- Allowed files: `packages/web/src/app/dashboard/page.tsx`, `packages/web/src/server/chat/tools.ts`, `packages/web/tests/chat/tools.test.ts`, `packages/web/tests/ui.test.tsx`
- Work: (1) `page.tsx` 末尾フォールバックを、PrjOps PRF-01/02はprjopsスコープの、DevOps PRF-M/Lはdevopsスコープの `DashboardClient`（`initialViewSpec: { kind: "projectList" }`、初期データは既存の `listScopedProjectSummaries` / `listDevOpsScopedProjectSummaries` で構築）へ置き換える。既存4分岐（PRF-04/investor/PRF-03/PRF-G）は変更しない。(2) `tools.ts` へ定数 `PROJECT_BOARD_DATA_AVAILABLE = false` を追加し、`show_project_board` の公開を条件化する（tool実装とスコープ検査は残す）。根拠コメントに `E-VIEW02` とPlan 010 `P010-F02-T10..T14` を記載する。(3) ファイル冒頭コメントへ根拠ID `PrjOps:REQ-044` `DevOps:REQ-044` `PrjOps:AC-044-1` `DevOps:AC-044-1` を追記する。
- Verify: P013-F01-T01の全テストGREEN。既存 `tools.test.ts` のスコープ外projectId拒否assertは、定数を一時的に `true` にした条件でGREENであること（定数化で検査ロジックが死んでいないことの確認）。`pnpm --filter @aiops/web test`、typecheck。
- STOP: `DashboardClient.tsx` の変更が必要になった場合（本フェーズでは変更しない）、既存4分岐の挙動変更。

#### P013-F01-T03 仕様ID4件を登録し文書を実装へ一致させる

- Owner: worker（review: orchestrator）
- Preconditions: P013-F01-T02完了。
- Allowed files: `docs/spec/spec-id-catalog.md`, `packages/traceability/spec-ids/prjops.json`, `packages/traceability/spec-ids/devops.json`, `docs/reference/page-agent-tools.md`, `docs/guide/dashboard.md`
- Work: (1) `PrjOps:REQ-044` `DevOps:REQ-044` `PrjOps:AC-044-1` `DevOps:AC-044-1` をカタログ（Canonical source=ADR-0018アンカー）と両JSONへ登録する。(2) `page-agent-tools.md` のtool表へ `show_project_board` 行（公開ゲート中である旨と根拠）を追加し、Persona MatrixへPrjOps PRF-01/PRF-02・DevOps PRF-M/PRF-Lの行を追加する。(3) `docs/guide/dashboard.md` のペルソナ別説明へ、全ペルソナでページエージェントが利用可能になったことを反映する。
- Verify: `mise run traceability` green、Prettier check、マトリクスが `tools.ts` の実装と一致すること（orchestratorが突合）。
- STOP: 既存ID行（REQ-041系ほか）の変更。

#### P013-F01-T04 Phase 1受入

- Owner: orchestrator
- Preconditions: P013-F01-T01〜T03がREVIEWED以上。
- Allowed files: 追加コミットなし（是正は各taskのAllowed files内でのみ）
- Work: フェーズPR（`ai-generated`・draft）でdiff全文とテスト証跡を直接確認し、`mise run ci` greenと「`git grep -n "準備中です" packages/web/src/app/dashboard/page.tsx` が0件」「既存4ペルソナの初期表示回帰なし」を確認のうえ、人間reviewer承認後にmergeする。
- Verify: `mise run ci`、上記grep、`pnpm --filter @aiops/web test` 全GREEN。
- STOP: CI red、既存分岐の挙動差分、承認前merge。

### Phase 2: DevOps PRF-Lへ showAgentActivity を公開する

ブランチ `agent/p013-f02-prfl-agent-activity`。開始条件: P013-F01-T04 ACCEPTED。

#### P013-F02-T01 PRF-L公開のREDテストを追加する

- Owner: worker
- Allowed files: `packages/web/tests/chat/tools.test.ts`, `packages/web/tests/reportData/agentActivityHandler.test.ts`, `packages/web/tests/reportData/agentActivityData.test.ts`
- Work: (1) `tools.test.ts` へ「DevOps PRF-Lに `showAgentActivity` が公開される」「DevOps PRF-Mには公開されない」assertを追加する。(2) 既存の `agentActivityHandler.test.ts` へ「PRF-Lは200で担当プロジェクト範囲のデータのみ取得できる」「PRF-Mは403」を、`agentActivityData.test.ts` へ「PRF-Lのvisibilityでスコープ外プロジェクトの行が結果に含まれない」を追加する。
- Verify: (1)(2)が公開・認可の不在を理由にRED。既存テストGREEN。
- STOP: 既存assertの仕様変更。

#### P013-F02-T02 tools.tsとagent-activity経路の認可を拡張する

- Owner: worker（review: orchestrator、adversarial観点必須）
- Preconditions: P013-F02-T01完了。
- Allowed files: `packages/web/src/server/chat/tools.ts`, `packages/web/src/server/reportData/agentActivityHandler.ts`, `packages/web/src/server/reportData/agentActivityData.ts`, `packages/web/src/app/api/data/agent-activity/route.ts`, P013-F02-T01のテストファイル
- Work: (1) `tools.ts` の `showAgentActivity` 公開判定をDevOps `PRF-G | PRF-L` へ広げる（関数名 `canSeeAgentActivity`）。14-16行目の残課題コメントを、解消済みの説明へ更新する。(2) handler/routeの認可を同じ集合へ拡張し、スコープ制御は既存 `isProjectInScope` に委ねる。(3) `agentActivityData.ts` 16-18行目の残課題コメントを現状へ更新する。
- Verify: P013-F02-T01の全テストGREEN、既存webテスト全GREEN、typecheck。
- STOP: PRF-M・PrjOps系ペルソナへの公開、スコープ検査の緩和。

#### P013-F02-T03 文書をPRF-L公開へ一致させる

- Owner: worker（review: orchestrator）
- Preconditions: P013-F02-T02完了。
- Allowed files: `docs/reference/page-agent-tools.md`, `docs/guide/dashboard.md`
- Work: `page-agent-tools.md` の `showAgentActivity` 行のVisibilityとPersona MatrixのPRF-L行を更新し、`dashboard.md` のDevOps記述へPRF-Lの範囲（担当プロジェクトのみ）を追記する。
- Verify: Prettier check、実装との一致（orchestratorが突合）。

#### P013-F02-T04 Phase 2受入

- Owner: orchestrator
- Preconditions: P013-F02-T01〜T03がREVIEWED以上。
- Allowed files: 追加コミットなし
- Work: フェーズPRのdiff・テスト証跡を直接確認し、`mise run ci` greenを確認のうえ、人間reviewer承認後にmergeする。
- Verify: `mise run ci`、`pnpm --filter @aiops/web test` 全GREEN。
- STOP: CI red、承認前merge。

### Phase 3: 会話を追記専用監査ログへ記録する

ブランチ `agent/p013-f03-conversation-audit`。開始条件: P013-F02-T04 ACCEPTED。

#### P013-F03-T01 会話監査のREDテストを追加する

- Owner: worker
- Allowed files: `packages/web/tests/chat/chatRoute.test.ts`
- Work: fake `auditLog` を注入し次を検証するテストを追加する。(1) 1やり取り完了時に `append` が1回呼ばれ、レコードに trace_id・domain・profile・サニタイズ済み入力本文・出力本文・tool呼び出し名と返却ViewSpec・モデル名・usage が含まれる。(2) 入力に既知secretパターンを混ぜた場合、保存文字列に生secretが現れない。(3) `append` がthrowしてもクライアント応答は完了済みで、失敗がエラーとして記録される（黙殺しない）。(4) `auditLog` 未設定（テストDI）の場合は追記なしで従来どおり動作する。
- Verify: 実装不在を理由に(1)〜(3)がRED、(4)がGREEN。
- STOP: 既存の価格フォールバック監査assertの変更。

#### P013-F03-T02 chatHandlerへ会話監査を実装する

- Owner: worker（review: orchestrator、adversarial観点必須）
- Preconditions: P013-F03-T01完了。
- Allowed files: `packages/web/src/server/chat/chatHandler.ts`, `packages/web/tests/chat/chatRoute.test.ts`
- Work: `onFinish` で `PrjOps:SPEC-INT-090` / `DevOps:SPEC-INT-090` のレコードを組み立て `auditLog.append` する。保存文字列はすべて `sanitizeForLlmInput` 適用後とし、APIキー・Authorizationヘッダ・生トークンをレコードへ入れない。追記失敗はcatchしてエラーログへ記録する。ファイル冒頭コメントへ `PrjOps:SPEC-INT-090` `DevOps:SPEC-INT-090` を追記する。
- Verify: P013-F03-T01の全テストGREEN、既存chatテスト（コストガード429・未認証401・503経路）全GREEN、typecheck。
- STOP: 応答本文・監査レコード以外への保存経路の追加、`route.ts` の結線変更が必要になった場合。

#### P013-F03-T03 仕様ID2件を登録し脅威モデルと文書を更新する

- Owner: worker（review: orchestrator）
- Preconditions: P013-F03-T02完了。
- Allowed files: `docs/spec/spec-id-catalog.md`, `packages/traceability/spec-ids/prjops.json`, `packages/traceability/spec-ids/devops.json`, `docs/spec/threat-model.md`, `docs/reference/page-agent-tools.md`
- Work: (1) `PrjOps:SPEC-INT-090` `DevOps:SPEC-INT-090` をカタログとJSONへ登録する。(2) `threat-model.md` §2の `page-agent` 行のOutput / side effect欄へ「サニタイズ済み会話の監査ログ追記」を追記する（OWASP行列の評価値は変更しない。変更が必要と判断した場合はSTOPしorchestratorへ報告する）。(3) `page-agent-tools.md` のChat Runtime節へ監査記録の内容と保持期間（既存ドメイン別台帳に従う）を追記する。
- Verify: `mise run traceability` green、Prettier check、`git diff docs/spec/threat-model.md` が当該1行のみ。
- STOP: OWASP行列セルの無断変更、既存8経路の他行変更。

#### P013-F03-T04 Phase 3受入

- Owner: orchestrator
- Preconditions: P013-F03-T01〜T03がREVIEWED以上。
- Allowed files: 追加コミットなし
- Work: フェーズPRのdiff・テスト証跡を直接確認し、保存レコードのサンプル（テスト出力）に生secret・APIキーが無いことを確認のうえ、`mise run ci` green、人間reviewer承認後にmergeする。
- Verify: `mise run ci`、秘匿検査grep（テストfixture以外にsecret様文字列が増えていないこと）。
- STOP: CI red、承認前merge。

### Phase 4: パネルUIをワイヤーフレーム準拠にする

ブランチ `agent/p013-f04-floating-panel`。開始条件: P013-F03-T04 ACCEPTED。

#### P013-F04-T01 フローティングパネルのREDテストを追加する

- Owner: worker
- Allowed files: `packages/web/tests/chat/ChatPanel.test.tsx`, `packages/web/tests/DashboardClient.test.tsx`
- Work: 次を検証するテストを追加する。(1) 初期状態はFABのみでパネルは閉、FABクリックで開閉。(2) ⌘K/Ctrl+Kで開閉し、Escで閉じる。(3) サジェストチップが「公開ToolSetから決定的に導出された固定文言」であり、権限外toolのチップが表示されない（PRF-01のfixtureで管理系チップ不在）。(4) フッターに「権限フィルタ適用済み: このペルソナで見られる画面のみ切替可能。会話は監査ログに記録されます。」が表示される。(5) 推論の折りたたみ・ViewSpec受け渡し（`onViewSpecReceived`）の既存挙動が維持される。
- Verify: (1)〜(4)が実装不在を理由にRED、(5)がGREEN。
- STOP: 既存assertの仕様変更。

#### P013-F04-T02 ChatPanelを浮動化しDashboardClientの列を置き換える

- Owner: worker（review: orchestrator）
- Preconditions: P013-F04-T01完了。
- Allowed files: `packages/web/src/components/chat/ChatPanel.tsx`, `packages/web/src/components/DashboardClient.tsx`, `packages/web/tests/chat/ChatPanel.test.tsx`, `packages/web/tests/DashboardClient.test.tsx`
- Work: (1) `ChatPanel.tsx` をFAB＋固定位置パネル構成へ変更し、⌘K/Ctrl+K・Esc・サジェストチップ（props経由で公開tool名リストを受け取り固定文言へマップ）・フッター文言を実装する。LLM呼び出し・transport・ViewSpec処理は変更しない。(2) `DashboardClient.tsx` の右カラム（353行目付近）を廃し、`PageAgentPanel` へ公開tool名リスト（サーバ側で構築しpropsで受渡し）を渡す浮動描画へ変更する。グリッドは本文のみの構成へ調整する。
- Verify: P013-F04-T01の全テストGREEN、既存web全テストGREEN、`pnpm --filter @aiops/web run build` 成功、typecheck。
- STOP: `chatHandler` / `tools.ts` の変更、数値表示の追加。

#### P013-F04-T03 Phase 4受入

- Owner: orchestrator
- Preconditions: P013-F04-T01〜T02がREVIEWED以上。
- Allowed files: 追加コミットなし
- Work: フェーズPRのdiff・テスト証跡・ビルド結果を直接確認し、ワイヤーフレームのパネル要素（FAB・ショートカット・サジェスト・フッター文言・推論折りたたみ）との対応表をPR本文に記載のうえ、`mise run ci` green、人間reviewer承認後にmergeする。
- Verify: `mise run ci`、対応表とテストの突合。
- STOP: CI red、承認前merge。

### Phase 5: 検証記録と最終受入を閉じる

ブランチ `agent/p013-f05-close`。開始条件: P013-F04-T03 ACCEPTED。

#### P013-F05-T01 検証報告書とワイヤーフレーム版対応を記録する

- Owner: worker（review: orchestrator）
- Allowed files: `verification/VERIFICATION_REPORT.md`, `docs/guide/dashboard.md`
- Work: (1) `VERIFICATION_REPORT.md` へ本Planの検証結果を既存用語で追記する: ペルソナ×tool網羅・到達性・会話監査・パネルUXは `verified-integration`、実LLMでのページエージェントsmokeと実Entraセッションでの確認は `requires-real-env`。実施していない検証を実施済みと書かない。(2) `dashboard.md` へワイヤーフレームの版対応（ファイル名 `_4` はタイトル表記v3.0が正であること）を1段落で記録する。
- Verify: Prettier check、記載内容とテストログの突合（orchestrator）。

#### P013-F05-T02 Phase 5受入 — 最終受入とplans/README状態更新

- Owner: orchestrator
- Preconditions: P013-F05-T01がREVIEWED以上。
- Allowed files: `plans/README.md`
- Work: (1) clean checkoutで `mise run ci` を実行しgreenを確認する。(2) `pnpm ls page-agent --filter @aiops/web` が該当なし、`git grep -i "alibaba" packages` が0件であること（OSS不採用の維持）を確認する。(3) `plans/README.md` のPlan 013行のStatusを実状態（`DONE`、または残件付き `BLOCKED: HUMAN`）へ更新する。他Planの行は変更しない。(4) フェーズPRを人間reviewer承認後にmergeする。
- Verify: `mise run ci` ログ、上記grep結果、`git diff plans/README.md` が当該行のみ。
- STOP: CI redのままStatusを `DONE` にする。

## Tests

### 共通local gate

各code taskは次を順に実行し、commit SHA・実行日時・exit codeをログから記録する。

```bash
<focused RED command>
<focused GREEN command>
pnpm --filter @aiops/web run test
pnpm --filter @aiops/web run typecheck
git diff --check
```

各フェーズ受入taskではclean checkoutで `mise run ci` を実行し、1回目からgreenであることを確認する。test件数は固定しない。

### 本Plan固有のnegative matrix

positive経路に加え、少なくとも次の敵対系をテストまたは受入確認に含める。既存機能への副作用（既存4ペルソナ表示・三層分離・権限フィルタ・コストガード・監査ログ）の不在確認を兼ねる項目には(回帰)を付す。

- tool公開: 権限外tool（管理系・投資家系）が該当外ペルソナのToolSetに存在しない（ペルソナ×toolの全行）。クライアント申告ペルソナではなくサーバ解決ペルソナで公開が決まる(回帰)
- boardゲート: `PROJECT_BOARD_DATA_AVAILABLE = false` で `show_project_board` がどのペルソナにも公開されない。`true` 条件下ではスコープ外projectIdが拒否される(回帰)
- 到達性: PRF-01/02/M/Lで「準備中です」文言が描画されない。既存4ペルソナの初期ViewSpecと表示が不変(回帰)
- 認可経路: agent-activityはPRF-M・PrjOps系で403、PRF-Lはスコープ外プロジェクト行を含まない。未認証401・APIキー未設定503・日次上限429(回帰)
- 会話監査: 保存文字列に生secret・APIキーが現れない。`append` 失敗が黙殺されない。価格フォールバック監査の既存挙動が不変(回帰)
- パネルUX: サジェストチップが権限外toolを含まない。数値・集計値をパネルが独自に表示しない(回帰)。推論折りたたみとViewSpec受け渡しが不変(回帰)
- 横断: `mise run traceability` が6 IDの登録・参照・アンカー解決をgreenで通し、既存ID行（REQ-041系含む）に差分がない(回帰)。`pnpm ls page-agent` 該当なし・`git grep -i "alibaba" packages` 0件

## Done Criteria

- [ ] ADR-0018が収載され、ステータスが「採用」（owner承認記録あり）。
- [ ] P013-F00〜F05の全taskがACCEPTED（human gateはP013-F00-T04のみ。ENV gateはない）。
- [ ] 解決可能な全ペルソナ（PrjOps PRF-01〜04・investor・DevOps PRF-M/L/G）でダッシュボードに内部ページエージェントパネルが表示され、`git grep -n "準備中です" packages/web/src/app/dashboard/page.tsx` が0件。
- [ ] ペルソナ×tool公開マトリクスが、`tools.ts` 実装・`docs/reference/page-agent-tools.md`・テストの三点で一致。
- [ ] 会話監査が `PrjOps:SPEC-INT-090` / `DevOps:SPEC-INT-090` どおりにテストで実証され、保存文字列に生secretが無い。
- [ ] `show_project_board` が公開ゲート中で、失敗が約束されたtool呼び出し経路が存在しない。
- [ ] clean checkoutの `mise run ci` が1回目からgreen（traceability含む）。新規仕様ID6件が登録済みで、既存の仕様ID（REQ/SPEC-INT/TH/AC）に紐づくテストに回帰がない。
- [ ] alibaba/page-agent由来のコード・依存が0行（`pnpm ls page-agent` 該当なし、`git grep -i "alibaba" packages` 0件）。
- [ ] `plans/README.md` のPlan 013行が実状態と一致し、他Plan行に差分がない。

## Open Questions

仕様選択のOpen Questionはない（採用/不採用・実装範囲はADR-0018で確定済み）。以下は人間の承認・判断であり、値を推測しない。未解決でも該当task以外のlocal taskを続行する。

### TBD(HUMAN)-1 ADR-0018採用の承認

- blocked_task_id: `P013-F00-T04`
- missing_value: リポジトリオーナーによる決定PR承認（承認者・日時）。会話本文（サニタイズ済み）を監査ログへ保存するデータ影響の受容を含む
- safe_completed_work: P013-F00-T01〜T03の成果はPR上でレビュー可能な状態まで完了できる
- exact_owner: リポジトリオーナー（`docs/spec/productization-decisions.md` の変更ルールに従う）
- resume_command: PR承認後、`P013-F00-T04` のWork(3)から再開

### TBD(HUMAN)-2 ワイヤーフレーム残要素の別Plan化判断

- blocked_task_id: なし（本Planの完了を妨げない運用判断）
- missing_value: PRF-01/02専用リッチビュー（ワイヤーフレームのREQ-011/012相当レイアウト）とダッシュボード日英切替を、別Planとして起票するか否かの判断
- safe_completed_work: 本Plan全体（ページエージェントの約束は本Planで充足される）
- exact_owner: リポジトリオーナー
- resume_command: 起票判断後、`plans/README.md` の次番号で新Planを採番

ENV入力はない。実LLM・実Entraセッションでのsmokeは `verification/VERIFICATION_REPORT.md` の `requires-real-env` 区分として記録し、将来の実環境受入（Plan 008/010系）で扱う。
