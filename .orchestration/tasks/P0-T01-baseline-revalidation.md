# P0-T01: Revalidate repository baseline（WBS 正本タスク）

- task_id: P0-T01
- WBS 正本: docs/plans/2026-08-final-architecture/06_implementation/02_wbs.yaml（P0-T01）
- repo: /Users/mryfmo/Workspace/ai-ops-platform（main worktree。ブランチ `agent/P0-T01-baseline-revalidation`）
- 発行: claude-deep-dot（orchestrator）2026-08-10。オーナーの実装フェーズ開始承認に基づく
- Writer: codex-gpt56-sol-high（= codex-deep-dot, herdr pane w1D:p5）
- Reviewer: claude-code-fable5-xhigh（orchestrator が受入時に実施）
- risk: medium / max_turns: 25
- acceptance gates: GOV-001
- requirement_refs: PRD-010 / adr_refs: ADR-0020..0028（Proposed）

## Intent

パック基準（49e2e3c）から現 HEAD までの乖離を最終確定し、現行 CI が実 PostgreSQL 込みで
green であることを再実証する。P0 の全タスクはこの baseline 証跡の上に立つ。

## 実装要件

1. 現 HEAD/tree を記録（`git rev-parse HEAD` / `git rev-parse HEAD^{tree}`、clean であること）
2. `mise run ci` を実 PostgreSQL 込みで完走し、結果（テスト数・所要）を記録
3. 乖離分類: 承認済み `.orchestration/plan/2026-08-10-pack-adversarial-review/02-baseline-delta.md`
   （49e2e3c→ff66698）を参照し、**それ以降の差分（#152 取込コミット）を追補分類**する。
   アーキテクチャ不変条件との衝突が無いことを確認（#152 は文書のみのはず——検証すること）
4. 成果物 `docs/plans/2026-08-final-architecture/baseline-delta.md` を作成:
   承認済み delta への参照 + #152 追補 + HEAD/tree/CI 証跡。依存関係の snapshot
   （pnpm-lock 状態、mise ツール版）も記録
5. `docs/plans/2026-08-final-architecture/BASELINE.md` に P0-T01 再検証の追記
   （日時・HEAD・CI run URL）

## allowed_paths（WBS 準拠・repo 相対に解決）

```
docs/plans/2026-08-final-architecture/BASELINE.md
docs/plans/2026-08-final-architecture/baseline-delta.md
docs/audit/**
```

（SHA256SUMS の再生成が必要なら docs/plans/2026-08-final-architecture/SHA256SUMS も許可）

## forbidden

- main direct push / 本番設定 / 実装コード変更 / 依存変更 / merge / force push

## 品質要件

- PR（ai-generated、pack の PR 必須項目に準拠: task ID・変更理由・実行コマンドと結果・
  未実行検証と理由）→ checks green → `git checkout main`
- 証跡5ファイル（.orchestration 規約）を PR に同梱
- merge はしない（orchestrator 受入後に merge タスク）

## 完了報告

```
AGMSG-RESULT v1 task_id=P0-T01 status=ready_for_review|blocked report=.orchestration/reports/P0-T01-report.md validation=.orchestration/validation/P0-T01-validation.md sandbox=.orchestration/sandboxes/P0-T01-sandbox.md learning=.orchestration/learning/P0-T01-learning.md autoskill=.orchestration/autoskill/runs/P0-T01-autoskill.md
```
