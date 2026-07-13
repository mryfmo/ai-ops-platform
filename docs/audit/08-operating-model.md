# 08. 統合運用モデル 監査レポート（Outlook/Teams + Claude Code + GitHub + Excel-Import + Web）

- 監査日: 2026-07-11 / 監査対象コミット: `39b95944e9f17dffce500c21f40989f6fa86092d`
- 監査観点: コード品質（01〜07）ではなく**運用モデル**。「この統合構成で PrjOps + DevOps を実際に回すとき、誰が・何を・どの経路で・どの頻度で行うのか」を 2026-07-11 時点の公式ドキュメント・最新情報に照らして最適解を決定し、現状仕様とのギャップを抽出する。

## 1. 対象範囲と監査観点

5 つの運用面 — (a) Teams 取込と承認カード、(b) Outlook 配信、(c) Excel ブリッジ（GitHub 非熟練者の情報取込）、(d) Claude Code コーディングタスク、(e) GitHub Projects v2 / Web レポート — の端から端までの運用フローを、リポジトリの実装・runbook・ADR と突合した。コードレベルの欠陥は 01〜07 に既出のため、ここでは**運用が成立するか・最適形か**のみを扱う。

## 2. あるべき運用モデルの決定（ベストプラクティス基準）

2026-07-11 時点の公式情報に基づき、本構成の最適解を以下のとおり決定する。各項の出典は個別指摘に記載。

### 2.1 Teams 取込・承認（現行アーキテクチャは概ね正、未検証前提が残る）

- **取込は現行の RSC アプリ + Graph change notifications + delta polling を維持する**。Bot Framework SDK はサポート終了（2025-12-31）であり、ボット化するなら Teams SDK（旧 Teams AI Library v2）だが、本システムの用途（チャネル発言の収集と定型応答）には RSC `ChannelMessage.Read.Group` + サブスクリプションで足り、テナント横断の protected API（`ChannelMessage.Read.All`）承認を回避できる現行設計は正しい。制約として **RSC のメッセージ通知は標準チャネルのみ**（プライベート/共有チャネル不可）を運用前提に明記する。
- **承認 UI は Adaptive Card Universal Actions（`Action.Execute` + user-specific views）が 2026 年の推奨**。現行の `Action.OpenUrl` 単発は「リンクを開く」までしか担保せず、承認者限定表示・カード状態更新ができない。最低限、リンク先の承認エンドポイント（coding-task confirm と同型）が必須。
- **2025-2026 の環境変化**: Office 365 Connectors/Incoming Webhook は 2026-05 に完全廃止（本システムは不使用 — 影響なし）。Teams メッセージ API の従量課金は 2025-08-25 に撤廃（model A/B の考慮は不要になった）。

### 2.2 Outlook 配信

- **専用サービスメールボックス + `Mail.Send`（アプリケーション権限）+ Exchange 側の RBAC for Applications でテナント側からも送信元を限定する**（ApplicationAccessPolicy はレガシー化）。アプリ内 allowlist（`GRAPH_ALLOWED_FROM_MAILBOXES`）だけでは、client secret 漏洩時にテナント全域から送信可能なままである。
- **メール内操作（Actionable Messages）は採用しない**: legacy 認証は 2026-06 に廃止済みで、新規構築は Teams 側 Universal Actions が推奨。メールは「通知 + ダッシュボード/承認ページへのリンク」に徹する（現行設計と一致 — この点は正）。
- HTML は classic Outlook（Word レンダリング、LTSC で 2029 年以降もサポート）を想定し table ベース + インライン CSS を維持する。

### 2.3 Excel ブリッジ（GitHub 非熟練者の唯一の入力経路）

- **「一方向インポート + システムが source of truth + dry-run 必須」という現行の設計判断は正しい**（双方向同期はセルレベルの来歴管理が必要になり過剰）。
- ただし提出者が非技術者である以上、**提出経路は認証付き Web UI（既存ダッシュボードへのアップロード画面）でなければ運用が成立しない**。HMAC 署名付き curl は運用主体と矛盾する。
- スプレッドシート取込は EUC（End User Computing）統制の対象として扱う: テンプレート版数の埋め込み、全行エラーの一括返却（行番号・列・理由）、再提出の冪等性（実装済み: import_ledger）、提出の監査証跡、システム側変更との競合検出（エクスポート時スナップショット比較）。英 PRA SS1/23（2024-05 施行）等、スプレッドシート統制は規制水準でも要求される領域である。

### 2.4 Claude Code コーディングタスク

- **GitHub イベント起点の実行は公式 `anthropics/claude-code-action` v1 を第一候補とする**（プロンプトインジェクション対策・トークンスコープ・コミット署名・`claude_args` による制約を内蔵）。現行の Teams 起点 `workflow_dispatch` + headless CLI 構成は公式にサポートされたパターンだが、その場合は `--allowedTools` の明示制限・`--max-turns`・Actions `concurrency:`/timeout・sandbox の各ガードを自前で備える必要がある。
- **人間確認ゲートは維持しつつ強化する**: 確認トークンに TTL と単回性（nonce）、承認者の再認証（Entra セッション）、依頼者 ≠ 承認者の two-person rule。GitHub ネイティブでは Environments の required reviewers + "Prevent self-reviews" が同等機能を提供する。
- ガバナンス（`agent/*` ブランチ + `ai-generated` ラベル + 自動マージ禁止 + CODEOWNERS）は現行ベストプラクティスに合致 — ただし branch protection の実効化（AUD-SEC-001）が前提。

### 2.5 GitHub PM / Web レポート

- **Projects v2 の org webhook（projects_v2_item 等）+ 6 時間毎 GraphQL リコンサイルという現行パターンは推奨形そのもの**（webhook は rate limit を消費せず、リコンサイルが取りこぼしを治癒する）。Projects v2 は GraphQL のみ・CSV ネイティブインポート無しのため、Excel ブリッジの存在意義も裏付けられる。
- **レポート運用カレンダーを 3 層で確定する**: 週次（月曜 07:00 JST 生成 → 週初営業日配信 — 実装済み）、月次（Seven Keys — 実装済み）、**四半期（investor-quarterly — 未実装）**。投資家報告は ILPA 基準で四半期末から 60 日以内（ベストプラクティス 45 日）、ILPA Reporting Template v2.0 は 2026Q1 データから適用開始であり、四半期ケイデンスの欠落は運用要件の欠落である。
- **LLM 生成ナラティブを含む対外（投資家・役員）配信は、記名の人間承認（maker-checker、生成トリガー者 ≠ 承認者）を通す**。EU AI Act Art.50（2026-08-02 適用開始）は「人間のレビューと編集責任者が存在する」ことを AI 生成テキスト開示義務の免除条件としており、記名サインオフはコンプライアンス機構そのものになる。
- **配信の沈黙検知**: 送信ジョブ成功時に外部モニタへ heartbeat を送る dead man's switch を置く（「送られなかった週報」は内部メトリクスでは検知できない — 監視系自体が同一ホストにあるため）。

### 2.6 運用役割（最小 RACI）

| 役割                                                | 責務                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| PMO オペレータ                                      | 週次サイクル監視、AGT-01 エスカレーション受領、Excel 取込の差し戻し対応 |
| レポート承認者（PRF-03 以上、生成トリガー者と別人） | 対外レポートの配信前サインオフ                                          |
| 変更承認者                                          | AGT_CHG 承認カードの判断（Sev1 確定も同様）                             |
| プラットフォーム管理者                              | Graph サブスクリプション・recipients・シークレットローテーション        |

現状はこの役割定義自体が存在しない（AGT-01 の `pmo_operator` は型リテラルのみで実体へのマッピングがない）。

## 3. 指摘事項サマリ

| ID          | タイトル                                                                       | Severity | 工数 |
| ----------- | ------------------------------------------------------------------------------ | -------- | ---- |
| AUD-OPM-001 | 変更承認カードの意思決定エンドポイントが存在しない（承認フローが完結不能）     | Critical | M    |
| AUD-OPM-002 | 「非熟練者向け」Excel 取込が実運用ではエンジニア専用（HMAC 未文書化・UI なし） | High     | M    |
| AUD-OPM-003 | コーディングエージェント実行部が未検証かつガード不足のまま                     | High     | M    |
| AUD-OPM-004 | investor-quarterly の生成・配信ケイデンスが未実装（ILPA 期限を運用不能）       | High     | M    |
| AUD-OPM-005 | LLM ナラティブ入り報告の対外配信前に人間承認ゲートがない                       | High     | M    |
| AUD-OPM-006 | Teams 本番導入の前提（app-only 投稿・protected API・手動手順）が未検証         | High     | M    |
| AUD-OPM-007 | coding-task 確認ゲートが無期限トークン・単一承認者・本人確認なし               | Medium   | M    |
| AUD-OPM-008 | Mail.Send がテナント側で未スコープ（RBAC for Applications 未適用）             | Medium   | S    |
| AUD-OPM-009 | 配信サイレンス検知（dead man's switch）と失敗再送方針がない                    | Medium   | S    |
| AUD-OPM-010 | recipients 管理の CRUD・手順書不在 + ステークホルダーマスタとの二重管理        | Medium   | M    |
| AUD-OPM-011 | Excel 取込に EUC 統制（テンプレート版数・競合検出）がない                      | Medium   | M    |
| AUD-OPM-012 | レポート成果物の保持・不変アーカイブ・テンプレート版数が未規定                 | Medium   | M    |
| AUD-OPM-013 | エスカレーション先が未定義（pmo_operator は型リテラルのみ）・RACI 不在         | Medium   | S    |
| AUD-OPM-014 | メール HTML の classic Outlook 互換が未検証                                    | Low      | S    |
| AUD-OPM-015 | Excel テンプレート配布エンドポイントが無認証                                   | Low      | S    |

## 4. 個別指摘

### AUD-OPM-001: 変更承認カードの意思決定エンドポイントが存在しない

| Severity | 工数 | 関連仕様                                           | 関連指摘    |
| -------- | ---- | -------------------------------------------------- | ----------- |
| Critical | M    | SPEC-EXT-010（Teams 承認カード）の運用が完結しない | AUD-OPM-007 |

**現状**: AGT_CHG の承認カードは `Action.OpenUrl` で外部 `decisionUrl` を開くだけであり、**その URL を受ける承認エンドポイント/ページがリポジトリのどこにも実装されていない**（server の全ルートを確認 — /decision 系ルートなし。`decisionUrl` の出現は AGT_CHG.ts とテストのみ）。つまり承認者はカードのボタンを押しても判断を記録する先がなく、本番変更承認・Sev1 確定・JIT 権限承認といった DevOps 運用の中核フローが完結しない。
**根拠**: `packages/devops/src/agents/AGT_CHG.ts`（sendApprovalCard）、`packages/server/src/http/routes/`（決定受領ルート不在を grep で確認）
**あるべき姿**: 2026 年の推奨は Adaptive Card Universal Actions（`Action.Execute`、schema ≥1.4）+ user-specific views（承認者のみにボタン表示、refresh 60 userIds まで）でカード内完結させる形（出典: https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/universal-actions-for-adaptive-cards/overview 、確認日 2026-07-11）。ただし本システムはボット非搭載（RSC アプリ）のため `Action.Execute` の invoke を受けられない。
**ギャップ**: カード形式ではなく**受け側の不在**が本質。承認判断の記録・監査・実行トリガの経路が丸ごと欠落している。
**推奨対応**: 最小是正 = coding-task confirm と同型の HMAC 付き承認ページ（GET 表示 → POST 判断記録 + 監査ログ + 理由必須）を server に実装し `decisionUrl` に結線する（既存パターンの再利用で 1 ルート）。恒久策 = 承認頻度が上がったら Teams SDK ボット化 + Universal Actions への移行を ADR で判断。

### AUD-OPM-002: 「非熟練者向け」Excel 取込が実運用ではエンジニア専用

| Severity | 工数 | 関連仕様                                                     | 関連指摘                 |
| -------- | ---- | ------------------------------------------------------------ | ------------------------ |
| High     | M    | ADR-0008 の目的（GitHub 非熟練者の情報取込）と運用実態の乖離 | AUD-OPM-011, AUD-OPM-015 |

**現状**: dry-run / execute とも `x-aiops-signature-256`（raw body の HMAC、`XLSX_IMPORT_SECRET`）が必須だが、**操作ガイド（docs/guide/excel-import.md）は署名ヘッダに一切触れていない**（grep 確認済み）。アップロード UI も存在しない。結果として「GitHub を知らない人のための機能」を使えるのは、シークレットを持ち curl で HMAC を計算できるエンジニアだけである。
**根拠**: `packages/server/src/http/routes/xlsxImport.ts`（verifyXlsxImportSignature）、`docs/guide/excel-import.md`（署名の記載なし）
**あるべき姿**: 提出者の実像（Excel しか使わない）に合わせ、認証付き Web UI からのアップロード → dry-run 結果（行番号・列・理由の全件）を画面表示 → 確認クリックで execute、という経路。認証は既存の Entra ID セッション（ダッシュボード）を再利用でき、HMAC はサーバ間経路（CI からの ingest）専用に格下げする。
**推奨対応**: 最小是正 = ガイドに現状の正確な手順（エンジニアが代行実行する運用）を明記し、運用主体の齟齬を文書上解消する。恒久策 = web ダッシュボードにアップロード画面を追加（dry-run 結果テーブル表示 + confirm）。

### AUD-OPM-003: コーディングエージェント実行部が未検証かつガード不足

| Severity | 工数 | 関連仕様           | 関連指摘                 |
| -------- | ---- | ------------------ | ------------------------ |
| High     | M    | ADR-0006 / AC-002b | AUD-VER-001, AUD-OPM-007 |

**現状**: composite action は `claude -p "${CODING_INSTRUCTION}" --permission-mode acceptEdits` を実行し「実運用時要検証」とコメントされたまま。`--allowedTools` の制限なし、`--max-turns` なし、Actions の `concurrency:`/timeout 設定なし、sandbox なし。Droid 経路（`droid exec`）も未検証と明記。指示文（instruction）は Teams 自由文由来であり、エージェントへのプロンプトインジェクション面が開いている。
**根拠**: `.github/actions/run-coding-agent/action.yml`、`.github/workflows/coding-task.yml`
**あるべき姿**: 公式 `anthropics/claude-code-action` v1 はトリガ解析・プロンプトインジェクション対策（不可視文字除去等）・短命トークン・コミット署名・`claude_args` による制約を内蔵し、GitHub ワークフローでの推奨経路（出典: https://code.claude.com/docs/en/github-actions 、https://github.com/anthropics/claude-code-action/blob/main/docs/security.md 、確認日 2026-07-11）。headless CLI 継続なら同等ガードの自前実装が必要（出典: https://code.claude.com/docs/en/headless ）。
**推奨対応**: 最小是正 = 現行 workflow に `--allowedTools` 明示・`--max-turns`・job timeout・`concurrency:` を追加し、instruction を sanitizeForLlmInput 済みで渡すことを検証。恒久策 = claude-code-action v1 への置換を検証タスクとして実施（workflow_dispatch + `prompt` 入力で現行フローと両立可能）。

### AUD-OPM-004: investor-quarterly のケイデンスが未実装

| Severity | 工数 | 関連仕様                                                                       | 関連指摘                 |
| -------- | ---- | ------------------------------------------------------------------------------ | ------------------------ |
| High     | M    | ADR-0011（投資家ペルソナ）/ report_type `investor-quarterly`（schema.sql:159） | AUD-IMP-002, AUD-OPM-005 |

**現状**: スケジュールは週次 cron（月曜 07:00 JST 生成 → 週初営業日配信）のみで、`investor-quarterly` を生成・配信するトリガがどこにも存在しない。schema・ペルソナ・レポート型は定義済みなのに、四半期の運用サイクルが欠落している。
**根拠**: `.github/workflows/report-generation.yml`（cron `0 22 * * 0` のみ）、`packages/server/src/scheduler/tasks/reportDeliveryTask.ts`（週初営業日ゲートのみ）
**あるべき姿**: ILPA 基準では四半期報告は四半期末から 60 日以内（ベストプラクティス 45 日、年度末 120 日）。ILPA Reporting Template v2.0（2025-01 公表）は 2026Q1 データから適用が始まっており、四半期サイクルは投資家報告の前提（出典: https://ilpa.org/industry-guidance/templates-standards-model-documents/ilpa-templates-hub/ilpa-reporting-template/ 、確認日 2026-07-11）。
**推奨対応**: 四半期第 1 営業日に生成をトリガ（`isQuarterStartMonth` + `isNthBusinessDayOfMonth` は businessCalendar に実装済み — 結線のみ）、配信期限 SLO（四半期末 +45 日）を observability-slo.md に追加。

### AUD-OPM-005: LLM ナラティブ入り報告の対外配信前に人間承認ゲートがない

| Severity | 工数 | 関連仕様                                                             | 関連指摘                 |
| -------- | ---- | -------------------------------------------------------------------- | ------------------------ |
| High     | M    | ADR-0012（LLM は結論文スロットのみ）— 生成統制はあるが配信統制がない | AUD-OPM-004, AUD-OPM-013 |

**現状**: /reports/ingest で受理されたレポートは、config（REPORT_DELIVERY_ENABLED / FROM_MAILBOX）と failsafe 以外のゲートなしに配信パイプラインへ直行する。**人間のサインオフは経路上に存在しない**。AGT-07 の機械検証（数値整合・禁止語・権限）は強力だが、投資家・役員宛の LLM 生成ナラティブを無承認で発信する運用は金融系の maker-checker 慣行に反する。
**根拠**: `packages/server/src/http/routes/reportIngest.ts`、`packages/server/src/scheduler/tasks/reportDeliveryTask.ts`（承認ステップ不在）
**あるべき姿**: 対外配信（investor/executive）は記名承認者（生成トリガー者と別人）の承認後にのみ配信キューへ入る。EU AI Act Art.50(4)（2026-08-02 適用開始）は「人間のレビュー・編集統制と編集責任者の存在」を AI 生成テキストの開示義務免除の条件としており、記名サインオフの証跡はそのまま法令対応になる（出典: https://artificialintelligenceact.eu/article/50/ 、確認日 2026-07-11）。
**推奨対応**: standard_reports に `approval_status`（pending/approved、承認者 ID・時刻）を追加し、investor/executive 向けは approved のみ配信対象にする。承認 UI は AUD-OPM-001 の承認ページ基盤を再利用。週次の社内向け（manager-weekly）は機械検証のみで自動配信を維持してよい（過剰統制の回避）。

### AUD-OPM-006: Teams 本番導入の前提が未検証

| Severity | 工数 | 関連仕様                                        | 関連指摘    |
| -------- | ---- | ----------------------------------------------- | ----------- |
| High     | M    | docs/teams-app/README.md 自身が「未検証」と明記 | AUD-VER-003 |

**現状**: (a) アプリ権限（app-only）での通常チャネル投稿の可否が「Microsoft ドキュメントに矛盾があり未検証」と README に明記、(b) protected API 承認（必要になった場合、週次レビューでリードタイム数週間）、(c) マニフェストのプレースホルダ差し替え・Teams 管理センターへのアップロード・チーム毎のインストールと `project_channels` 登録がすべて手動で担当者定義なし。導入がブロックした場合の代替経路も未定義。
**根拠**: `docs/teams-app/manifest.json`（RSC 2 権限のみ、ボットなし — 確認済み）、`docs/teams-app/README.md`
**あるべき姿**: RSC + change notifications 構成自体は 2026 年時点で妥当（Bot Framework はサポート終了、protected API 回避は正しい）。ただし「RSC のメッセージ通知は標準チャネルのみ」「app-only 投稿の可否」は本番の成立条件なので、パイロット前の検証項目として明文化・実施が必要（出典: https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/channel-messages-with-rsc 、https://learn.microsoft.com/en-us/graph/teams-changenotifications-chatmessage 、確認日 2026-07-11）。
**推奨対応**: e2e 実環境検証（AUD-VER-003）に Teams 項目（インストール → 通知受信 → app-only 投稿 → 承認リンク）を統合し、投稿不可だった場合のフォールバック（ユーザー委任 or Workflows 経由通知）を事前に決めておく。

### AUD-OPM-007: coding-task 確認ゲートが無期限トークン・単一承認者・本人確認なし

| Severity | 工数 | 関連仕様                         | 関連指摘                 |
| -------- | ---- | -------------------------------- | ------------------------ |
| Medium   | M    | ADR-0006（誤発火防止）の防御強度 | AUD-OPM-001, AUD-SEC-001 |

**現状**: 確認トークンは `HMAC(taskId, secret)` の決定的値で、**TTL なし・単回性なし・承認者の本人確認なし**（リンク所持 = 承認可能）。依頼者本人が自分のタスクを承認でき、two-person rule がない。リンクが Teams 上に残るため、数週間後でも誰でも発火できる。
**根拠**: `packages/server/src/lib/confirmToken.ts:17-33`（実装全文確認済み）
**あるべき姿**: 有効期限付き署名リンク（payload に発行時刻を含めて HMAC）+ 単回使用（confirm 済みタスクの再 confirm 拒否は実装済み — これは評価できる）+ 承認操作の再認証。GitHub ネイティブ代替は Environments の required reviewers + "Prevent self-reviews"（出典: https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/reviewing-deployments 、確認日 2026-07-11）。
**推奨対応**: 最小是正 = トークン payload を `taskId:issuedAt` に拡張し TTL（例 24h）検証を追加（confirmToken.ts の数行）。恒久策 = 承認ページを Entra 認証下に置き、承認者 ID を監査ログへ記録、requester == approver を拒否。

### AUD-OPM-008: Mail.Send がテナント側で未スコープ

| Severity | 工数 | 関連仕様 | 関連指摘    |
| -------- | ---- | -------- | ----------- |
| Medium   | S    | —        | AUD-SEC-008 |

**現状**: 送信元制限はアプリ内 allowlist（GRAPH_ALLOWED_FROM_MAILBOXES）のみ。Entra アプリに付与された `Mail.Send`（アプリケーション権限）はテナント全メールボックスから送信可能で、client secret 漏洩時はアプリ側チェックが無意味になる。
**根拠**: `packages/server/src/config.ts`、Graph 権限モデル
**あるべき姿**: Exchange Online の **RBAC for Applications** で管理スコープをサービスメールボックスに限定（ApplicationAccessPolicy はレガシーで新規構成非推奨）（出典: https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac 、確認日 2026-07-11）。
**推奨対応**: runbooks/report-delivery.md にテナント側設定手順（New-ManagementScope + New-ManagementRoleAssignment）を追加し、go-live ゲート項目に含める。コード変更不要。

### AUD-OPM-009: 配信サイレンス検知と失敗再送方針がない

| Severity | 工数 | 関連仕様                                     | 関連指摘    |
| -------- | ---- | -------------------------------------------- | ----------- |
| Medium   | S    | SLO「report-delivery success 99%」の検知手段 | AUD-OPS-002 |

**現状**: 配信失敗は audit ログと metrics に記録されるが、(a) アラート実体がなく（AUD-OPS-002）、(b) **スケジューラ自体が止まった場合「配信されなかった」ことを検知する仕組みが同一ホスト内にもない**。失敗配信の再送は「次サイクルの冪等再実行」頼みで、恒久失敗（DLQ 相当）の隔離・再処理フローが未定義。
**根拠**: `packages/server/src/scheduler/tasks/reportDeliveryTask.ts`、`runbooks/report-delivery.md`
**あるべき姿**: 配信ジョブ成功時に外部モニタへ heartbeat（dead man's switch）。失敗は transient/permanent を分類し、リトライ上限後は要対応キューへ隔離してアラート（出典: https://healthchecks.io/docs/monitoring_cron_jobs/ 、https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html 、確認日 2026-07-11）。
**推奨対応**: 最小是正 = 配信サイクル完了時に外部 heartbeat URL へ ping する 1 フック（config 化、未設定なら no-op）。恒久策 = report_delivery_log の failed 恒久分に対する再送 runbook。

### AUD-OPM-010: recipients 管理の CRUD・手順書不在 + マスタ二重管理

| Severity | 工数 | 関連仕様                                                                            | 関連指摘                 |
| -------- | ---- | ----------------------------------------------------------------------------------- | ------------------------ |
| Medium   | M    | 設計原則 6（recipients の active 判定はリクエスト毎）— 判定は正しいが管理経路がない | AUD-IMP-002, AUD-OPM-013 |

**現状**: RecipientsRepo は `listForDelivery()` のみで INSERT/UPDATE/無効化の手段がコードにも runbook にもなく、受信者の追加・退職時の無効化は**手順書なしの手動 SQL**。さらに PrjOps ステークホルダーマスタ（YAML、prjops-data リポジトリ）と DB の recipients が独立管理で、同一人物の情報が乖離し得る（メール変更が片方だけ反映される等）。誤配信は権限フィルタで防げない種類の事故（正しい人の古いアドレス宛）を生む。
**根拠**: `packages/server/src/db/recipientsRepo.ts`、`packages/devops/src/db/schema.sql:142`、`packages/prjops/src/data/README.md`
**あるべき姿**: 単一のマスタ（YAML でよい）から recipients を導出・同期するジョブ、または管理 CLI/画面 + 操作 runbook。退職・異動時の無効化手順は監査対象の定型運用として文書化。
**推奨対応**: 最小是正 = recipients 追加/無効化の SQL 手順を runbook 化（即日可能）。恒久策 = ステークホルダーマスタ → recipients 同期ジョブ（active/email/persona を一方向同期）。

### AUD-OPM-011: Excel 取込に EUC 統制がない

| Severity | 工数 | 関連仕様 | 関連指摘    |
| -------- | ---- | -------- | ----------- |
| Medium   | M    | ADR-0008 | AUD-OPM-002 |

**現状**: テンプレートに版数が埋め込まれておらず（列構成変更時に旧テンプレ提出を判別できない）、システム側で変更済みの項目を古いシートで上書きインポートしても検出されない（source_key 一致は skip されるため上書きは起きないが、**「skip された = 反映されなかった」ことが提出者に伝わる経路が同期 JSON のみ**）。提出物の保管・提出者の記録も未規定。
**根拠**: `packages/shared/src/xlsxImport/`（engine.ts、generateTemplate.ts）、`docs/guide/excel-import.md`
**あるべき姿**: スプレッドシート取込は EUC 統制対象（棚卸し・版数管理・変更記録）。英 PRA SS1/23（2024-05 施行）はスプレッドシート計算をモデルリスク管理に含める（出典: https://www.filefeed.io/blog/data-validation-best-practices 、https://apparity.com/euc-resources/spreadsheet-euc-risk-blog/internal-audit-spreadsheet-euc-risks/ 、確認日 2026-07-11）。
**推奨対応**: テンプレートに版数セル（生成時に埋め込み、取込時に検証・不一致は全件拒否）+ dry-run/execute 結果の人間可読レポート（skipped の理由明示）+ 提出ファイルの保管（audit 添付 or オブジェクトストア）。

### AUD-OPM-012: レポート成果物の保持・不変アーカイブ・テンプレート版数が未規定

| Severity | 工数 | 関連仕様 | 関連指摘    |
| -------- | ---- | -------- | ----------- |
| Medium   | M    | ADR-0012 | AUD-OPS-001 |

**現状**: standard_reports は DB に保存されるが、保持年限・削除禁止・改版時の版管理・「配信されたものと同一の成果物を後から再現できる」保証（テンプレート/スロット定義の版数スタンプ）が未規定。監査ログは 5 年保持を規定済みなのに、報告書本体の保持ポリシーがない。
**根拠**: `packages/devops/src/db/schema.sql`（standard_reports）、docs/adr/0012
**あるべき姿**: SEC 17a-4（2022 改正）は WORM または「改変・削除を完全に監査証跡で再現できる」方式を許容 — 追記専用 + 監査証跡という本システムの設計思想をレポート本体にも延長すればよい。SOX 系は監査関連記録 7 年保持（出典: https://www.sec.gov/rules-regulations/2003/01/retention-records-relevant-audits-reviews 、確認日 2026-07-11）。
**推奨対応**: standard_reports への UPDATE/DELETE を audit_log と同様に REVOKE + 保持年限（投資家向け 7 年を基準）を data-model.md に規定 + 生成時にテンプレート版（git SHA）を report JSON に埋め込む（report-generation.yml で 1 行）。

### AUD-OPM-013: エスカレーション先が未定義・RACI 不在

| Severity | 工数 | 関連仕様              | 関連指摘                 |
| -------- | ---- | --------------------- | ------------------------ |
| Medium   | S    | AGT-01 の escalate 先 | AUD-OPM-005, AUD-OPM-010 |

**現状**: AGT-01 は失敗時 `notifyTarget: "pmo_operator"` へエスカレートする設計だが、`pmo_operator` は**型リテラルとしてのみ存在し、実在の人物・メールボックス・Teams チャネルへのマッピングがどこにもない**（grep 確認済み: AGT01_orchestrator.ts とそのテストのみ）。AGT-06 のエスカレーション先は `managerEmailByProject` 依存だがその供給元はステークホルダーマスタ（未実装 = AUD-IMP-002）。§2.6 の RACI に相当する定義文書がない。
**根拠**: `packages/prjops/src/agents/AGT01_orchestrator.ts:21,35`、grep 結果
**推奨対応**: runbooks/roles.md（§2.6 の 4 役割 + 実名/グループのマッピング）を新設し、pmo_operator → 通知先（メール/チャネル）の config 化。

### AUD-OPM-014: メール HTML の classic Outlook 互換が未検証

| Severity | 工数 | 関連仕様 | 関連指摘    |
| -------- | ---- | -------- | ----------- |
| Low      | S    | —        | AUD-VER-003 |

**現状**: AGT-05/06・レポート配信の HTML はインライン文字列テンプレートで、classic Outlook（Word レンダリングエンジン: flexbox/grid/media query 非対応）での表示検証記録がない。classic は LTSC 向けに 2029 年以降もサポートされ、new Outlook 既定化（2026-04〜）後も併存する。
**推奨対応**: e2e 実環境検証時に classic / new Outlook 両方での表示確認を 1 回実施し、テンプレートを table ベース + インライン CSS に統一する方針を明記。

### AUD-OPM-015: Excel テンプレート配布エンドポイントが無認証

| Severity | 工数 | 関連仕様 | 関連指摘    |
| -------- | ---- | -------- | ----------- |
| Low      | S    | —        | AUD-SEC-002 |

**現状**: `GET /xlsx-import/template` は認証なしで公開され、内部のデータ項目構成（シート・列定義）が外部から取得できる。実害は小さいが、公開面の情報開示は最小化が原則。
**根拠**: `packages/server/src/http/routes/xlsxImport.ts`（template ルートに認証なし）
**推奨対応**: AUD-OPM-002 の UI 化に伴いダッシュボード（認証下）へ移設し、公開ルートは廃止。

## 5. 良好事項

- **RSC + Graph change notifications + 5 分ポーリング + advisory lock 復旧**という取込構成は、Bot Framework サポート終了（2025-12-31）・Teams API 従量課金撤廃（2025-08-25）後の 2026 年環境において protected API を回避できる正しい選択。サブスクリプション 4320 分上限・lifecycle 通知・clientState 検証・「詰まった行を消さない」復旧 runbook まで公式推奨に沿う。
- **Projects v2 の org webhook + 6 時間毎 GraphQL リコンサイル + rate limit 予算チェック**は「webhook は rate limit を消費しない + 定期リコンサイルで治癒」という推奨パターンの教科書的実装。
- **coding-task の「確認リンク → 明示 POST でのみ dispatch」「エージェントは main へ push 不可」「ai-generated ラベル + 自動マージ禁止」**は AI 生成 PR ガバナンスの現行ベストプラクティスに合致（強度の課題は AUD-OPM-007）。
- **Excel 取込の import_ledger による冪等性・マイルストーン先行・rate limit 待機・failsafe 連動**は、一方向インポートの中核として正しく作られている。
- **配信の営業日ゲート（週初営業日・月初営業日）と祝日カレンダー**は、営業日対応の配信ウィンドウという運用要件を既に満たす。
