# 全域敵対的レビュー報告書（2026-08-18）

- 対象: ai-ops-platform 全体（references/・docs/・全実装コード・全検証コード・contracts/scripts/deploy ガバナンス層）
- 基準コミット: 5548fc4（branch: chore/wave4-checkpoint-sync）
- 体制: Claude オーケストレータ + 8 面の並列敵対的レビュー（shared+prjops / devops / server / web / セキュリティ / 仕様トレーサビリティ / docs・references / ガバナンス層）+ CI 実測
- 手法: 各レビューは疑わしい所見をコード全経路読解で裏取りし、確認不能なものは破棄。最重要所見（承認パス）はオーケストレータが一次ソースで再検証済み。機械的再現を伴う所見は明記。

## 0. エグゼクティブサマリ

**lib 層・信頼境界（webhook 署名・監査 append-only・権限フィルタ・サニタイズ結線・deploy 設定群）は段階の割に異例に堅牢。一方、システムを閉じるループ（承認→デプロイ、エスカレーション、レポート配信、agent 実行ガード）が複数箇所で未結線・機能不能であり、現状は「高品質なライブラリ群 + 未クローズの運用ループ」である。** さらに「green」シグナル（`mise run ci` / `mise run traceability`）は完成証明として読めないことが実証された（AC 無結線 51% でも green、捏造 ID 併記バイパス実証）。ドキュメント入口層（README / AGENTS.md / VERIFICATION_REPORT）は実装より 4〜6 週遅れ。

CI 実測: DB 不要 11 ステップ（governance / policy:rego / contracts / audit / actionlint / lint / traceability / format / build / typecheck / test:coverage）は各ステップ単独実行・exit code 個別確認で全て green。テスト 9 パッケージ約 3,004 件 pass / 38 skip / 失敗 0。`db:require` / `verify:db` は実 PostgreSQL 不在のため本環境では未検証（後述 DoD 環境依存の問題）。

## 1. 最重要（Critical — 意図した動作が成立しない）

### C-1. 人間承認決定パスが end-to-end で機能不能（REQ-010「承認なしに本番デプロイなし」の根幹）
3 つの独立ブロッカーが相互確認され、うち (a) はオーケストレータも一次ソース確認済み:
- (a) `packages/web/src/server/approvalsClient.ts:118` は `{decision, reason}` のみ送信するが、`packages/server/src/http/routes/approvals.ts:235-255` は `action:"approval_decision"` / `approvalId` / `version>=1` / HMAC `correlation` を必須とする → WebUI の承認/差し戻しボタンは常に 400。
- (b) `signApprovalCardCorrelation` の本番呼出ゼロ、`channel-teams` の approvalCard は未結線 → 有効な correlation を取得する経路が存在しない。
- (c) `ApprovalsRepo.create` は `expected_version` / `expires_at` を設定せず（設定するのはテストのみ）、`decide()` の CAS は NULL 列で恒久 false → 常に `ApprovalStaleVersionError`。
- 加えて composition root で `signalApprovalDecision` 未結線のため decision ルートは常時 503（P3 Temporal 待ちに見えるが無標示）。UI は動くように見える死んだボタンを提示している。

### C-2. WebUI プロキシが圧縮レスポンスを全て破壊（機械的再現済み）
`packages/server/src/http/routes/webuiProxy.ts:73-75` — undici が伸長した body を元の `content-encoding: gzip` / 圧縮時 `content-length` 付きで転送。実 Next.js（圧縮 ON）を前に置いた瞬間、閾値超の全レスポンスが壊れる。proxy テストは全て mock fetch で非圧縮のため構造的に検出不能。修正: レスポンスの `content-encoding` / `content-length` / `transfer-encoding` 除去（またはリクエストの `accept-encoding` 削除）。

### C-3. agent 実行の path-boundary ガードが dead code
P8-T02（PR #251）で導入された `path-boundary` action はどこからも参照されず、`coding-task.yml` は agent 実行後 `git add -A` → commit → push（manifest・pre/post ガード・snapshot なし）。ガード自体は良作（symlink 解決・HMAC snapshot・敵対テスト完備）だが呼ばれていない。加えて `.github/rulesets/main-protection.json` は未適用の JSON であり、branch protection / CODEOWNERS 必須レビューは現状手続きのみ。prompt-injection された agent が governance ファイルを書き換えて push できる。

## 2. High（本番到達時に確実または高確率で故障・流出）

- H-1. **`agent_handoffs` の UPDATE grant 欠落** — `provision_database_roles.sql` の mutable_table 一覧に `agent_handoffs` がなく、P8-T07（#269）の handoff CAS が本番提供 DB で permission denied。全 repo の UPDATE/DELETE 照合で唯一の欠落。
- H-2. **TH-002/TH-005 タイマーと DevOps レポート配信が全て未結線** — `evaluateTh002ApprovalTimer`（30 分エスカレ/60 分自動 expire）、`isWithinTh004Sla`、`evaluateTh005Escalation`、AGT-RPT 配信 3 関数の呼出ゼロ。`expired` 状態は実行時到達不能。scheduler は TH-001/TH-003/JIT のみ。
- H-3. **24h 間隔+当日ゲートの scheduler が restart で当該日を喪失** — 週次レポート配信 / SevenKeys 月次 snapshot は位相がプロセス相対のため、月曜 deploy で当週配信スキップ、uptime<24h なら永遠に実行されない。catch-up なし。
- H-4. **Excel 取込（GitHub 書込）がセッションのみでゲート** — `packages/web/src/server/xlsxImportHandler.ts:54`。ペルソナ/ロール検査なし・identity envelope 未送信・上流監査は `actor:"SERVER"` で実行者記録不能。ペルソナゼロのテナントメンバーでも実行可能、全ペルソナにリンク表示。
- H-5. **チャットの宣伝機能 2 つが動かない** — `show_project_board` は常に E-VIEW02 の赤エラー（`DashboardClient.tsx:275` が throw）。`periodDays` はデッドコード（空状態の例文「マネージャーサマリーを14日間で」が無効果）。いずれも pin/fetch 到達テストの欠落と正確に対応。
- H-6. **traceability green は完成証明ではない** — (i) `missingFromTest` は全カテゴリ非 fail・AC/SPEC-EXT は src 側も非 fail（DevOps AC のテスト参照 49% でも green、ツール自身の DOC-05 §11 主張と矛盾）。(ii) 実在 ID 1 個と併記すれば捏造 ID（REQ-999 等）が通過（隔離コピーで実証、exitCode 0）。(iii) FinalArch 162 ID はカバレッジ検査対象外で 117 ID がソース参照ゼロのまま不可視。
- H-7. **ドキュメント入口層が実装と乖離** — AGENTS.md / production-gates.md は廃止済み `AIOPS_PR_TOKEN` 方式を教える（実際は OIDC → credential-issuer で job 内発行・revoke）。README/AGENTS.md はパッケージ数が実態の約半分（実際 10 pkg + contracts workspace）、ADR 一覧は 0013 止まり（実 29 本）。VERIFICATION_REPORT.md（README が「必ず参照」と指定）は 2026-07-13 凍結で最低 6 箇所が現行と矛盾。`references/AI_OPS_PLATform.md` は 1 バイトの空ファイル。
- H-8. **`mise run ci`（Definition of Done）が実 PostgreSQL・opa・actionlint 必須である事実が README/AGENTS.md に無い** — 新規参入者は DoD green に到達できない。本レビュー環境でも docker/colima 不在+ネイティブ PG 起動不許可により `db:require` / `verify:db` は検証不能だった。

## 3. Medium（条件付き故障・流出・誤解）

**セキュリティ**
- M-1. secretSanitizer パターン網羅漏れ（実行検証済み）: `github_pat_` / Slack `xox*` / URL 埋込資格情報（接続文字列）/ Azure SAS `sig=` / `sk-` / `AIza` が SECRET_PATTERNS に無い。Teams 本文→DB 平文保存→LLM 入力→Issue 本文流出の経路。パターン追加のみで全ゲート（E-AUD02 含む）に波及する低コスト修正。
- M-2. 署名失敗監査が攻撃者制御文字列を無サニタイズ append → E-AUD02 が throw → **攻撃証跡レコード自体が書かれない**（監査回避への転化、検証済み）。`githubWebhook.ts:36-44` / `graphNotifications.ts:112-121`。
- M-3. AGT-INC Sev1 Teams カードのみ出力前 fail-closed 未適用（`AGT_INC.ts:117-127`）— 2 面のレビューが独立に同一指摘。1 語修正（`safeRationale`）。
- M-4. AGT_SEC の権限 drift 検出が level 昇格（pull→admin）と ledger-active grant の GitHub 側欠落を見ない。
- M-5. 無認証 body 読取 2 経路（githubWebhook / reportIngest）に bodyLimit なし（他経路は制限済み）。

**データ整合/監査**
- M-6. `PgAuditLog` が `reason` を黙って喪失（schema に列なし、Jsonl/InMemory は保持）— 理由必須操作の監査証跡が呼出側の detail 手動コピー頼み。
- M-7. `rejected` 状態が正本スキーマに存在せず承認差し戻しを prjops-data に記録できない（E-SNAPSHOT-SCHEMA、状態機械と正面矛盾）。
- M-8. `pmTimeseriesRepo` が eventsRepo で文書化済みの JSON 破壊バグを再導入（機械的再現済み）: payload キーに `api_key` 等を含む webhook で recordEvent throw → 5 回 retry → dead、PM 記録と AGT 動作の両方を喪失。併せて pm_events は retry 毎に重複 INSERT（時系列分析が歪む）。
- M-9. `self_status:"grey"` は検証通過するがレンダリングで TypeError → レポート生成死。severity 語彙（"critical"）も型と不一致。
- M-10. `claimNextApprovedChange` — repo 解決 0 件/複数件の approved change が消費され（dispatched_at 設定）、デプロイも再試行もされない。
- M-11. deployStateMachine が `dispatch_failed` を持たず（schema+Repo は実装）、状態機械の正が 2 系統。DB 由来 state で TypeError。
- M-12. PRF-G の決定権限が可視範囲より広い（`canDecideChangeByTrustedSubject` が scope_mode を無視）。GET /approvals も scope 外 change metadata を PRF-L に開示（canDecide:false マーク方式、原則 6 の文言に反する。テストは意図として固定済みのため設計裁定が必要）。

**ガバナンス層**
- M-13. self-gating CI — PR が自分の checkout の validator で governance:check を実行。validator 弱体化 PR は CI 素通り（GOVERNANCE_SCOPES の hard-deny は provenance.json / tools / 他 validator / package.json / deploy configs を含まず）。
- M-14. 独立レビュー collector がレビュー対象 branch（writer 作成）の manifest を信頼 — writer が同一コミット範囲で `paths.allowed` を拡張すれば「独立レビュー」ゼロ所見。manifestDigest 固定なし（path guard は保持しており非対称）。
- M-15. acceptance manifest 検証は存在+sha256 のみ（human 承認の内容⇔approver/task 紐付けなし、commands 自己申告）かつ CI 未結線。
- M-16. 週次配信の冪等判定が check-then-act（並行 2 サイクルで二重送信。AC-018-2 は単一 scheduler 前提のみ成立）。

**Web/使い勝手**
- M-17. チャット失敗が完全無音 — server が丁寧に返す 409/429/503/refusal を UI が一切表示しない（`useChat` の error/status 未使用）。503 状態でも入力を受け付けて毎回無音失敗。
- M-18. ApprovalsPanel が初回フェッチ前に「承認待ちの項目はありません。」を表示（false empty state）。ローディング状態なし・承認 1 クリック確認なし。
- M-19. ダークモード半壊（チャットバブルが読めない、contrast 2.7:1、ヘッダ bg-white 固定）。
- M-20. ProjectPicker は選択を強制するが何もフィルタしない（全ポートフォリオ同一数値を表示する誤解招致 UI）。`show_dora` は PRF-03(PrjOps) で DORA ゼロのビューに落ちる。
- M-21. loadView 競合（abort/シーケンストークンなし）。未報告プロジェクト 1 件で週次分析全体が停止（`listActiveProjects` throw）。
- M-22. docs 参照層の欠落: http-api.md に server 6 ルート+web 1 API 欠落、chat 503 条件が旧記載、manual-ops §2 が「届いたら」待つ SPEC-EXT-042 通知は未実装で永遠に届かない、plans/ と 2026-08 final-architecture pack が相互参照なしの 2 計画宇宙。

## 4. Low（抜粋 — 詳細は各面の所見全文を参照）

- Retry-After 無上限受理（実質永久停止）/ anthropicClient が非再試行エラーも再試行し予算再確保 / graphClient delta walk のトークン期限 / githubClient 一部レスポンス形状未検証。
- 進捗依頼メールの HTML 注入（latent、未結線）/ AGT05 が skipped でも "deliver" 監査記録 / JsonlAuditLog 並行 log_id 重複 / 暦上不正日付受理 / riskScore の先頭スラッシュ要求で repo 直下パスがスコア 0。
- JST 00:00–08:59 は前日ウィンドウ表示 / /api/chat body 未検証 / pr_url scheme 未検査 / null-project 行が全ペルソナ timeseries に混入 / DoraTrendChart の x 軸が projectId なのに「トレンド」表記 / a11y（チャット aria-live なし等）/ 生エラーコード表示。
- architecture-fitness regex は行末コメントでスキャンループ停止・EGRESS 検知は fetch(+SDK import 2 種のみ（heuristic としては許容、load-bearing ゲートは exact-shape で堅牢）。Plane mapping 本番署名はフォーマット検査のみ。dead code（assertOneWriter / alerts.yaml / freeTextValidation.ts / markConfirmedAndDispatched）。
- ADR-0016 に Superseded 標記なし（0029 が全決定置換と明記）/ ADR-0006 決定 5 の正本記載が現実と逆転 / ADR-0017 欠番理由記録なし / spec-id-catalog の test evidence 列陳腐化 / writerReviewerHandoffState.ts の workflows/ 配置は設計原則 1 と慣行の両方から逸脱。
- テスト規約: businessCalendar.test の題名と検証内容の不一致（祝日スキップ実質未テスト）、auditSchema.test の弱い substring assert。major 所見に対応するテスト欠落（reason round-trip / rejected round-trip / grey / periodDays 到達 / projectBoard pin / チャットエラー表示 / xlsx 権限）。

## 5. 問題なしと裏取りされた項目（敵対的検査が破れなかった箇所）

- webhook 信頼境界: GitHub HMAC timing-safe raw-body 先行検証+署名対象 body 由来 dedupe、Graph clientState `timingSafeEqual`+一様 202、bearer 比較は全て constant-time。
- 監査 append-only: 型（append のみ）→アプリ（E-AUD02/validateReasonRequirement）→DB（BEFORE trigger+REVOKE+partition）→起動時検証の 4 層。UPDATE/DELETE コードはゼロ。
- 権限フィルタ: data-fetch 側強制、fail-closed、recipients/persona は毎リクエスト DB 照会でキャッシュなし。
- ViewSpec 規律: LLM は数値/HTML/URL を注入できない（strict-zod、`dangerouslySetInnerHTML` ゼロ）。数値は全て決定的コード。
- 資格情報: 全クライアント TokenProvider 注入、coding-task.yml は OIDC 短命リース発行/失効・persist-credentials:false・hooksPath 封鎖・add-mask。バンドルに秘密なし。push は `agent/{task_id}` refspec 限定・自動マージ経路なし。
- deploy 層: OPA default-deny(29 テスト)、LiteLLM ASGI default-deny+`ANTHROPIC_API_KEY` 名指し禁止、agentgateway exact-shape allowlist、AWS IAM は Deny 文構成で allow-by-default 穴なし。sha256/image digest ピンは実検証。
- lib 純粋性・境界値テスト・DI 注入・migrations⇔fresh schema 整合・workbench handoff トークン（HMAC/TTL≤300s/single-use nonce）は模範的。configuration.md は CI 機械強制で doc-drift 不能。相対リンク 86 ファイル切れゼロ。

## 6. 多角評価

- **趣旨と意図した通りに動作するか**: 部品単位では概ね Yes。システムとしては No — 承認→デプロイ（C-1）、エスカレーション/配信（H-2/H-3）、agent 実行ガード（C-3）のループが未クローズ。
- **PrjOps+DevOps+AiOps は効率的に正しく動作するか**: 決定的ロジックと LLM 責務分離は仕様に忠実で数値の信頼性は高い。ただし運用即死経路（C-2 proxy、M-8 pm_events、H-3 scheduler 位相）が現行テストの構造的死角（mock fetch・短 interval・DB スキップ）に一致して存在する。
- **利用者の使い勝手**: 正常系・ライトモード・JST 日中の operator には誠実で使える。エラー経路に入った瞬間に無音（M-17）・虚偽の空状態（M-18）・読めないダークモード（M-19）・機能しない例文（H-5）で信頼を失う。operator-ready の最低条件は H-4 / H-5 / M-17 / M-18 の修正。
- **証跡と green の意味**: `ci green`・`traceability green` は「構成 drift がない」ことの証明としては強いが、「仕様が実装・テストされた」ことの証明としては H-6 のとおり読めない。受入判定に green を使う場合はこの限界を明示すべき。

## 7. 推奨対応順序

1. C-1（承認パス）: web BFF の body 整形+correlation 発行結線+create 時 expected_version/expires_at 設定（+decision ルート 503 の間は UI ボタン無効化）。
2. C-2（proxy ヘッダ除去、数行）と H-1（grant 1 行追加）: 小さく確実な本番故障の除去。
3. C-3: path-boundary action を coding-task.yml に結線、review collector に manifestDigest 固定、ruleset 適用（go-live gate）。
4. M-1/M-2/M-3: sanitizer パターン追加+監査 append 前サニタイズ+AGT_INC 1 語修正（全て低コスト・高波及）。
5. H-2/H-3: scheduler 結線と「当日ゲート」→「当該期間未実施ゲート」への置換。
6. H-6: missingFromTest(SPEC-INT/AC) の fail 昇格+bare 未知 ID fail 化+FinalArch カバレッジ報告追加。
7. H-7/H-8: 入口 4 文書（README/AGENTS.md/spec overview/VERIFICATION_REPORT）と AIOPS_PR_TOKEN 記載の更新。
8. M-17/M-18/M-19/H-5: WebUI エラー表示・空状態・ダークモード・死んだツールの修正または撤去。

## 8. 制約・未検証事項

- 実 PostgreSQL 必須の `db:require` / `verify:db` と PG 統合テスト（skip 38 件の一部）は本環境で未実行（docker/colima 不在、ネイティブ PG 起動は権限拒否）。
- references/docs の .zip/.pptx バイナリは内容未読（zip 正典は text mirror+hash 検証済みであることを確認。pptx は docs/ と references/ で md5 相違の 2 コピーがあり正本不明 — 所見に計上済み）。
- 本報告の所見は各レビュー面がコード読解（一部は機械的再現・隔離プローブ）で裏取りしたもの。修正は未着手（レビューのみの依頼のため）。
