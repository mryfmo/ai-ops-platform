# A043: AGT-07 配信前検証を送信直前の必須ゲートとして結線する

- task_id: A043
- repo: /Users/mryfmo/Workspace/ai-ops-platform（main worktree。開始時に `git checkout main && git pull --ff-only origin main`、ブランチ `agent/a043-agt07-delivery-gate`）
- 発行: claude-deep-dot（orchestrator）2026-08-08
- 担当: codex-deep-dot（herdr pane w1D:p4, `codex --profile deep` = gpt-5.6-sol high）
- レビュー・受入: claude-deep-dot
- max_turns: 35
- 根拠: **ADV-WIR 系（本レビュー最重要欠落）** / PrjOps:REQ-019 / PrjOps:SPEC-INT-051 / AC-019-1 /
  委任裁定 R-02-4（`00-owner-decisions.md` 委任裁定記録）

## 現状（орchestrator 事前調査済み）

`verifyReportBeforeDelivery()`（`packages/prjops/src/agents/AGT07_verifier.ts`、V-A 数値一致 /
V-B 禁止語 / V-C プレースホルダ・サイズ / V-D 宛先一致、E-VER0A〜0D）は**仕様・実装・単体テストが
揃っているのにランタイムから呼び出しゼロ**。`reportDeliveryTask.ts` は
`deliverStandardReportToRecipients()`（:184）→ `sendMail`（:274）/`sendAdaptiveCard`（:281）へ
検証なしで進む。`buildForbiddenTermsForProfile()` は `prjops/src/lib/reportPermissionFilter.ts:101`
に実在。数値は `payload.metrics`（value/source/as_of、コード算出）に保持されている。

## 実装要件

1. **挿入位置は per-recipient の送信直前**（委任裁定 R-02-4「bypass 不能な唯一の位置」）。
   V-B は profile 依存・V-D は実配信先依存のため、レポート単位でなく受信者単位で検証する。
2. 検証入力の組み立て:
   - V-A: `payload.metrics` を正とし、レンダ済み HTML の `data-src` span と突合
   - V-B: `buildForbiddenTermsForProfile(profile, personalNames, internalTerms)`。
     personalNames / internalTerms の**正本データ源は SPEC-INT-051 に従って特定**する。
     仕様から一意に決まらなければ**推測せず blocked**
   - V-D: 受信者の実配信先 email
3. **NG 時は配信スキップ + 監査ログ（E-VER コード付き）+ ops への通知**（AC-019-1）。
   ops 通知は既存機構（ops/heartbeat/default channel 等）があればそれを使い、無ければ
   warn ログ + 失敗カウンタ metric（例 `aiops_report_verification_failures_total{code}`）とし、
   通知機構の不在を report に明記する。**NG の握り潰し（ログのみで配信続行）は禁止**。
4. 1受信者の NG が他受信者の配信を止めない（per-recipient 隔離。既存の unresolved_profile
   スキップと同じ粒度）。
5. glue の判定ロジックは純粋関数として lib に置く（CLAUDE.md 原則1）。

## 判断が必要になったら（blocked）

- personalNames / internalTerms の正本が仕様から特定できない場合
- V-A の突合が現行 HTML 構造で成立しない（data-src が欠けている等）構造問題を見つけた場合

## 品質要件

- describe/it に仕様ID（PrjOps:REQ-019 / SPEC-INT-051 / AC-019-1。衝突IDは namespace）
- テスト: NG（各 V-A〜V-D）で送信されず監査が残ること、OK で従来どおり配信、
  1受信者 NG の隔離、の全経路
- `mise run ci` green（実 PostgreSQL）
- traceability matrix 再生成
- ブランチ → push → PR（base=main、`ai-generated`）→ checks green → `git checkout main`
- merge はしない

## forbidden_actions

- allowed_files 以外の編集、AGT07_verifier.ts 本体の仕様変更（結線が目的。verifier の
  シグネチャ適合のための最小変更が必要なら blocked で相談）、依存追加、merge、force push

## allowed_files

```
packages/server/src/scheduler/tasks/reportDeliveryTask.ts
packages/server/src/lib/reportVerificationGate.ts
packages/server/src/observability/metrics.ts
packages/server/tests/reportDeliveryTask.test.ts
packages/server/tests/reportVerificationGate.test.ts
packages/traceability/output/traceability_matrix.md
```

## 完了報告

```
AGMSG-RESULT v1 task_id=A043 status=ready_for_review|blocked report=.orchestration/reports/A043-report.md validation=.orchestration/validation/A043-validation.md sandbox=.orchestration/sandboxes/A043-sandbox.md learning=.orchestration/learning/A043-learning.md autoskill=.orchestration/autoskill/runs/A043-autoskill.md
```
