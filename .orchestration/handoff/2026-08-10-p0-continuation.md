# セッション継続ハンドオフ — 最終アーキテクチャ実装 P0 フェーズ（2026-08-10）

新セッションはこの文書を読めば現在地から継続できる。正本 WBS は
`docs/plans/2026-08-final-architecture/06_implementation/02_wbs.yaml`（113 tasks / 64 gates）。

## 1. キャンペーン文脈

- references/ の最終アーキテクチャ ZIP（99 files、不変保持）を敵対的レビュー後に修正取込済み
  （PR #152）。P0（baseline フェーズ）を Owner 承認のもと実行中。
- 体制 = agmsg レジーム + **承認済み 案A**: Claude-writer タスクは Claude（orchestrator）自身が
  専用 worktree + PR で実装し、Codex が独立レビュー。Codex-writer タスクは従来どおり
  worker が実装し Claude が受入。merge は必ず「merge ゲートタスク」
  （全スレッド解決 + exact-head checks green + squash merge + main CI 確認）。
- 標準規律: 証跡なき完了主張の禁止 / ENV-blocked ≠ pass / fresh disposable DB での
  `mise run ci` exit 0 を単独確認してから push（exit code を潰す連結禁止）/
  遡及証跡の禁止 / E2E・最終テストは ENV 制約で保留中。

## 2. agmsg レジーム構成

- team `ai-ops-platform` / orchestrator `claude-deep-dot`（私）/ worker `codex-deep-dot`
  （herdr pane **w1D:p5**、`codex --profile deep`）。store は既定
  `~/.agents/skills/agmsg/db/messages.db`。
- SessionStart hook が Monitor（watch.sh inbox stream）起動を指示する — 必ず従うこと。
- wake は `herdr pane run w1D:p5 "<text>"`（send-text+Enter は不可）。
- 契約: AGMSG-TASK/RESULT/ACCEPTANCE/PING/PONG v1（単一行）。タスク本文は
  `.orchestration/tasks/*.md`、レビューは `.orchestration/reviews/*-REVIEW.md`
  （findings YAML + independent evidence の書式。既存ファイル参照）。

## 3. P0 盤面（2026-08-10 時点）

| タスク | 状態 |
| --- | --- |
| P0-T01 baseline 再検証 | merged #153 |
| P0-T03 FinalArch traceability（5 族 162 ID: PRD/FR/NFR/INV/GATE） | merged #154 |
| P0-T04 fitness checks（`mise run governance` 拡張、INV 20 行マトリクス） | merged #158 |
| P0-T05 性能 baseline | merged #155 |
| P0-T06 ライセンス台帳（Work IQ 除外境界修正済み） | merged #157 |
| P0-T08 移行 flag / kill-switch 契約（正本 YAML 完全鏡 + fail-closed） | merged #156 |
| P0-T09 secret/identity 移行計画（credential マトリクス + break-glass） | merged #159 |
| **P0-T07 Temporal プロファイル（ENV-DEC-001）** | **PR #160 head `73eda7f`、Codex 再レビュー + merge ゲート実行中**（worker キューに投入済み） |
| **P0-T02 branch protection** | **Owner の GitHub Pro 課金操作待ち**。準備済み draft PR #161（ruleset JSON + 負証明 5 件のプロトコル） |
| P0-T07a 正典追補 chore | 未起票（#160 merge 後に起票。定義は ENV-DEC-001 記録内に確定済み） |
| P0-T10 Owner baseline ゲート | 上記全完了後 |

## 4. Owner 裁定（2026-08-10、すべてセッション記録あり）

1. **ENV-DEC-001 = 案 B' 承認**: Temporal はセルフホスト OSS 最小形。有償 SaaS 契約なし・
   Kubernetes なし。
2. **本番基盤 = AWS**（「AzureではなくAWSとする」）→ **ADR-0029**（Accepted、ADR-0016 を
   その再裁定条項に基づき置換）: ECS Fargate / RDS PostgreSQL / Secrets Manager + IAM /
   CloudFront + WAF / CloudWatch / Terraform / 東京 primary・大阪 DR。RPO/RTO/99.9% 目標不変。
   M365（Teams/Outlook/Graph/Work IQ）は SaaS API 継続、Entra 資格は M365 専用。
   Bedrock と同一クラウド化で Azure→AWS STS フェデレーション不要に。
   Temporal 本番 = Fargate 単一サービス + RDS 専用 DB（mTLS + worker 別証明書 +
   namespace/task-queue 非 admin claims）。compose は dev 専用。
3. **役割兼任**: `docs/decisions/owner-role-consolidation.md` — Owner が
   Security/Ops/Procurement を公式兼任。以降の全 ENV-DEC は Owner 承認 1 件で充足。
4. **ENV-DEC-011 = GitHub Pro 化（有償）を選択**。課金操作は Owner のみ可能
   （Settings → Billing and plans → GitHub Pro）。**完了連絡待ちが現在の唯一の Owner 待ち**。

## 5. 次のアクション（順序どおり）

1. **P0-T07 merge RESULT の受入**: worker から AGMSG-RESULT（P0-T07-REVIEW 再レビュー →
   approve なら同ターン merge）が届く。head `73eda7f` の是正 6 件
   （.orchestration/reviews/P0-T07-REVIEW.md 参照）を再検証のうえ受入。
   request_changes の場合は所見の妥当性を裁定して対応。
2. **#160 merge 後**: P0-T07a を起票し worker へ dispatch。
   Writer = codex / Reviewer = Claude / allowed_paths = WBS の P3-T01 行 +
   `docs/security/2026-08-10-secret-identity-migration-plan.md` + pack 読み替え規則。
   受入条件は ENV-DEC-001 記録の「実装帰結と正典追補」節に確定済み
   （Fargate Terraform 化、P0-T09 の Azure 行 → AWS 等価、矛盾ゼロ）。
3. **Owner「Pro 化完了」連絡後の P0-T02 実行**（Writer = Claude、branch
   `agent/P0-T02-branch-protection`、PR #161）:
   `gh api repos/mryfmo/ai-ops-platform/rulesets --input .github/rulesets/main-protection.json`
   → 負証明 5 件（main 直接 push / 承認なし merge / force push / red check merge /
   CODEOWNERS なし merge が**すべて拒否されること**）を実施し
   `runbooks/production-gates.md` の Evidence 節へ記録 → PR ready 化 → Codex レビュー →
   merge ゲート。
4. **P0-T10**: P0 全タスク merge 後、baseline ゲート文書（Owner 署名 = 承認 1 件で可、
   役割兼任記録を引用）を起票 → レビュー → merge。GOV-003 の法務チェックリスト
   （docs/security/2026-08-10-license-service-review-register.md の STOP 条件）の
   未消化項目は P0-T10 で「条件付き完了」として明示すること。
5. その後 P1（P1-T01 scaffold から。writer 割当は WBS 参照。ADR-0029 により
   Azure 前提記述は AWS へ読み替え）。

## 6. 環境・手順の要点

- **使い捨て PostgreSQL**: 旧セッションの scratchpad に cluster（port 55432）を initdb して
  いた。新セッションでは再作成する:
  `initdb <scratchpad>/p0pg && pg_ctl -D <scratchpad>/p0pg -o "-p 55432 -k /tmp" start`、
  role postgres + mryfmo（superuser）を作成。**各 `mise run ci` の前に必ず
  dropdb/createdb aiops_p001**（状態汚染で audit partition テストが落ちる）。
  env: `TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/aiops_p001
  P001_ALLOW_DISPOSABLE_DB=1 AIOPS_TEST_DATABASE_NAME=aiops_p001
  AIOPS_TEST_DATABASE_HOST=127.0.0.1 AIOPS_TEST_DATABASE_PORT=55432
  AIOPS_LOAD_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/aiops_p001
  AIOPS_LOAD_TEST_CONFIRM_DATABASE=aiops_p001`
- **push 規律**: `mise run ci` を実行し `$?` を単独判定、exit 0 のときだけ commit/push。
- **worktree**: 旧セッションの scratchpad worktree（p0t07/p0t02 等）は消えている可能性が
  ある。`git worktree prune` 後、必要なら origin ブランチから作り直す
  （`agent/P0-T07-temporal-profile` = #160、`agent/P0-T02-branch-protection` = #161）。
- **GitHub 認証**: gh keyring（mryfmo）。AIOPS_PR_TOKEN は未設定のままが裁定。
  workflow scope がないため #133（dependabot）は Owner の
  `gh auth refresh -h github.com -s workflow` か Web UI merge 待ち。
- **branch 保護 API**: Pro 化前は 403（実測）。Pro 化後に上記手順で適用。
- Vitest 4 では `pnpm --filter X test -- <file>` のフィルタが効かない。
  `pnpm --filter X exec vitest run tests/<file>` を使う（P0-T04 で修正済み）。

## 7. 参照ファイル

- 決定記録: `docs/decisions/ENV-DEC-001-temporal-production-profile.md`（#160）/
  `docs/decisions/owner-role-consolidation.md` / `docs/adr/0029-aws-managed-platform-baseline.md`
- レビュー証跡: `.orchestration/reviews/`（PACK-IMPORT / P0-T03 / P0-T07 / P0-T08 の書式見本）
- タスク書式見本: `.orchestration/tasks/P0-T04-fitness-checks.md`
- 承認済み delta: `.orchestration/plan/2026-08-10-pack-adversarial-review/02-baseline-delta.md`
  （案A の根拠。repo にも git add -f 済み）
