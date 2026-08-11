# A047: AGT-04 / AGT-02 の実装一本化（spec 処分マトリクス方式）

- task_id: A047
- repo: /Users/mryfmo/Workspace/ai-ops-platform（main worktree。ブランチ `agent/a047-single-implementation`）
- 発行: claude-deep-dot（orchestrator）2026-08-09
- 担当: codex-deep-dot（herdr pane w1D:p4, `codex --profile deep` = gpt-5.6-sol high）
- レビュー・受入: claude-deep-dot
- max_turns: 40
- 根拠: ADV-WIR-012 / 委任裁定 R-02-3 / ADR-0010・0011・0012（報告標準化系）

## 前提（orchestrator 事前調査済み）

- `AGT04_reportGenerator.ts`・`AGT02_collector.ts` は**ランタイム呼び出しゼロ**。
- ただし単純削除は不可: パッケージ側だけが持つ仕様義務がある。
  - AGT-04: プロファイル別スロット強制（5プロファイル×2-10）/ Unicode 全変種の
    narrative 数値検出（REQ-010〜016 / SPEC-INT-031 / DEC-SPEC-007）
  - AGT-02: マルチチャネル ingest・6項目完全性チェック + clarification loop（最大3回）・
    escalate_incomplete（PrjOps:REQ-004/005 / PrjOps:SPEC-INT-030）
- 生きている実装: CI 側 report-generation.yml + `shared/reporting`（REQ-040 / SPEC-INT-067 /
  SPEC-INT-082、3スロット標準スキーマ）、server 側 ingest 経路（channel polling / reportIngest）
  と `freeTextIntent.ts`（SPEC-INT-033、intent 限定）。
- **cron は既に仕様一致**（UTC 日曜22:00 = JST 月曜07:00）。変更しないこと。

## Phase 1: spec 処分マトリクス（成果物として必須）

パッケージ実装が根拠に持つ**全 spec ID** について、次のいずれかへ分類した表を
`.orchestration/reports/A047-disposition.md` に作る:

- **satisfied**: 生きている実装が既に満たす（file:line 証拠）
- **superseded**: ADR-0010/0011/0012 の標準化により仕様側が置換済み（ADR 引用）
- **lost**: どのランタイム経路も満たしていない → Phase 2 の移植対象
- **ambiguous**: 判定不能 → **blocked で orchestrator 裁定を求める**
  （特に REQ-010〜016 の per-profile レポートが ADR-0012 標準化でどこまで置換されたかは
  自明でない。推測しない）

## Phase 2: lost 分類の移植

- lost と判定された挙動を**生きている実装側**へ移植する（例: Unicode 数値検出を
  shared/reporting のスロット検証へ、完全性チェックを ingest 経路へ）。
  移植先のテストも同時に移す/書き直す
- 移植不能・大工事になるものは blocked で報告（別タスク化を orchestrator が判断）

## Phase 3: 削除と付け替え

- `AGT04_reportGenerator.ts` / `AGT02_collector.ts` と専用テストを削除
- 残存参照（docs/ADR の言及は履歴として維持可、コード参照はゼロに）
- traceability: 削除で浮く spec ID が matrix 上で**実装喪失として赤にならない**こと
  （satisfied/superseded の付け替え、lost は移植先が引き受ける）を確認して再生成

## 品質要件

- `mise run ci` green（実PG）/ matrix 再生成 / PR（ai-generated）→ checks green → main へ戻す
- merge はしない

## forbidden_actions

- allowed_files 外編集、cron 変更、仕様文書本文の書き換え（ADR amendment 形式の追記が
  必要と判断した場合は blocked で相談）、依存追加、merge、force push

## allowed_files（Phase 1 の結果により拡張要求可）

```
packages/prjops/src/agents/AGT04_reportGenerator.ts
packages/prjops/src/agents/AGT02_collector.ts
packages/prjops/tests/agt04ReportGenerator.test.ts
packages/prjops/tests/agt02Collector.test.ts
packages/prjops/src/index.ts
packages/shared/src/reporting/**
packages/shared/tests/**
packages/server/src/lib/freeTextIntent.ts
packages/server/tests/freeTextIntent.test.ts
packages/traceability/output/traceability_matrix.md
```

## 完了報告

```
AGMSG-RESULT v1 task_id=A047 status=ready_for_review|blocked report=.orchestration/reports/A047-report.md validation=.orchestration/validation/A047-validation.md sandbox=.orchestration/sandboxes/A047-sandbox.md learning=.orchestration/learning/A047-learning.md autoskill=.orchestration/autoskill/runs/A047-autoskill.md
```
