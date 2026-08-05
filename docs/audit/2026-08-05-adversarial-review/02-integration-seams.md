<!-- 根拠: DevOps:SPEC-INT-061, DevOps:SPEC-INT-062, DevOps:SPEC-INT-080, ADR-0005, ADR-0006, ADR-0019 -->

# 02 統合シーム（ADV-INT）— GitHub / Claude Code / Teams / Outlook / Plane

反証対象の主張: 「GitHub・Teams・Outlook・Claude Code/Cowork・Plane の各統合は認証・再送・失敗時挙動の面で本番運用に耐える」。

**判定: 成立しない。** ただし内訳は統合ごとに大きく異なる。Graph（Teams/Outlook）は実装としてほぼ運用水準に達した。GitHub は基礎的堅牢化が大きく前進したが実行経路に致命的欠陥が残る。Claude Code の coding-task 経路は**実行すれば確実に失敗する**。Plane は**実装ゼロ**である。

## GitHub / Claude Code（001–049）

### ADV-INT-001 [High] claude-agent-sdk の read-only 経路がランタイム未結線 — SPEC-INT-011 手順4は実質未実装

- 実証: `packages/shared/src/clients/claudeAgentClient.ts:51-79` の read-only 強制（tools / allowedTools / disallowedTools / canUseTool の三層 fail-closed）自体は堅牢で、`packages/shared/tests/claudeAgentClient.test.ts` が allow/deny を検証する。しかし呼び出し元 `packages/devops/src/agents/AGT_BLD.ts:72`（`generateFixSuggestionIfApplicable`）はテスト以外から一切参照されず、server 側ハンドラはスタブ（01 章 ADV-WIR-001）。`grep -rn generateFixSuggestionIfApplicable packages/server` は 0 件。
- 併せて: テストは `vi.mock("@anthropic-ai/claude-agent-sdk")` によるモックのみで、実 SDK（0.3.210）に対する実行検証がない。旧監査が指摘した「安全装置ほどテストが薄い」構造は、カバレッジは改善しても**実 SDK 契約の未検証**として残る。工数 M。

### ADV-INT-002 [High] coding-task.yml は実行すれば確実に失敗する — CLI インストール手順が存在しない

- **本レビューで独自確認**: `.github/workflows/coding-task.yml` の全ステップ（Checkout → Setup pnpm → Setup Node.js → `pnpm install --frozen-lockfile` → Run coding agent → …）に **claude / droid CLI をインストールするステップが無い**。`.github/actions/run-coding-agent/action.yml:37` は `claude -p "${CODING_INSTRUCTION}" --permission-mode acceptEdits` を、`:50` は `droid exec "${CODING_INSTRUCTION}"` を直接呼ぶ。`pnpm install` はリポジトリ依存のみを入れる。
- したがって初回実行は `claude: command not found` で必ず failed になる。action.yml:23-26, 39-41 は「実運用時要検証: anthropics/claude-code-action の正式な利用方法が未確定」と自認、workflow:25-26 も「この開発環境では実行できない（構文的な妥当性のみ確認済み）」と自己申告している。
- 影響: ADR-0006 の中核（AI コーディングタスクの実行）が一度も成立しない。「ディスパッチは安全に動く」という主張は不成立。工数 M。

### ADV-INT-003 [High] CODING_TASK_CALLBACK_SECRET の二用途兼用により人間承認が回避可能

- 実証: `packages/server/src/config.ts:143-148` が兼用をコメントで明文化。`index.ts:247` で confirm リンク HMAC 鍵として teamsConversationAgent へ、`index.ts:483-484` で confirmTokenSecret と callbackSecret に同一値を渡す。この秘密は `coding-task.yml:189` ほかで GitHub Actions secrets として渡る。
- 攻撃シナリオ: Actions 側の権限保持者、または侵害された composite action が、callback 偽装にとどまらず **confirm トークン（`generateConfirmToken` = HMAC(taskId)）を自力生成できる**。これにより ADR-0006 の「人間の明示クリック必須」を回避して queued タスクを dispatch できる。
- 是正方向: 用途別に鍵を分離（`CODING_TASK_CONFIRM_SECRET` / `CODING_TASK_CALLBACK_SECRET`）。工数 S。

### ADV-INT-004 [Medium] confirm POST の TOCTOU による二重ディスパッチ

- 実証: `packages/server/src/http/routes/codingTasks.ts:134-147` の status チェック、`:169` の `dispatchWorkflow`、`:184` の `markConfirmedAndDispatched`（`db/codingTasksRepo.ts:115-121` は **WHERE に status 条件が無い無条件 UPDATE**）が非原子。
- 再現: 同一トークンで confirm POST を並行 2 本送ると双方が dispatch し得る。Actions の `concurrency: coding-task-${{ inputs.task_id }}`（`coding-task.yml:68`）はキャンセルせずキューするため 2 回実行され、2 本目は同名ブランチ push で衝突する。
- 是正方向: `UPDATE ... SET status='running' WHERE task_id=$1 AND status='queued' RETURNING` を dispatch 前に置く。工数 S。

### ADV-INT-005 [Medium] callback 喪失時に台帳が running で永久スタック

- 実証: 3 つの callback ステップの `curl -sS`（`coding-task.yml:183, 200, 216`）に `-f/--fail` もリトライもなく、サーバが 409/500 を返しても exit 0 でジョブは成功扱い。逆にサーバ到達不能なら成功パスの callback が fail し、続く failure callback も同じ理由で fail。いずれも coding_tasks は running のまま残る。
- `packages/server/src/scheduler/tasks/` に coding_tasks を回収する reconcile タスクは無く、`workflow_run` webhook もスタブ（01 章）のため台帳を更新しない。回収は手動 runbook のみ。工数 M。

### ADV-INT-006 [Medium] webhook リプレイ: delivery id が署名対象外

- 実証: HMAC（`packages/shared/src/clients/githubClient.ts:34-45`）はボディのみを署名し、dedupe キーの `X-GitHub-Delivery` はヘッダ（`http/routes/githubWebhook.ts:55`）。署名済みペイロードを観測できた攻撃者は delivery id を差し替えるだけで dedupe を通過し、同一イベントを何度でも再エンキューできる。タイムスタンプ鮮度検査もない。TLS と secret 管理が前提防御のため Medium 下限。工数 S。

### ADV-INT-007 [Medium] disabled モードの「静かな劣化運転」が残存

- 実証: `packages/server/src/auth/githubAppTokenProvider.ts:132-144` — 未設定時は起動時 1 回の監査 + 恒常 503 を返す偽 fetch で起動成功（**06 章 D7c で `github_auth_not_configured` 監査行を実観測**）。
- 改善点: `githubCompositionPolicy`（`index.ts:125-131`）が JIT 失効タスク skip（`:305-315`）、pmSnapshot の監査付き no-op、confirm ルートのブロック（`:491`）、xlsx import 無効化（`:498`）までゲートするようになった。
- 残存: (a) `/readyz`（`http/routes/health.ts:27-37`）は github mode を反映せず ready=true（**D7c で実観測**）— 運用監視からは正常に見える。(b) confirm ブロック時のメッセージが「フェイルセーフ中のため…」（`codingTasks.ts:165`）で auth 未設定と failsafe が区別不能。(c) 偽 fetch 経由の呼び出しは `E-GEN02 ... status 503` に化け追加監査もない。工数 M。

### ADV-INT-008 [Medium] E-AUTH02 の opaque 飲み込みとトークン失効の欠陥

- 実証: `githubAppTokenProvider.ts:83-85` の `catch { throw new Error(AUTH_ERROR) }` が、ネットワーク断・401（鍵不正）・404（installation 誤設定）・タイムアウトを同一文言に潰し、原因がログにも監査にも残らない。
- さらに: トークン取得はリトライ無しの単発。`GitHubClient` は `headers()` を `fetchWithBackoff` の**外側で 1 回だけ**呼ぶ（`githubClient.ts:143-145` 他）ため、最大 15 分 × 5 回のバックオフ中に installation token（60 分）が失効し得る。失効後の 401 はリトライ対象外なので長いバックオフの末に失敗する。工数 M。

### ADV-INT-009 [Medium] deploy-prod.yml が `.github/workflows/` に存在しない

- 実証: 実在するのは ci.yml / coding-task.yml / report-generation.yml のみ。`packages/devops/src/agents/AGT_DEP.ts:87-93, 138-141` が dispatch する `deploy-prod.yml` はテンプレート（`packages/devops/src/workflows/deploy-prod.yml`）としてのみ存在し、配備手順・検証がない。dispatch すれば 404 → E-DEP01。`executeProdDeploy` 自体が未結線（01 章）のため実害は潜在的だが、「dispatchWorkflow の参照先実在」は不成立。工数 S。

### ADV-INT-010 [Low] レート制限対応の残穴

- (a) GraphQL は POST のため non-idempotent 扱いとなり、読み取り専用クエリ（Projects v2 snapshot 取得等）でも 5xx を再試行しない（`githubClient.ts:127-129`）。(b) GraphQL の RATE_LIMITED は HTTP 200 + errors で返るが `githubClient.ts:187` は内容を破棄して `E-GQL02` を投げるだけ。(c) Retry-After 無しの secondary rate limit 403 は再試行しない仕様として固定（`packages/shared/tests/githubClientPolicy.test.ts:33`）。工数 S。

### ADV-INT-011 [Low] ADR-0006 前提の機械的強制は限定的

- 実証: `scripts/check-codeowners.mjs:9-11` は CODEOWNERS が**存在しなければ exit 0** — ファイル削除で素通り。検証内容もトークンが検証済みセット（@mryfmo）かのみ。branch protection / Require review from Code Owners / 自動マージ禁止はリポジトリ設定依存で ruleset 定義がリポジトリ内になく、`runbooks/production-gates.md:15` 自身が「This does not prove branch protection is enabled」と自認。工数 S（ただし GitHub プラン依存の HUMAN gate）。

### ADV-INT-012 [Low] confirm トークンに有効期限・失効がない

- 実証: `packages/server/src/lib/confirmToken.ts:17-19` は HMAC(taskId) のみで期限・nonce なし。queued 放置のタスクの確認リンクは永久に有効。GET でトークンが URL クエリに乗る（`codingTasks.ts:101`）ためアクセスログ経由の漏洩面もある。工数 S。

### GitHub 側の解消済み事項

| 旧所見                                                       | 現状                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHubClient に retry/backoff なし（SPEC-INT-080 違反）      | **解消**。`packages/shared/src/clients/fetchPolicy.ts` の `fetchWithBackoff`（初期 30s／最大 15min／jitter／Retry-After 尊重）を `githubClient.ts:121-130` で全 REST/GraphQL が経由。429・有効な Retry-After 付き 403・冪等 5xx を再試行。テスト実在 |
| GitHub App 認証が `GITHUB_TOKEN ?? ""` スタブ（AUD-IMP-001） | **解消**。`githubAppTokenProvider.ts` が RS256 App JWT → installation token（キャッシュ + single-flight）。App 3 変数は all-or-none 強制（`config.ts:152-160`）                                                                                      |
| callback Bearer のタイミング攻撃                             | **解消**。`confirmToken.ts:51-57` の timingSafeEqual を `codingTasks.ts:205` が使用                                                                                                                                                                  |
| callback の状態遷移ガード                                    | **概ね解消**。ルート層 `codingTasks.ts:237-247` + DB 層 `codingTasksRepo.ts:131-135`（`WHERE status='running'`）の二層                                                                                                                               |
| webhook dedupe 不在                                          | **解消**。`X-GitHub-Delivery` 必須化（欠落 400）+ `ON CONFLICT (dedupe_key) DO NOTHING`（**06 章 D7c で dedupe_key 記録を実観測**）                                                                                                                  |
| AIOPS_PR_TOKEN 未設定の silent 失敗                          | **解消**。`coding-task.yml:70-78` で fail-fast                                                                                                                                                                                                       |
| GITHUB_PROJECT_NODE_ID 未設定の silent no-op                 | **概ね解消**。`index.ts:269-284` で毎回監査付き no-op                                                                                                                                                                                                |

## Microsoft Graph — Teams / Outlook（050–079）

### ADV-INT-050 [High] 初回購読作成が手動 CLI のみ・購読ゼロ状態の検知手段なし

- 実証: 復旧経路は `graph_subscriptions` 台帳の既存行しか対象にしない（`scheduler/tasks/channelPollingTask.ts:90`、`subscriptionRenewalTask.ts:37`）。初回作成は `packages/server/src/tools/createGraphSubscription.ts`（CLI）だけで、起動時に project_channels と台帳を突合して欠落購読を作る経路がない。`runbooks/graph-subscription-recovery.md:47` 自身が「削除した行は自動再作成されない」と明記。`packages/server/src/observability/metrics.ts` に購読状態の gauge がなく、`runbooks/observability-slo.md` の SLO にも polling 固着・購読ゼロの監視項目がない。
- 影響: オンボーディング時の CLI 実行漏れや台帳行の誤削除で、当該チャネルの Teams 収集が**監査ログすら残さず**停止し、サーバは健全に見える。工数 M。

### ADV-INT-051 [Medium] 配信失敗のリトライ粒度が「翌週」

- 実証: 配信サイクルは週の第 1 営業日ゲート（`reportDeliveryTask.ts:287`）。sendMail / カードは非冪等 policy のため 5xx を再試行しない（`fetchPolicy.ts:88`）。失敗は pending 記録が残り、次サイクル = 翌週に「(再送)」で再送（`AGT05_distributor.ts:47-76`、`idempotentDelivery.ts:60-63`）。heartbeat は failed==0 かつ当週処理済みのときのみ発火（`reportDeliveryTask.ts:316`）。
- 影響: 一過性の Graph 5xx でも該当受信者への配信が 1 週間遅延し、手動再送 runbook 頼み。工数 M。

### ADV-INT-052 [High] 「missing config = disabled + audited」縮退の合成リスク

ADR-0014 の原則自体は正しく、個々の実装も監査を残す。しかし**縮退が積み重なった状態が観測不能**である点が問題。全数列挙:

1. `REPORT_DELIVERY_ENABLED`(既定 false)/`FROM_MAILBOX` 未設定 → `report_delivery_disabled`（`reportDeliveryTask.ts:273-285`、`index.ts:509-523`）
2. `REPORT_INGEST_SECRET` 未設定 → ingest 503 + 監査（`reportIngest.ts:42-51`）— レポートが届かないので配信も空回り
3. `XLSX_IMPORT_SECRET` 未設定 → import 無効
4. `STAKEHOLDERS_DIR` 未設定 → 全 Teams コマンド拒否（`stakeholderYamlLoader.ts:28-36`）
5. `ANTHROPIC_API_KEY` 未設定 → 自由文解釈無効（`index.ts:190`、`teamsConversationAgent.ts:327`）
6. GitHub App/PAT 未設定 → GitHub outbound 無効 + jitRevocationTask 未スケジュール（`index.ts:305-315`）
7. `GITHUB_PROJECT_NODE_ID` 未設定 → `pm_snapshot_reconcile_disabled`
8. sevenKeysMonthlySnapshotTask は provider が常に未注入 → 設定に関係なく毎月 disabled（01 章 ADV-WIR-004）
9. `HEARTBEAT_URL` 未設定 → dead man's switch なし
10. `METRICS_TOKEN` 未設定 → /metrics 無認証（warn のみ。06 章 ADV-DYN-001）
11. `DEFAULT_TEAMS_*` 未設定 → カード配信なし
12. OTEL 未設定 → telemetry 無効

- **本レビューで実証**（06 章 D7c）: 必須 env のみの最小構成で起動すると、Teams コマンド・ingest・配信・snapshot・Seven Keys が全部無効のまま `/healthz` `/readyz` ともに 200。無効化の証跡は監査ログのみでメトリクス化されておらず、SLO「配信成功率」は分母 0 を検知できない。外形検知は任意設定の `HEARTBEAT_URL` 一本。
- 是正方向: 縮退状態を `/readyz` の degraded 表現かメトリクス gauge に昇格させ、「有効化されているべき機能が無効」を検知可能にする。工数 M。

### ADV-INT-053 [High] app-only チャネル投稿の実テナント検証が未了（HUMAN gate）

- 実証: `docs/adr/0005-*.md:34-37` が「app-only 通常 root 投稿・返信は実テナント未検証」と明記したまま。`packages/server/src/tools/graphSmoke.ts:61` の evidence status は `"pending_delegated_or_ui_tenant_phase"`。`docs/audit/09-remediation-plan.md` の T-P0-12（実環境 E2E、app-only 投稿可否確認）は未チェック。
- 影響: RSC `ChannelMessage.Send.Group` 前提が実テナントで崩れると、Teams 返信・カード配信（replyToMessage / sendAdaptiveCard）が本番で全滅する。go-live 前の必須ゲート。工数 S（実施のみ、ただし実テナント必須）。

### ADV-INT-054 [Low] /webhooks/graph に body サイズ制限がない

- 実証: bodyLimit は xlsxImport のみ（`http/routes/xlsxImport.ts:123`）。graphNotifications は無認証で `c.req.json()` 全読み（`graphNotifications.ts:92`）。LB/WAF の実設定は未確定（T-P1-07）。工数 S。

### ADV-INT-055 [Low] AC-018-1（2000 通/2h）の throughput 制御なし

逐次送信 + 429 backoff のみで、スループット目標に対する設計上の担保がない。工数 M。

### ADV-INT-056 [Low] SPEC-INT-001 の Outlook 受信経路が未実装

`createSubscription` は Teams チャネルリソースしか受理しない（`graphClient.ts:378-401`）。配信専用の現趣旨には影響しないが仕様記述と乖離。工数 M。

### Graph 側の解消済み事項

| 旧所見                     | 現状                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 購読更新失敗の silent 停止 | **解消**。renew 失敗 → `mode='polling'` 遷移 + 即時 backfill（`subscriptionRenewalTask.ts:41-62`）、lifecycle 3 イベント処理（`lib/graphLifecycleHandler.ts:58-116`）、polling task による renew/再作成の自動復旧（advisory lock + 条件付き publish + 失敗時 cleanup、`channelPollingTask.ts:106-236`）、runbook 完備。4320 分上限は 4315 分ターゲット + 6h 更新マージン + 30 分間隔で整合 |
| SAMPLE_STAKEHOLDERS        | **排除済み**。YAML 関係者マスタ経由、未解決は fail-closed + 監査。slash/自由文の両経路で `checkCommandPermission`、返信は `sanitizeSecrets` 適用                                                                                                                                                                                                                                           |
| webhook 検証               | **健全**。validationToken ハンドシェイク（text/plain 200）、SHA-256 定数時間 clientState 比較、dedupe、fetch-on-notify。イベントは backoff 付きリトライ + 5 回で dead-letter + 監査（`eventsPollingTask.ts:76-106`）                                                                                                                                                                       |

## Plane（080–099）

### ADV-INT-080 [Critical（ユーザー趣旨に対して）] Plane はランタイム実装ゼロ

- **本レビューで独自確認**: `grep -ril plane packages/` = **0 件**。PlaneClient・webhook ルート・pm_events への Plane 経路・環境変数、いずれも存在しない。
- 存在するのは文書と契約物のみ（tracked 7 ファイル）: `docs/adr/0019-plane-workflow-backend.md`（採用 2026-07-19）、`plans/014-plane-integration.md`（**Status: TODO**）、`docs/security/plane-data-governance.md`、`docs/contracts/schema/plane-environment-mapping.schema.json` + dev fixture、`scripts/validate-plane-environment-mapping.mjs`、`tests/validate-plane-environment-mapping.test.mjs`。validator は CI 配線済み（`package.json:16-17`、`.mise.toml:42-48`、`.github/workflows/ci.yml:21`）。
- 結論: ユーザーが挙げた構成要素のうち **Plane だけは「設計承認済み・実装未着手」**。到達点は Phase A の一部（mapping contract + governance 文書）であり、shadow observation（Phase B）にすら未着手。plans/014 自身が Phase B までは外部 write 開通なし・Phase C は owner decision 必須と定めている。GitHub Projects v2 が現行のボード正本（DEC-SPEC-008）であり続けている。工数 L。

### ADV-INT-081 [High] Plane governance 承認の証跡が欠落

- **本レビューで独自確認**: `docs/security/plane-data-governance.md:169-172` は承認 basis を `.orchestration/acceptance/plane-data-governance-owner-approval.md` とするが、**当該ファイルは git 管理下に存在しない**（tracked な `.orchestration/` 配下は P010-F01-T10/T11 と P012-F00-T01 の 5 ファイルのみ）。P014-FA-T01〜T03 の evidence も 0 件。
- 影響: T03 が要求する live sandbox 実測（#5757 probe、backup/restore、60req/min）の記録なしに、ADR 採択と同日（2026-07-19）に APPROVED となっており、承認主張と証跡が乖離。リポジトリ自身の「ENV 証跡なきものは BLOCKED であり DONE ではない」原則（DEC）に反する。工数 S。

### ADV-INT-082 [Medium] STOP ゲート（Plane issue #5757）の probe 未実施

- 実証: ADR-0019:35-37, 196 は「negative probe を導入前 STOP gate」「release ごとに probe」と規定するが、実施記録がリポジトリにない。実装ゼロの現状では即時リスクではないが、P014-FA-T04 の STOP 条件に該当したまま Phase A は未受入。工数 S。

### ADV-INT-083 [Medium] Plane 仕様 ID が traceability 未登録

- 実証: REQ-045 / SPEC-INT-091 / AC-045-1 は `packages/traceability/spec-ids/{prjops,devops}.json` に 0 件。ADR-0019 §8「初参照コードと同 PR で登録」に照らせば手順違反ではないが、Plane 要件は CI ゲートの完全に外にあり、未実装が機械的に検知されない。工数 S。

### ADV-INT-084 [情報] mapping contract 自体は健全（良好例）

dev fixture は `signature: "DEV-DEFAULT-unsigned"` + `replace_before_go_live: true` を明示し、validator が CI で毎回実行される。Phase A 成果物としての品質は高い。

## 統合別サマリ

| 統合                                     | 実装到達度                                   | go-live 阻害要因                                              |
| ---------------------------------------- | -------------------------------------------- | ------------------------------------------------------------- |
| GitHub（認証・webhook・API）             | 高（backoff/HMAC/dedupe/App 認証すべて実装） | disabled 縮退の可視性、鍵兼用（ADV-INT-003）                  |
| GitHub（実行経路: coding-task / deploy） | 低                                           | CLI 未インストール（002）、deploy workflow 未配備（009）      |
| Claude API（構造化抽出・chat）           | 高                                           | —                                                             |
| Claude Code / claude-agent-sdk           | 低                                           | ランタイム未結線（001）、実 SDK 未検証                        |
| Teams / Outlook（Graph）                 | 高                                           | 初回購読手動（050）、縮退合成（052）、実テナント未検証（053） |
| Plane                                    | **ゼロ**                                     | 実装未着手（080）、承認証跡欠落（081）                        |
