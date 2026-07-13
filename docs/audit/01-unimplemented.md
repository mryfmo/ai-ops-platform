# 01. 仕様との乖離・未実装機能 監査レポート

- 監査日: 2026-07-11 / 監査対象コミット: `39b95944e9f17dffce500c21f40989f6fa86092d`（branch: agent/005-microsoft-graph）
- 監査観点: 「仕様・ADR に定められた機能が、本番で機能する実体として存在するか」。スタブ・フィクスチャ・例示実装・宣言のみの機能を抽出する。

## 1. 対象範囲と監査観点

packages/{shared,prjops,devops,server,web} の全実装を、docs/spec/・docs/adr/・spec-ids 列挙と突合。「コードは存在するが本番相当の実体がない」ものを本ファイル、「実体はあるが本番負荷・障害で壊れる」ものは [02-reliability](02-reliability.md) に置く。

## 2. あるべき姿

製品レベルの最低線: 仕様 ID が付与された機能は (a) 本番データソースに接続された実装を持つ、(b) 暫定実装は仕様側にその旨が明記され解消期限を持つ、(c) スタブが本番コードパスに残る場合は起動時に fail-fast する（ADR-0014 の「missing config = disabled + audited」原則は良い先例。スタブへの silent fallback はこの原則に反する）。

## 3. 指摘事項サマリ

| ID          | タイトル                                                  | Severity | 工数 |
| ----------- | --------------------------------------------------------- | -------- | ---- |
| AUD-IMP-001 | GitHub App 認証が環境変数スタブのまま                     | Critical | M    |
| AUD-IMP-002 | PrjOps ダッシュボードのデータ供給が空フィクスチャ         | Critical | L    |
| AUD-IMP-003 | Teams ペルソナ解決がハードコードのサンプル人物            | Critical | M    |
| AUD-IMP-004 | PrjOps スケジューラ/ワークフローが未出荷                  | High     | L    |
| AUD-IMP-005 | AGT-04 が単一プロファイル（PRF-04）の例示実装のみ         | Medium   | M    |
| AUD-IMP-006 | マルチペルソナが先頭ペルソナのみ有効                      | Medium   | M    |
| AUD-IMP-007 | マネージャ週次レポートの前週比デルタが 0 固定             | Medium   | S    |
| AUD-IMP-008 | インシデントバーンダウンが「暫定」実装                    | Low      | M    |
| AUD-IMP-009 | ViewSpec の未実装データ種別・PRF-L の agent-activity 保留 | Low      | S    |

## 4. 個別指摘

### AUD-IMP-001: GitHub App 認証が環境変数スタブのまま

| Severity | 工数 | 関連仕様                                            | 関連指摘                 |
| -------- | ---- | --------------------------------------------------- | ------------------------ |
| Critical | M    | SPEC-INT-061（GitHub App installation token）に違反 | AUD-SEC-009, AUD-DEP-003 |

**現状**: 常駐サーバの GitHubClient は `getInstallationToken: async () => process.env.GITHUB_TOKEN ?? ""` で組み立てられ、「暫定: 環境変数トークン（本来は GitHub App installation token）」とコメントされている。未設定時は空文字で全 GitHub API 呼び出しが 401 になる（fail-fast しない）。
**根拠**: `packages/server/src/index.ts:187-189`
**あるべき姿**: GitHub App の JWT → installation token 交換（1 時間で失効するため自動再発行が必須）。公式は Octokit SDK による自動管理を推奨（出典: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app 、確認日 2026-07-11）。AGENTS.md 自身も「AIOPS_PR_TOKEN（GitHub App installation token または専用 PAT）を使う。未設定のまま運用しない」と規定。
**ギャップ**: token 交換ロジック・失効管理・スコープ最小化のすべてが不在。PAT 直書き運用は installation token に比べ失効・権限境界の管理が人力になる。
**推奨対応**: 最小是正 = `GITHUB_TOKEN` を zod config に組み込み、未設定なら該当機能を disabled+audited にする（ADR-0014 原則の適用）。恒久策 = App JWT→installation token 交換の TokenProvider 実装（キャッシュ+失効前更新）。

### AUD-IMP-002: PrjOps ダッシュボードのデータ供給が空フィクスチャ

| Severity | 工数 | 関連仕様                                           | 関連指摘    |
| -------- | ---- | -------------------------------------------------- | ----------- |
| Critical | L    | REQ 系（PrjOps 報告要求）全般の実体不在 / ADR-0013 | AUD-IMP-003 |

**現状**: web の全データ API（executive/investor/manager-summary, projects, timeseries）は `InMemoryPrjopsReportDataProvider([], [])` と `InMemoryStakeholderMasterProvider([])` を結線しており、PrjOps 系ダッシュボードは常にゼロ件を描画する。`personaResolver.ts` のヘッダに本番 Provider（YamlStakeholderMasterProvider 等）の導入が保留と明記。
**根拠**: `packages/web/src/server/personaResolver.ts:14-16,74-93`、`packages/web/src/server/reportData/prjopsReportData.ts`、`packages/web/src/app/api/data/*/route.ts`
**あるべき姿**: ダッシュボードが本番データストア（PostgreSQL / 正式なステークホルダーマスタ）から供給される。供給元未整備なら該当ペルソナ画面を「未接続」として明示する（空データを正常表示するのは誤報告に等しい）。
**ギャップ**: PrjOps 側のデータ永続化・供給層が丸ごと未実装。エグゼクティブ/投資家/マネージャ向け報告という本プロジェクトの中核価値が web 上では動かない。
**推奨対応**: 最小是正 = 未接続ペルソナのダッシュボードに明示バナー + 監査ログ。恒久策 = PrjOps データの DB 永続化（schema 拡張は db-migration 手順に従う）+ ステークホルダーマスタの正式 Provider 実装。

### AUD-IMP-003: Teams ペルソナ解決がハードコードのサンプル人物

| Severity | 工数 | 関連仕様                                                   | 関連指摘    |
| -------- | ---- | ---------------------------------------------------------- | ----------- |
| Critical | M    | 設計原則 6（権限フィルタはデータ取得側で強制）の前提を破壊 | AUD-IMP-002 |

**現状**: 常駐サーバは `SAMPLE_STAKEHOLDERS`（山田太郎 / ST-010 / example.com メール）を実データとして `teamsConversationAgent` のペルソナ解決に使用している。
**根拠**: `packages/server/src/index.ts:123-137`
**あるべき姿**: ステークホルダーマスタは運用データソース由来であること。権限フィルタ（isProjectInScope / isActiveRecipient）はマスタが正しい前提でのみ機能するため、フィクスチャ流用は権限制御の実質無効化。
**ギャップ**: 本番でこのまま起動すると、実在しない人物のプロファイルで Teams 会話の権限判定が行われる。
**推奨対応**: 最小是正 = フィクスチャを削除し、マスタ未設定時は Teams 会話機能を disabled+audited に。恒久策 = AUD-IMP-002 のマスタ実装と統合。

### AUD-IMP-004: PrjOps スケジューラ/ワークフローが未出荷

| Severity | 工数 | 関連仕様                                                  | 関連指摘    |
| -------- | ---- | --------------------------------------------------------- | ----------- |
| High     | L    | AC-018-1（2000 通/2h）達成手段が不在 / ADR-0003・ADR-0014 | AUD-VER-004 |

**現状**: AGT-01/05/06 のヘッダに「packages/prjops/src/workflows/\*.yml を出荷しておらず、package-local scheduler は未実装」と明記。`src/workflows/` は存在しない。AGT-05 の配信ループは直列 `await` で、AC-018-1 の並行数は「呼び出し側のスケジューラ設定に委ねる」とされるが、その呼び出し側が存在しない。server 側スケジューラ（ADR-0014）には report-delivery 等は載ったが、PrjOps の週次ジョブ DAG（WEEKLY_JOB_DEPENDENCY_ORDER）を駆動するタスクはない。
**根拠**: `packages/prjops/src/agents/AGT01_orchestrator.ts:8-9`、`AGT05_distributor.ts`（直列ループ）、`packages/server/src/index.ts`（タスク結線一覧）
**あるべき姿**: AGT-01 の依存順序 DAG が server スケジューラ上で実行され、リトライ判断（decideOnJobFailure）が実際のジョブ再実行に接続されている。性能受入（2000 通/2h）は実行基盤込みで検証されている。
**ギャップ**: PrjOps の自動運転（収集 → 分析 → 報告 → 配信 → 追跡の週次サイクル）が手動呼び出し以外で成立しない。
**推奨対応**: server スケジューラに PrjOps 週次ジョブタスクを追加し（ADR-0014 の delivery 移管と同型）、AGT-01 の決定関数を結線。配信並行度は設定化し AC-018-1 を負荷検証（AUD-VER-004）とセットで。

### AUD-IMP-005: AGT-04 が単一プロファイルの例示実装のみ

| Severity | 工数 | 関連仕様                                                           | 関連指摘    |
| -------- | ---- | ------------------------------------------------------------------ | ----------- |
| Medium   | M    | ADR-0011（投資家ペルソナ）/ ADR-0012（報告標準化）の適用範囲が一部 | AUD-IMP-002 |

**現状**: AGT-04 のヘッダに PRF-04 の単一プロファイル例であり「他プロファイルの文章スロットも同一パターンで実装する」と記載。他プロファイルの結線は未実装。
**根拠**: `packages/prjops/src/agents/AGT04_reportGenerator.ts`（ヘッダ）
**あるべき姿**: 定義済み全プロファイル（エグゼクティブ/投資家/マネージャ等）の文章スロット結線が存在し、プロファイル追加が設定で完結する。
**推奨対応**: プロファイル定義を data 駆動にし、AGT-04 の narrative 生成をプロファイル横断で一般化。narrativeSanitizer（100% カバレッジ）はそのまま再利用。

### AUD-IMP-006: マルチペルソナが先頭ペルソナのみ有効

| Severity | 工数 | 関連仕様                                                           | 関連指摘 |
| -------- | ---- | ------------------------------------------------------------------ | -------- |
| Medium   | M    | 設計原則 6（権限フィルタ）— 過小表示方向のため漏洩はないが仕様乖離 | —        |

**現状**: 複数ペルソナを持つユーザーに対し、chat・tools・dashboard がいずれも `personas[0]!` を採用し切替 UI が未実装。
**根拠**: `packages/web/src/server/chat/chatHandler.ts:115`、`packages/web/src/server/chat/tools.ts`、`packages/web/src/app/dashboard/page.tsx:73`
**あるべき姿**: ペルソナ選択 UI とサーバ側の選択検証（クライアント申告をそのまま信用しない）。
**推奨対応**: セッションに選択ペルソナを保持し、authGuard の resolvePersonas で申告値が保有ペルソナに含まれるか検証。

### AUD-IMP-007: マネージャ週次レポートの前週比デルタが 0 固定

| Severity | 工数 | 関連仕様                                                                     | 関連指摘 |
| -------- | ---- | ---------------------------------------------------------------------------- | -------- |
| Medium   | S    | 設計原則 2（数値はコード算出）— 算出されていない数値が確定値として出力される | —        |

**現状**: `buildAndDeliverManagerReport` が `deltaVsPrevWeek` を 0 でハードコードし、前週比較が未実装のまま「変化なし」として配信される。
**根拠**: `packages/devops/src/agents/AGT_RPT.ts:175-180`
**あるべき姿**: 前週スナップショットとの実差分、または算出不能時は「N/A」を明示（0 と N/A の混同は誤報告）。
**推奨対応**: 最小是正 = 未実装の間は N/A 表示。恒久策 = report_snapshots からの前週値参照。

### AUD-IMP-008: インシデントバーンダウンが「暫定」実装

| Severity | 工数 | 関連仕様                                     | 関連指摘 |
| -------- | ---- | -------------------------------------------- | -------- |
| Low      | M    | — （チケットシステム連携は仕様外出しのまま） | —        |

**現状**: `lib/incidentBurndown.ts:10` に「暫定」と明記。実チケットシステム連携は保留。
**推奨対応**: 連携先確定まで現状維持で可。レポート上に「暫定集計」の注記を出すこと。

### AUD-IMP-009: ViewSpec の未実装データ種別・PRF-L の agent-activity 保留

| Severity | 工数 | 関連仕様 | 関連指摘 |
| -------- | ---- | -------- | -------- |
| Low      | S    | ADR-0013 | —        |

**現状**: `viewSpec.ts` に未実装のデータ種別が残置。`showAgentActivity` の PRF-L 向け公開は保留とコメント。
**推奨対応**: 未実装種別は zod スキーマから除外し、ツール定義に現れないようにする（LLM に選択肢として見せない）。

## 5. 良好事項

- ADR-0014 の「missing config = disabled + audited」原則が report-delivery / xlsx-import / pm-reconcile 等で一貫適用されており、未設定機能が黙ってシミュレートされない。
- lib/（純粋関数）と agents/（結線層）の分離は宣言どおり維持されており、未実装は結線層・データ供給層に集中している（是正コストが局所化されている）。
