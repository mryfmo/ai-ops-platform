# A050: metrics の権限スコープと AGT-07 ゲート強化【go-live 前必須】

- task_id: A050
- repo: /Users/mryfmo/Workspace/ai-ops-platform（main worktree、`agent/a050-metric-scope-gate`）
- 発行: claude-deep-dot（orchestrator）2026-08-08
- 担当: codex-deep-dot（`codex --profile deep`）
- レビュー・受入: claude-deep-dot
- max_turns: 35
- 位置づけ: **A044（approvals 基盤）の後に着手。ただし D-04 で本番配信が可能になる前に必ず完了**
  （PR #143 が metrics を配信物へ載せたことで生じた露出は、本番配信が無い現在は理論上のみ）
- 根拠: PR #143 の Codex bot P1×3 / P2×1 に対する orchestrator 裁定（スレッドに記録済み）

## Scope（4点、すべて #143 のスレッド裁定から）

1. **per-metric scope**: StandardReportPayload.metrics に scope metadata（対象 project / portfolio 区分）
   を生成側（正本）で付与し、render 時に受信者の profile/projects でデータ側フィルタ（原則6）。
   schema 変更は生成側（shared/reporting + 生成 CI）と配信側の両方を同一 PR で整合させる。
2. **metric key の表示名マッピング**: 内部 key をそのまま外部レンダしない。表示名辞書を versioned
   データとして持ち、**未定義 key は PRF-05/investor には非表示（fail-closed）**。
3. **V-D 強化**: stakeholder id が引ける受信者は stakeholder master の email と実配信先を突合。
   不一致は E-VER0D。
4. **config 結合**: report delivery 有効時は `STAKEHOLDERS_DIR` を必須化（superRefine、E-CFG01）。
   runbook の環境構築記述も同期。

## 品質要件

- 仕様IDヘッダ / describe タイトル / `mise run ci` green（実PG）/ matrix 再生成 / PR（ai-generated）
- merge はしない

## forbidden_actions

- allowed_files 外編集、依存追加、merge、force push

## allowed_files

```
packages/shared/src/reporting/reportSchema.ts
packages/shared/src/reporting/internalTerms.ts
packages/shared/src/reporting/metricDisplayNames.ts
packages/shared/tests/reportSchema.test.ts
packages/shared/tests/metricDisplayNames.test.ts
packages/server/src/lib/reportVerificationGate.ts
packages/server/src/scheduler/tasks/reportDeliveryTask.ts
packages/server/src/config.ts
packages/server/src/index.ts
packages/server/tests/reportVerificationGate.test.ts
packages/server/tests/reportDeliveryTask.test.ts
packages/server/tests/config.test.ts
runbooks/e2e-real-environment.md
packages/traceability/output/traceability_matrix.md
```

## 完了報告

```
AGMSG-RESULT v1 task_id=A050 status=ready_for_review|blocked report=.orchestration/reports/A050-report.md validation=.orchestration/validation/A050-validation.md sandbox=.orchestration/sandboxes/A050-sandbox.md learning=.orchestration/learning/A050-learning.md autoskill=.orchestration/autoskill/runs/A050-autoskill.md
```
