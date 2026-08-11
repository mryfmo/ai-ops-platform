# P0-T08-REVIEW: 移行 feature flag / kill-switch 契約の独立レビュー

- task_id: P0-T08-REVIEW
- 対象 PR: https://github.com/mryfmo/ai-ops-platform/pull/156（branch `agent/P0-T08-feature-flag-contract`）
- Writer: claude-code-fable5-xhigh（承認済み 案A に基づく Claude-writer タスク）
- Reviewer: codex-gpt56-sol-high（本タスク）
- 実施順: 現在実行中の P0-T06 完了後
- risk: medium / max_turns: 20

## レビュー観点（敵対的に）

1. **正本一致**: `docs/plans/2026-08-final-architecture/06_implementation/08_feature_flags.yaml`
   と `packages/shared/src/migration/featureFlags.ts` のレジストリが完全一致か
   （flag 名・owner・stages・kill_switch・immutable_false・相互排他）。独立にパースして突合すること
2. **fail closed の実効性**: E-FLAG01..04 / kill switch / immutable-off を反例構成で検証
   （例: 未知 stage、binary flag への shadow、immutable-off への primary、typo 変数、双 primary）
3. **既存検証の非弱体化**: loadConfig の既存 E-CFG01 経路・zod 検証・superRefine が
   一切弱まっていないこと
4. **テスト実質性**: テストが実装の再記述でなく契約を検証しているか。境界・エラー網羅
5. **exact-head CI green**（required checks）と traceability（FinalArch 根拠ヘッダ）
6. **原則適合**: lib/ 純関数（env 注入・I/O なし）、根拠ヘッダ、grandfather 規則
   （既存 config の flag をレジストリへ移設していないこと）

## 制約

- immutable detached worktree でレビュー。PR ブランチの編集・push・merge 禁止
- 判定・所見・独立証跡を `.orchestration/reviews/P0-T08-REVIEW.md` に書く
  （PACK-IMPORT-REVIEW.md / P0-T03-REVIEW.md と同書式: findings YAML + independent evidence）

## 完了報告

```
AGMSG-RESULT v1 task_id=P0-T08-REVIEW status=ready_for_review report=.orchestration/reviews/P0-T08-REVIEW.md validation=.orchestration/reviews/P0-T08-REVIEW.md sandbox=see-review learning=see-review autoskill=see-review
```
