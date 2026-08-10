# ADR-0005: 常駐サーバ（packages/server）を新設し、Teams会話取込・GitHub webhook受信・WebUIを単一コンテナに集約する

## ステータス

採用

## コンテキスト

- 新要件: (1) プロジェクト専用Teamsチャネルの会話全文取得、(2) TeamsチャネルからのGitHub操作・照会、
  (3) ペルソナ別レポートのWebUI化＋チャットによる動的表示切替、(4) AIコーディングエージェント統合（ADR-0006）。
- 現状はエージェント関数ライブラリ+GitHub Actionsのみで、HTTPサーバ・webhook受信・フロントエンドが存在しない。
- ADR-0003はDevOpsの常駐コンテナ必要性（30秒ヘルスチェック・毎分JIT失効）を決定済みだが、
  その実体（HTTPサーバ・スケジューラループ・コンテナ定義）は未実装だった。

## 決定

1. **packages/server（@aiops/server）を新設**し、以下を単一の常駐コンテナに集約する:
   - HTTP公開面（Hono + @hono/node-server, :8080）: `/webhooks/graph`、`/webhooks/github`、`/healthz`・`/readyz`、`/app/*`（WebUIプロキシ）
   - 常駐スケジューラ（setTimeout再帰+ドリフト補正+多重実行ガード+graceful shutdown）:
     30秒ヘルスチェック（AGT_ORCH.evaluateFailsafe）、毎分JIT失効（AGT_SEC.revokeExpiredGrants）、
     30分Graphサブスクリプション更新、5分delta取得（pollingフォールバック）、イベントディスパッチ
   - Next.js standalone（:3100内部）はsupervisorスクリプトで兄弟プロセスとして並走させ、
     公開エンドポイントを1つに保つ（TLS終端・notificationUrl・認証境界の一元化）
2. **HTTPフレームワークはHono**: Web標準Request/Responseで既存FetchLike注入哲学と同型、
   `app.request()`でポートを開かずに全経路をテスト可能、ESM前提、依存最小。
3. **Teams連携はM365 Agents SDK（Bot Framework）を使わず**、Graph change notification +
   deltaフォールバック + commandParser拡張で実現する。
   - Adaptive Cardの対話ボタンはAction.Submit（ボットが必要）ではなくAction.OpenUrl
     （WebUIへのディープリンク）で代替する。
   - **Phase 2（ボット追加）への移行判断条件**: Teams内で完結するボタン承認が業務上必須になった場合、
     または通知遅延（通常数秒、polling時最大5分）が実用に耐えない場合。
     その際はEntra IDアプリ（Bot用）+Azure Botリソース+`/webhooks/bot`エンドポイント+
     マニフェストbotセクション追加が必要（`packages/server/src/bot/` 配下に隔離して実装する）。
4. **チャネルメッセージ権限はRSC**: `ChannelMessage.Read.Group` / `ChannelMessage.Send.Group` のみ。
   テナント全体権限（`ChannelMessage.Read.All`）とmigration-onlyの`Teamwork.Migrate.All`は付与しない。
   RSC permission referenceはapplication send権限を列挙する一方、Graphの通常post/reply method pageは
   application欄をmigration-onlyとしており、app-only通常root投稿・返信は実tenant未検証である。
   sandbox 201/403 evidenceまたはMicrosoft support回答を得るまで適合済みと扱わない。
   Teamsアプリ自動インストールは未実装の将来要件であり、現時点では人間が対象チームへの
   インストール・同意とproject_channels登録を行う。アプリ側フィルタ（channelAuthorization）は維持する。
5. **会話写しはchannel_messagesテーブルに保存**（保存前にsanitizeSecrets必須）。
   Teams側の編集・削除はlast_modified_at/deleted_atで追従（物理削除しない）。
   保持期間はプロジェクト終了（project_channels.closed_at）から13か月後にDELETE
   （月次runbook化。DevOps監査ログ1年保持との整合）。
   会話履歴をLLMに渡す参照は `action: "channel_transcript_query"` で監査ログに記録する。
6. **clientStateの固定値ハードコードを廃止**し、環境変数GRAPH_CLIENT_STATE（ランダム値、
   16文字以上をzodで強制）を注入する。受信側はハッシュ化定数時間比較で検証し、
   不一致は破棄+監査ログ（攻撃兆候）としつつ202を返す（検証結果を外部に漏らさない）。
7. **LLMコスト台帳をPostgreSQL化**（PgCostGuard / llm_usage表）: 日次$20上限（SPEC-INT-060）を
   バッチエージェントとWebUIチャットでシステム全体共有し、agent別サブ上限を設定可能にする。
   日次リセットはJST基準（ASM-003）。
8. **フェイルセーフ時の停止範囲はREQ-029の危険操作に限定する**。GitHub Actions dispatch、
   xlsx import executeのGitHub書込、標準レポート配信、Teams会話由来の実行系dispatchなどは停止する。
   一方でGraph subscription renewal、channel pollingのread+enqueue、JIT revoke、運用CLIの
   `createGraphSubscription` は復旧・keepaliveに必要なため継続する。

## 根拠

- 要件(1)の会話全文取得にはGraphサブスクリプション+delta+保存パイプラインがどのみち必須であり、
  ボットSDKは@メンションされたメッセージしか受け取れないため要件(1)を満たせない。
  要件(2)はその上の選別・解釈レイヤに載る。SDKを併用すると認証2系統・Azureリソース追加・
  受信経路2本の運用コストが増える一方、得られるのはカードSubmitと即時性のみで、
  前者はWebUI（要件3）へのディープリンクで代替できる。
- RSCはテナント全体権限+保護API申請に比べ、「本基盤が作成したチームのみ」という要件の
  スコープ制限をプラットフォームレベルで強制できる。
- GitHub Actionsのcron最短実用間隔は約5分であり、30秒/毎分ループには常駐プロセスが必要
  （ADR-0003の決定を実体化）。

## 影響

- リポジトリ初のDockerfile（packages/server/Dockerfile）とsupervisorスクリプトが追加された。
  コンテナ実行基盤（AWS/Azure等）の最終選定はADR-0003から引き続き組織の残課題。
- Teamsアプリマニフェスト（docs/teams-app/）の組織カタログ登録、RSC事前同意設定、
  保護API申請の要否確認（リードタイム数週間）が導入前の人間作業として必要。
- GitHub認証は暫定的に環境変数トークン。GitHub App（JWT→installation token）への置換は
  インフラ導入時の残課題（packages/server/src/index.tsのヘッダコメント参照）。
- prjopsの重複Profile型定義を正本（reportJobStateMachine.ts）への再エクスポートに統一した
  （tsc project referencesの実ビルドで発覚した既存の潜在バグ修正）。
- packages/sharedのtsconfigにcomposite: trueを追加（同上）。

## Amendment（2026-08-10、P0-T03）

ADR-0025（Proposed）が Teams の rich conversational surface を追加する（部分 supersession）。Graph ingestion / RSC の決定は維持。
最終アーキテクチャ計画: docs/plans/2026-08-final-architecture/（PR #152、Owner 承認済み baseline-delta 適用）。
