# ADR-0018: ページエージェントはADR-0013方式を全ペルソナへ完成させ、alibaba/page-agentを不採用とする

## ステータス

採用 — 2026-07-18

## コンテキスト

- 目的は、`AI_Ops_Platform_Summary.pptx` とワイヤーフレーム `ai-ops-platform-wireframe_4.html`（タイトル表記v3.0）が約束する「ページエージェント」体験を、実装どおりに成立させることである。約束の一次証跡は次のとおり。
  - リポジトリ正本PPTX（12枚版）スライド5「ページエージェント（対話UI）: 見たい画面を自然文で指示すると表示を切替。AIの推論過程も折りたたみ表示。数値は本文で生成せずツール呼出しに限定。」
  - 添付PPTX（14枚版）スライド11「10 PERSONAS」（6ペルソナの権限別利用）とスライド14「13 SUMMARY」（「ページエージェントにより自然文で必要な情報に到達できる」「全操作を追記専用の監査ログに記録」）。
  - ワイヤーフレーム: フローティングFAB＋パネルが全ビュー共通、⌘K/Ctrl+Kショートカット、サジェスト、推論の折りたたみ、フッター文言「権限フィルタ適用済み: このペルソナで見られる画面のみ切替可能。会話は監査ログに記録されます。」、設計根拠コメントに「ADR-0013: ページエージェント（ViewSpecのみ返却）」。
- 現行実装はADR-0013（採用済み）に基づき、`PrjOps:REQ-041` / `DevOps:REQ-041` / `PrjOps:SPEC-INT-068` / `DevOps:SPEC-INT-068` / `PrjOps:AC-041-1` / `DevOps:AC-041-1` でテスト済みである（`packages/web/src/server/chat/*`、`packages/web/src/components/chat/ChatPanel.tsx`）。
- 統合検討対象のOSSは alibaba/page-agent（v1.12.2、tagコミット `5485e8cffb44`、MIT、一次情報確認 2026-07-17 10:43 UTC・tag一覧再確認 12:37 UTC）。ブラウザ内でDOM要素を自然言語から直接操作するin-page GUIエージェントで、Chrome拡張とMCP Server（Beta）も提供する。名称が社内実装と衝突する。
- 拘束される既存決定: AGENTS.md設計原則（特に原則2「数値・色・表はコード算出、LLMは文章スロット/表示パラメータのみ」）、ADR-0005（WebUIダッシュボード: チャットによる動的表示切替、capability-basedなtool露出）、ADR-0013、`PrjOps:REQ-020`（全エージェント入出力の追記型監査）、`docs/spec/productization-decisions.md`。
- ADR番号について: 次の空き番号は本来0017だが、`plans/012-conversational-github-operations-and-minutes.md` の `P012-F00-T03` がAllowed filesとして `docs/adr/0017-conversational-projectv2-status-write.md` を予約済みのため、衝突を避けて0018を採番した。0017はPlan 012実行時まで欠番として保持する。

## 決定

### 用語定義（本ADR・Plan 013・以後の新規文書で固定）

- **内部ページエージェント**: ADR-0013で定義され実装済みの機能（ViewSpecのみ返却、DOM操作なし）。既存文書・コード内の「page-agent」「ページエージェント」はこの意味である。
- **OSS page-agent (alibaba)**: 統合検討対象のOSS。本ADRで不採用とする。

### 決定1: OSS page-agent (alibaba) は不採用とする（統合コード0行）

本体・Chrome拡張・MCP Serverのいずれの形態でも、依存・コード・ランタイムを本リポジトリへ導入しない。ADR-0013は置換せず、内部ページエージェントの正本として維持する（ADR-0013のステータス変更なし）。

### 決定2: 解決可能な全ペルソナへパネル到達性を完成させる

PrjOps `PRF-01`/`PRF-02` とDevOps `PRF-M`/`PRF-L` の「準備中」フォールバック（`packages/web/src/app/dashboard/page.tsx`）を廃止し、`DashboardClient`（初期ViewSpec `projectList`、時系列パネル付き）と内部ページエージェントパネルを表示する。公開toolは従来どおりcapability-basedに絞る。

### 決定3: DevOps `PRF-L` へ `showAgentActivity` を公開する

`packages/web/src/server/chat/tools.ts` と `/app/api/data/agent-activity` の認可をDevOps `PRF-L` へ拡張する。データ層（`agentActivityData.ts`）は既に `isProjectInScope` でスコープ制御可能であり、担当プロジェクト範囲のみ表示する。記録済みの残課題（tools.ts 14-16行目コメント）の解消である。

### 決定4: `show_project_board` はデータ経路が実装されるまでToolSetから除外する

`projectBoard` のデータ取得は未実装で常に失敗する（`DashboardClient.tsx` 275行目 `E-VIEW02`）。tool定義は保持しつつ、`tools.ts` 内の定数 `PROJECT_BOARD_DATA_AVAILABLE = false` で公開を止め、失敗が約束されたtoolをLLMに見せない。定数の `true` 化は、Plan 010 `P010-F02-T10..T14`（complete snapshot・read-only board）の成果が `packages/web` に到達した時点の作業であり、本Planの範囲外とする。

### 決定5: 会話を追記専用監査ログへ記録する

`/api/chat` の各やり取りを、既存 `PgAuditLog`（`route.ts` が結線済みのドメイン別台帳: devopsは1年、それ以外は5年保持）へ1レコード追記する。記録内容は `PrjOps:SPEC-INT-090` / `DevOps:SPEC-INT-090` に定義する。秘匿情報は既存 `sanitizeForLlmInput` 適用後の文字列のみを保存し、APIキー・生トークンを保存しない。

### 決定6: パネルUIをワイヤーフレームのフローティング仕様へ合わせる

`ChatPanel` をフローティングFAB＋パネル（⌘K/Ctrl+Kで開閉、Escで閉じる）へ変更し、公開中のtoolから決定的に導出するサジェスト（LLM生成ではない固定文言）と、権限フィルタ・監査記録のフッター文言を表示する。表示変更のみで、LLM呼び出し・tool契約・数値の扱いは変更しない。

### 決定7: 新規仕様ID

以下6件を本ADRで定義する。カタログ登録はPlan 013の各フェーズで初参照コードと同一PRにて行う。

### PrjOps:REQ-044

PrjOpsの解決可能な全ペルソナ（PRF-01〜05相当。PRF-05はinvestorドメインとして解決される）でダッシュボードに内部ページエージェントパネルが表示され、権限内のViewSpec toolだけが公開され、会話が追記専用監査ログに記録される。

### DevOps:REQ-044

DevOpsの解決可能な全ペルソナ（PRF-M/PRF-L/PRF-G）でダッシュボードに内部ページエージェントパネルが表示され、権限内のViewSpec toolだけが公開され、会話が追記専用監査ログに記録される。

### PrjOps:SPEC-INT-090

PrjOpsページエージェントの会話監査レコードは、trace_id、ドメインとプロファイル、サニタイズ済みの利用者入力本文、モデル出力本文、tool呼び出し名と返却ViewSpec、モデル名、usage（入出力トークン）をやり取り単位で追記し、追記失敗をエラーとして記録して黙殺しない。

### DevOps:SPEC-INT-090

DevOpsページエージェントの会話監査レコードは、trace_id、ドメインとプロファイル、サニタイズ済みの利用者入力本文、モデル出力本文、tool呼び出し名と返却ViewSpec、モデル名、usage（入出力トークン）をやり取り単位で追記し、追記失敗をエラーとして記録して黙殺しない。

### PrjOps:AC-044-1

PrjOpsのペルソナ×tool公開マトリクス（PRF-01〜04・investorの各行）がテストで網羅され、PRF-01/PRF-02でパネルが表示され公開toolが実行できること、権限外toolがToolSetに含まれないことをテストで示す。

### DevOps:AC-044-1

DevOpsのペルソナ×tool公開マトリクス（PRF-M/PRF-L/PRF-G）がテストで網羅され、PRF-Lで `showAgentActivity` が担当プロジェクト範囲のみで動作すること、PRF-Mに管理系toolが公開されないことをテストで示す。

## 根拠

- 両版PPTXとワイヤーフレームが約束するページエージェント体験（自然文での画面切替・推論表示・数値のコード算出・権限フィルタ・監査記録・全ペルソナ到達）は、すべてADR-0013方式の完成で満たせる。DOM直接操作を約束する記述はどの資料にも存在しない。
- OSS page-agent (alibaba) のDOM直接操作は、承認・確認送信UIを含む画面をLLMの操作対象にし得るため、AGENTS.md設計原則2と「人が決める」境界に対する新たな攻撃面と検証負担を、対応する約束（要件）なしに持ち込む。

| 却下した代替案                                            | 却下理由                                                                                                                                              | 再検討トリガー                                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| ADR-0013を新ADRで置換しOSS page-agent (alibaba)へ全面移行 | 採用済み・実装済み・テスト済みの境界（数値はコード算出）を、要件の裏付けなく放棄することになる。PPTX/ワイヤーフレームの約束はViewSpec方式で充足可能   | 「画面のDOM操作を自然言語で行う」ことが正式要件になり、ownerが承認                |
| 三層分離に抵触しない領域（Excel取込UI等）への限定採用     | Excel取込は確認送信を含む監査対象フローであり「抵触しない領域」に該当しない。その他の画面にも操作自動化の要件が存在せず、依存追加と攻撃面だけが増える | アクセシビリティ支援等の具体的要件が正式化され、対象画面と統制がownerに承認される |
| opt-inフラグ・同一オリジンproxy・denylist付きの併設採用   | 統制設計としては成立するが、本タスクの目的（PPTX約束の充足）に寄与する約束が存在せず、二重のエージェントUXが「ページエージェント」の意味を曖昧にする  | DOM操作支援の正式要件とUX統合方針がownerに承認される                              |
| Chrome拡張 / MCP Server（Beta）形態での採用               | 配布・認証・監査がWebアプリの境界外になり、Entraセッション・ペルソナ解決・監査ログを迂回する                                                          | 拡張配布の統制要件とBeta卒業が揃い、ownerが別ADRで承認                            |

## 影響

- 追加依存0件、新規環境変数0件（`PROJECT_BOARD_DATA_AVAILABLE` はコード内定数）。外部通信先は不変。
- 監査ログに会話本文（サニタイズ済み）が保存されるようになり、保存データ量とPII取り扱い面が増える。保持期間は既存のドメイン別台帳（devops 1年、それ以外5年）に従う。`docs/spec/threat-model.md` §2のpage-agent行へ監査追記の副作用を追記する。
- `docs/reference/page-agent-tools.md` のtool表とペルソナマトリクスを、`show_project_board` の扱いと新規ペルソナ行を含めて実装と一致させる。
- ADR-0005・ADR-0013の既定動作・境界は不変。決定4の定数 `true` 化はPlan 010のboard成果到達時の作業として引き継ぐ。
- 実装・検証・受入の正本はPlan 013（`plans/013-page-agent-pptx-parity.md`）。
