<!-- 根拠: PrjOps:REQ-032, DevOps:REQ-030, DevOps:REQ-028, ADR-0006 -->

# 03 セキュリティ・データガバナンス（ADV-SEC）

反証対象の主張: 「(1) 三層サニタイズは実効的、(2) 監査ログは追記専用が DB 権限レベルで強制される、(3) 権限フィルタはデータ取得側で必ず経由する、(4) 秘密情報は漏れない」。

**判定: いずれも部分的に反証される。** 中央ゲート・トリガ・fail-closed 設計など基礎は堅牢で、旧監査の指摘の多くが解消済み。しかし三層サニタイズには GitHub events 経路と AGT_INC 出力の穴があり、追記専用の「DB 権限レベル強制」は `app_role` の存在が前提の条件付き、最大の実リスクは coding-task ワークフローの資格情報残留である。

## ADV-SEC-001 [High] coding-task の書込境界が分岐保護のみに依存し、資格情報が AI エージェント実行中に残留する

- **本レビューで独自確認**: `.github/workflows/coding-task.yml:81-85` — `actions/checkout@v7` に `token: ${{ secrets.AIOPS_PR_TOKEN }}` を渡し、`persist-credentials` を指定していない（既定 true = `.git/config` に資格情報が永続化）。その後 `:108-115` で run-coding-agent を実行し、`.github/actions/run-coding-agent/action.yml:37` が `claude -p "${CODING_INSTRUCTION}" --permission-mode acceptEdits` を呼ぶ。`:136` の `git commit` に `--no-verify` はない。
- 攻撃シナリオ: Teams の code_task 指示（外部由来・prompt injection 可能）で起動された AI エージェントは `acceptEdits` によりファイル編集が自動承認される。`.git/hooks/pre-commit` を「編集」させれば、後続の commit ステップでフックが実行され、`.git/config` の `AIOPS_PR_TOKEN`（contents:write）を使う任意コードが走る。`git push origin HEAD:main` を仕込めば `agent/*` 外への push が成立し、残る境界はブランチ保護のみ。AGENTS.md 自身が「go-live 前にブランチ保護で CODEOWNERS review 必須化を確認する」としており、現時点で強制は未確認（02 章 ADV-INT-011）。
- 是正方向: checkout に `persist-credentials: false`、push ステップのみ一時的に認証を付与。加えて `git commit --no-verify`、エージェント実行前に `core.hooksPath=/dev/null`、ブランチ保護の即時確認。工数 S。

## ADV-SEC-002 [High] CODING_TASK_CALLBACK_SECRET の兼用で confirm トークンを偽造できる

- 実証: `packages/server/src/index.ts:247, 483-484`（`confirmTokenSecret` と `callbackSecret` に同一値）、`packages/server/src/lib/confirmToken.ts:17-18`。この秘密は callback 用として GitHub リポジトリ secrets に登録され、Actions ランナーと curl 送信（`coding-task.yml:184`）に露出する。
- 攻撃シナリオ: Actions 側で漏えいすると、攻撃者は queued 状態の任意 taskId に対する HMAC トークンを再計算し、`POST /coding-tasks/:id/confirm` を直接叩いて**人間クリックなしで** workflow_dispatch を起動できる。ADR-0006 の核心（誤発火防止のための人間の明示クリック必須）が単一秘密の漏えいで崩れる。信頼ドメインが異なる 2 用途に 1 秘密を使う設計の問題。
- 是正方向: `CODING_TASK_CONFIRM_SECRET` を分離新設し、サーバ内にのみ保持する。工数 S。（02 章 ADV-INT-003 と同一事象を攻撃者視点で記述）

## ADV-SEC-003 [Medium] code_task の projectId が LLM/ユーザー由来のまま無検証でリポジトリ解決に使われる

- 実証: `packages/server/src/agents/teamsConversationAgent.ts:431-436`（`intent.projectId` をそのまま台帳へ INSERT、`channel.projectId` との突合なし）、`packages/server/src/lib/freeTextIntent.ts:45`（projectId は LLM が本文から抽出）、`packages/server/src/http/routes/codingTasks.ts:149`（confirm 時に `resolveRepoForProject(task.projectId)` で対象リポジトリを決定）。
- 攻撃シナリオ: プロジェクト A のチャネルに投稿された自由文（または `/code_task PJ-999 ...`）で、別プロジェクト向けのコーディングタスクが queue される。権限判定 `resolveCallerProfile` は `channel.projectId`（= A）に対して行われるため、A の権限で B のリポジトリに対するタスクが作れる。確認ページに projectId は表示されるが、人間が見落として承認すれば越境実行になる。`gh_*` 系はチャネル紐付けの owner/repo を使っており安全なのと非対称。
- 是正方向: `intent.projectId !== channel.projectId` の場合は拒否（または channel.projectId で上書き）。工数 S。

## ADV-SEC-004 [Medium] GitHub webhook の生ペイロードが sanitizeSecrets なしで DB 保存される — 層(a)の反例

- **本レビューで独自確認**: `packages/server/src/http/routes/githubWebhook.ts:67` が検証後の `payload` をそのまま enqueue し、`packages/server/src/db/eventsRepo.ts:111, 117` が `JSON.stringify(payload)` を INSERT。sanitize 呼び出しなし。
- シナリオ: commit メッセージ・issue/PR 本文に混入したトークンが平文で events テーブルに残る。dead-letter 行は長期残存し得る。設計原則 4「外部由来テキストは DB 保存前に `sanitizeSecrets()`」への直接違反。
- 対照: Graph 通知側（`graphNotifications.ts:131-141`）はメタデータのみ保存で適合、Teams 本文は取得時に sanitize 済み（`teamsConversationAgent.ts:218`）で適合。**GitHub 経路だけが穴**。
- 是正方向: enqueue 前に payload の文字列フィールドへ適用、または `eventsRepo.enqueue` 内で一律適用。工数 S。

## ADV-SEC-005 [Medium] 監査ログの「DB 権限レベル強制」は app_role が存在する場合のみ成立

- 実証: `packages/devops/src/db/schema.sql:353-359` — `IF EXISTS (... rolname = 'app_role')` の DO ブロック内でのみ REVOKE/GRANT。ロール不在なら黙ってスキップする。`runbooks/secret-rotation.md:79` は server/web/CLI が単一ログインか最小権限分離かを **TBD(HUMAN)** としている。
- シナリオ: 単一 `DATABASE_URL`（= スキーマ適用者と同一ログイン）運用なら、アプリ接続はテーブルオーナー相当となり、`DROP TRIGGER audit_log_block_update_delete` の 1 文で改変防止が外せる。
- ただし: トリガ防御（`schema.sql:236-306`、全パーティション + 新設パーティションにも付与）と Writer の append-only 型（`pgAuditLog.ts` / `auditLog.ts` に UPDATE/DELETE 経路なし）は健全であることを確認済み。**06 章 D5 では app_role を作成した状態で UPDATE/DELETE 拒否を実観測しており、ロールがある限り強制は本当に効く**。
- 是正方向: app_role 不在時は migrate を fail させる、または readiness チェックで current_user の audit_log 権限を検証する。工数 S。

## ADV-SEC-006 [Medium] sanitizeForLlmInput は依然 alias、パターン網羅と分割耐性に穴

- 実証: `packages/shared/src/secretSanitizer.ts:178-180`（alias のまま）、`:25-39`（パターン表）、`:53-57`（suspicious hex/base64 マスクは **opt-in** で、本番コードのどこからも `maskSuspiciousSequences: true` が渡されていない）。
- バイパス例: AWS Secret Access Key（40 字 base64 風）・Azure Storage `AccountKey=`/SAS・Slack `xox*`・GCP service account key・`password=` kv・`npm_` トークンは非対象。**改行分割**（ビルドログで 80 桁折返しされた `ghs_...` は `[A-Za-z0-9]{20,}` に不一致で素通り）は、AGT_BLD がビルドログを LLM に渡す主経路であるだけに現実的。base64 二重化も素通り。
- 解消済みの側面: NFKC 正規化シャドウ（`:72-92`）により unicode 均質化バイパスは対策済み。優先度付き非重複マッチも堅牢。
- 是正方向: LLM 入力ゲートでは `maskSuspiciousSequences: true` を既定有効化し、パターン表に AWS secret / Azure 接続文字列 / Slack / password kv を追加。工数 S。

## ADV-SEC-007 [Medium] anthropicClient.call の system プロンプトが非サニタイズ（現状は潜在）

- 実証: `packages/shared/src/clients/anthropicClient.ts:308` が `opts.user` のみ sanitize、`:360` は `opts.system` を生のまま送信。
- 現状評価: 全呼び出し元（AGT-02:133 / AGT-03:93 / AGT-04:82 / AGT_BLD:45 / AGT_INC:56 / AGT_CHG:40 / freeTextIntent:58 / web systemPrompt.ts）を確認した結果、system は静的文字列またはプロファイル enum 補間のみで、**外部制御テキストの system 混入経路は現存しない**。ただし将来の呼び出し追加で無防備になる構造は残る。web の pageContext（`chatHandler.ts:71-79`）は sanitizeForLlmInput 済み。
- 是正方向: `call()` 内で system にも適用（1 行）。工数 S。

## ADV-SEC-008 [Medium] AGT_INC の LLM 出力が無検査で GitHub Issue へ出力される — 層(c)の反例

- 実証: `packages/devops/src/agents/AGT_INC.ts:60`（`recentMetricsSummary` / `similarIncidentsSummary` を sanitize なしで user プロンプトへ連結。中央ゲートで最終的には sanitize されるため層(b)は救済されるが局所規約と不整合）、`:84-85`（`classification.rationale` / `affected_projects`（LLM 出力）を sanitizeSecrets / isFreeOfKnownSecrets なしで Issue title/body へ）。
- 攻撃シナリオ: prompt injection されたアラート本文が rationale に秘密風文字列や誘導文を復元させた場合、そのまま公開度の高い GitHub Issue に出る。`teamsConversationAgent`（`:406-407`）や AGT-03（`:105-116`）が出力前サニタイズを行っているのと非対称。
- 是正方向: createIssue 前に sanitizeSecrets を適用し、AGT-03 同様の isFreeOfKnownSecrets フォールバックを置く。工数 S。

## ADV-SEC-009 [Medium] 配信タスクの権限フィルタが実質トートロジー、未知プロファイルは fail-open 気味

- 実証: `packages/server/src/scheduler/tasks/reportDeliveryTask.ts:122-145` — `projectId: recipient.projects[0]`、`ownerStakeholderId: recipient.userId` の擬似 issue を作って `filterIssuesForProfile` に通す。`:102-109` は未知プロファイル → `PRF-03`、`PRF-G` → `PRF-04` へ格上げマッピング。`:111-120` は未知 → `PRF-G` 既定。
- シナリオ: レポート slots は受信者属性でラベル付けされるため `isProjectInScope` は projects が 1 件でもあればほぼ常に真。レポート本文が特定プロジェクトの機微を含む場合でも、スコープ外受信者への配信をこのフィルタは阻止できない。設計原則 6「権限フィルタはデータ取得側で強制」の実効性が、standardReports の内容が全社共通であることに依存している。
- ただし: 投資家向け detail マスク（`[masked]`）は機能し、`isActiveRecipient` はリクエスト毎再読込（`recipientsRepo.ts:65-72`、キャッシュ禁止規約を遵守）。
- 是正方向: report payload 側に対象プロジェクト/対象 audience のメタデータを持たせ、受信者属性でなくデータ属性でフィルタする。未知プロファイルは配信スキップ（fail-closed）へ。工数 M。

## ADV-SEC-010 [Low] 確認トークンが GET クエリ・Teams 返信に平文で載る

- 実証: `teamsConversationAgent.ts:442`（confirmUrl をチャネル返信 = 全メンバー可視）、`codingTasks.ts:101`（GET クエリの token はアクセスログ/プロキシログに残存）。
- シナリオ: 依頼者以外のチャネルメンバー（プロファイル権限のない人を含む）がリンクをクリックして confirm 可能。confirm 時に操作者の身元検証がなく、監査ログにも「誰がクリックしたか」が残らない（actor: "SERVER"）。ADR-0006 の「人間の明示クリック」は成立するが「**誰の**クリックか」が失われる。
- 是正方向: confirm を WebUI 認証セッション配下に置くか、操作者 ID を要求して監査へ記録。工数 M。

## ADV-SEC-011 [Low] /metrics が公開 Hono エンドポイントで無認証

- 実証: `packages/server/src/http/routes/metrics.ts:9-11`、`http/app.ts:63`。**06 章 D7c で実際に 200 を観測**、起動時 warn のみで継続。
- シナリオ: ADR-0005 で公開エンドポイントは 1 つに集約されているため、キュー深度・配信成否件数等の運用内部情報がインターネットに露出し得る。工数 S。

## ADV-SEC-012 [Low] pino ロガーに redact 設定がない

- 実証: `packages/server/src/observability/logger.ts:8-10`。現状の呼び出しは安全な値のみだが、将来 `logger.info({ config })` のような誤用が起きた際の最終防波堤がない。工数 S。

## ADV-SEC-013 [情報] Plane データガバナンスは文書のみ

`docs/security/plane-data-governance.md` の 16 フィールド allowlist を強制する実装は存在しない（packages 配下に plane 参照 0 件）。現時点で Plane データを扱うコードがないため違反もないが、実装着手時に allowlist をスキーマ/バリデータとして持ち込むこと。02 章 ADV-INT-080/081 参照。

## 旧監査からの解消状況

| 旧指摘                                    | 現状                                                                                                                                                                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Graph clientState の非定数時間比較        | **解消** — SHA-256 + timingSafeEqual（`graphNotificationValidator.ts:15-20`）                                                                                                                                                                       |
| coding-task callback の平文 `!==` 比較    | **解消** — `verifyBearerToken` に統一（`confirmToken.ts:51-57`）                                                                                                                                                                                    |
| callback の状態遷移ガード欠如             | **解消** — running からのみ遷移許可 + DB 側ガード                                                                                                                                                                                                   |
| web chat の costGuard.record 未呼出       | **解消** — reserve/reconcile 方式（`chatHandler.ts:158-201`）                                                                                                                                                                                       |
| data API エラーの内部情報漏えい           | **解消** — 既知エラーのみ透過（`dataApiSupport.ts:37-49`）                                                                                                                                                                                          |
| audit_log パーティション権限伝播          | **解消/強化** — `ensure_audit_log_partition` が新設パーティションにも block トリガを付与（`schema.sql:245-306`）。06 章 D5 で実 DB 検証済み                                                                                                         |
| Teams 返信の出力前サニタイズ漏れ          | **解消** — `reply()` で一律 sanitizeSecrets                                                                                                                                                                                                         |
| SAMPLE_STAKEHOLDERS ハードコード          | **解消** — YAML マスタ + fail-closed                                                                                                                                                                                                                |
| web middleware matcher が /dashboard のみ | **実質解消** — 全 6 data handler + chat + persona が `resolvePersonas`（requireSession + requirePersona）を通る。ただし default-deny ミドルウェアがないため新規 route 追加時の適用漏れリスクは構造的に残る。Next 16.2.10 は CVE-2025-29927 の影響外 |
| webuiProxy のヘッダ素通し                 | **概ね現状維持** — host のみ削除（`webuiProxy.ts:53-54`）。Next 16 のため実害となる既知ヘッダは確認できず。hop-by-hop ヘッダ削除は未実装（Low）                                                                                                     |
| sanitizeForLlmInput が alias              | **残存**（ADV-SEC-006）                                                                                                                                                                                                                             |
| anthropicClient の system 非サニタイズ    | **残存**（ADV-SEC-007、現呼び出し元は静的 system のみ）                                                                                                                                                                                             |

## 問題なしと確認した項目（良好例）

- Webhook 検証順序: GitHub は生ボディ HMAC → parse の順で正しい。report ingest / xlsx import も HMAC 検証先行。
- 監査ログ Writer: append() 以外の変異メソッドなし、E-AUD02 秘密混入拒否、`validateReasonRequirement` 適用。
- recipients の active 判定: リクエスト毎に DB 再読込、キャッシュなし（規約遵守）。
- web chat tools: ViewSpec のみ返却・実データ非返却・zod 検証・show_project_board のスコープ検証・ペルソナ別 tool 非公開。LLM の tool 引数からデータ取得への直結なし。
- devops `isProjectInScope`: scopeMode 未設定時 false の fail-closed。
- TokenProvider 注入と固定エラーメッセージ（秘密の非露出）。
- claudeAgentClient の read-only 三重 fail-closed（allowedTools / disallowedTools / canUseTool）。
- Teams 取込: channel 台帳 + RSC の二重防御、保存前・LLM 前・返信前サニタイズ。
