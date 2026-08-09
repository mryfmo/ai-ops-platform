<!-- 根拠: ADV レビュー実務 / 委任裁定記録 / final-implementation-pack_2026-08-09 -->

# final-implementation-pack 敵対的レビュー報告書

- 対象: `references/ai-ops-platform-final-implementation-pack_2026-08-09.zip`（99ファイル、SHA256 全一致、
  同梱 validate_pack.py = PASS: 110 WBS tasks / 62 gates / 98 content files）
- 実施: claude-deep-dot（orchestrator）2026-08-10。**99ファイル全読**（サンプリングなし）+
  現 main（`ff66698`）との機械突合（scheduler 15本・approvals/deployments 実装・監視資産・
  CI artifact・ID 文法・ディレクトリ実在）に基づく。
- 総合判定: **条件付き適用可**。パックは自己検証・証跡規律・不変条件駆動の点で高品質であり、
  既存 ADR との矛盾は無い（supersession は明示的かつ妥当）。ただしパック自身の規定
  （BASELINE.md「基準差分の扱い」）に従い、**baseline-delta の Owner 承認と下記所見の是正なしに
  適用してはならない**。

## 1. Baseline delta 所見（基準 49e2e3c → 現 ff66698、6 PR 分）

### DELTA-01 [High] scheduler 目録の陳腐化

現 main は **15 の ScheduledTask** を登録済み（index.ts:539-782 実測）。基準以降に
report-delivery-metrics / approved-deploy / prod-monitor / prjops-weekly-analyze /
prjops-daily-tracker が追加された。P3（Temporal 移行）の shadow/cutover 対象一覧
（P3-T05..T09、TMP-005）はこの拡大後の全数を正本とする必要がある。特に
approvedDeployTask / prodMonitorTask は「承認待ち→dispatch→監視」そのものであり、
P3-T04（CodingTaskWorkflow）と同格の**デプロイ workflow 移行タスクが WBS に不足**している。

### DELTA-02 [High] approvals 実装の先行存在と契約競合

現 main には `approvals` テーブル（approval_type change|report|jit_grant、project_id、
target_sha、dispatched_at CAS、追記専用監査、PRF-L/PRF-G のリクエスト毎データ側認可）と
**BFF 署名 identity envelope**（`v1|method|path|sha256(body)|tid|oid|iat`、TTL90s、
`x-aiops-*` ヘッダ）が実装済み（#144/#149/#151）。パックの `approval_requests` 設計
（payload_hash / expected_version / expiry）および Control API の bearer-JWT 前提とは
**同一関心の二重設計**になる。是正方向: 単一テーブルの expand migration で既存 `approvals` を
パック意味論（expected_version・expiry・payload_hash）へ進化させ、認証は「Control API での
Entra JWT 検証が envelope を置換するのか併存するのか」を ADR 補遺で明示する。

### DELTA-03 [Medium] deployments 状態機械の先行存在

`deployments`（12状態、dispatch_failed 含む、202608090001 migration、
approvedDeployClaim CTE 書込み）が存在する。パックの action_ledger / P8 / P10 は
これを置換せず参照する authority mapping を定義すること。

### DELTA-04 [Medium] 監視資産の移行済み

prometheus-rules.yml は**既に削除済み**、`ops/azure-monitor-alerts/`（6ルール KQL、
D-04 依存明記）と `httpMetrics.ts`、7d/3d rolling gauges が存在する。P9-T08 と
deploy/otel 計画はこれを起点に拡張し、再作成しないこと。

### DELTA-05 [Medium] AGT-02/04 の一本化済み

`AGT04_reportGenerator.ts` / `AGT02_collector.ts` は**削除済み**（#147）。純粋契約は
`packages/shared/src/reporting/`（14ファイル。metricDisplayNames / profileNarrativeContract /
statusIngestContract / narrativeNumberGuard 等を含む）に移植済み。P2-T06 の
allowed_paths（prjops/src/agents/**）の LLM consumer 一覧は現実в合わせて更新が必要
（現消費者: AGT03 エスカレーション文、AGT_BLD 分類/提案、AGT_INC 分類、
teamsConversationAgent、CI report generation）。

### DELTA-06 [High] ci.yml の TH-001 証跡契約

ci.yml は既に `agt-dep-th001-evidence` artifact（`.ci/agt-dep-evidence.json`）を発行する
（A052）。P0-T04（fitness checks）と P8 系の ci.yml/coding-task.yml 変更は**この契約を
壊さない**ことを受入条件に含めること。coding-task.yml は現在 ANTHROPIC_API_KEY を
直接使用しており、P2-T08 の移行対象として正しいが、A052 の evidence 経路と同居する。

### DELTA-07 [High] キャンペーン後続タスクの脱落

パック WBS 110 タスクに **A053（incident datastore + 類似検索 = DevOps:SPEC-INT-030 完全適合。
P9-T04 と重複領域）** と **A054（PrjOps ingest パイプライン = PrjOps:REQ-004/005 の
オーケストレーション実装）** が存在しない。A054 は不変条件「既存要件を維持」に対する
**実装の穴**である（#147 で休眠実装を削除し、契約層+後続タスクで維持する構造にした経緯が
`00-owner-decisions.md` D-15 節に記録済み）。WBS への追補（または Owner 明示 defer）が必須。
同様に、未決の **D-14（内部用語リスト内容）/ D-15（プロファイル別報告の範囲）/
D-16（code scanning 有効化）** がパックの ENV-DEC 台帳に不在——2つの意思決定台帳が
分裂しないよう統合すること。

## 2. パック内部の欠陥

### PACK-01 [High] WorkflowSignal.actorId がクライアント供給

`control-api.openapi.yaml` の `WorkflowSignal` は `actorId` を request body で受ける。
承認・拒否の主体は**認証済み principal から導出**しなければならず（#144/#151 で確立した
原則そのもの）、body の自称 actor は監査・read model を汚染する。契約から actorId を排し、
サーバ側で注入する形へ修正すること。

### PACK-02 [Medium] WBS の pack 相対パス

P8-T04 / P8-T06 の allowed_paths に `07_agent_execution/**` というパック相対パスが混入。
リポジトリ取込後の実パス（`docs/plans/2026-08-final-architecture/07_agent_execution/**`）へ
正規化すること。

### PACK-03 [Medium] 実在しない検証コマンド

P0-T05 の `mise run verify:load` は .mise.toml に存在しない（実在: ci / traceability /
governance / verify:db 等）。負荷ベースラインは既存 loadBaseline スイートの実コマンドを
指すか、新タスク定義を P0-T04 の成果物に含めること。

### PACK-04 [High] 新 ID 体系と traceability 文法の非互換

パックの PRD-/FR-/NFR-/INV- 等は、現行の根拠ヘッダ文法
`(?:REQ|SPEC-EXT|SPEC-INT|TH)-\d{3}|AC-...|ADR-\d{4}`（#131 で強化）に**載らない**。
P0-T03 は「新 spec ID 登録」だけでなく、**文法・カタログ・namespace の拡張設計**
（どの ID 種を根拠ヘッダとして許すか、既存 6 種との関係）を成果物に含めること。
これを怠るとパック由来ファイルの根拠ヘッダが全部 CI で落ちるか、逆に文法を無秩序に
緩めることになる。

### PACK-05 [Medium] 既存 live 経路の凍結が暗黙

feature flag `coding.claude.enabled: false`（requires branch-protection）は、**現在稼働中の
coding-task 経路を P0-T02 完了まで停止させる**ことを意味する。意図的なら STOP として明記、
そうでなければ「既存経路は cutover まで現状維持（grandfather）」の移行規則を明文化すること。

### PACK-06 [Medium] branch protection の前提条件が未記載

P0-T02 は設定タスクとして書かれているが、記録済みの実測では**現 GitHub プランで
protection API が 403**（旧監査 T-P0-08 / D-06）であり、merge 用トークンの workflow scope
不足も既知（#133）。**プラン変更（費用・契約 = Owner 事項）が前提条件**である。
ENV-DEC 台帳へ「GitHub プラン」を追加し、P0-T02 の Entry criteria に明記すること。

### PACK-07 [Low] /health/live・/health/ready の既存規約との整合

現 server は /healthz・/readyz（degraded 配列付き）。Control API 契約の /health/* と
命名・意味論を一本化する注記が必要。

### PACK-08 [Low] approval_requests に認可スコープ列が無い

#151 で確立した project スコープ認可（PRF-L は担当プロジェクトのみ）を載せる列
（project_id 等）が approval_requests 設計に無い。DELTA-02 の単一テーブル進化で解消される。

## 3. プロセス/レジーム整合

### PROC-01 [Owner 裁定必須] Writer 配分と現行レジームの衝突

パックは 110 タスク中 **56 を claude-code-fable5-xhigh の Writer** に割り当てる。
現行の運用規約は「orchestrator（Claude）はリポジトリを変更せず、Codex worker へ委譲」
（operator の明示 opt-out がある場合を除く）。パックの routing はまさにその opt-out を
意図した operator 成果物と解し得るが、**明示の裁定が必要**:

- 案A: パックどおり。Claude-writer タスクは Claude 自身が専用 worktree + PR で実装し、
  Codex が独立レビュー（パックの one-writer/two-model 設計を尊重）
- 案B: 全タスク Codex writer へ再ルーティング（現行レジーム維持。ただしパックが意図した
  二模型分業を失う）

推奨は案A（パックの設計意図とレビュー独立性を保持）。裁定は owner-decisions へ記録する。

### PROC-02 [Medium] 証跡の二重管理防止

パックの COMPLETION_EVIDENCE_TEMPLATE と現行 .orchestration 証跡（AGMSG 契約）の
対応表を定義し、片方から他方を生成する（二重手書きを禁止）。

## 4. 良い点（変更不要と判定した主要素）

- 不変条件20項・decision budget・drift check・RED 手順は現行キャンペーンの学習と完全整合
- 「実行していない検証を成功と書かない」規律が全層に貫通（VALIDATION_REPORT の
  Deliberately not claimed 節は模範的）
- 段階移行（shadow→limited→primary→removal、no hidden dual-write、削除は専用 Phase）は
  #105 で学んだ混載事故の構造的予防そのもの
- ADR 0020-0028 の番号は既存（最高 0019）と衝突せず、supersession 対象の選定も正確
- 62 受入ゲートは全て blocking + evidence 定義済み。ENV-blocked ≠ pass の規律も明記

## 5. 是正の実行順序（Task #8 への入力）

1. **baseline-delta.md の確定と Owner 承認**（`02-baseline-delta.md`。PROC-01 裁定を含む）
2. 承認後、**取込 PR 波**（パック APPLY 手順どおり docs/plans/2026-08-final-architecture/ へ、
   ただし PACK-01..08 / DELTA-01..08 の是正を適用した修正版として取り込む。
   原本 zip は references/ に不変で保持し、修正は取込側で行い差分を明記）
3. P0 開始（P0-T02 は GitHub プラン裁定後）
