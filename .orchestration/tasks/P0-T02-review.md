# P0-T02-REVIEW — PR #165 独立レビュー

- task_id: `P0-T02-REVIEW`
- Reviewer: codex-gpt56-sol-high(worker)/ Writer: claude-code-fable5-xhigh(P0-T02、案A Claude-writer)
- 対象: PR #165 head `9194d30`(base = main e0dde07。#161 の後継、App author)
- 根拠: FinalArch:GOV-002 / FinalArch:INV-012 / ADR-0006 / ADR-0027
- タスク記録: `.orchestration/tasks/P0-T02-branch-protection.md`

## レビュー範囲

1. `.github/rulesets/main-protection.json` — GOV-002/INV-012 要求(required CI、CODEOWNERS、bypass 空)との整合
2. `runbooks/production-gates.md` — 手順と Evidence の正確性・完全性(負証明 5 件の実応答、probe 順序制約、運用帰結)
3. 独立検証(read-only で可能な範囲):
   - `gh api repos/mryfmo/ai-ops-platform/rulesets` で ruleset 20678089 active / bypass_actors 空
   - `gh api repos/mryfmo/ai-ops-platform/codeowners/errors` 空
   - PR #165 の author が `app/aiops-pr-bot`、#166/probe branch が close/削除済み
   - `.orchestration/validation/P0-T02-probes.log` と runbook Evidence 表の一致
4. **破壊的 probe の再実行は禁止**(force push・main push 試行をレビューで繰り返さない。ログ検証で足りる)

## 判定と後続

- findings YAML + independent evidence を `.orchestration/reviews/P0-T02-REVIEW.md` へ(既存書式)
- approve の場合も **merge はしない**: ruleset により Owner approve が必須。
  RESULT に verdict を報告し、merge は Owner 操作(新標準フロー)
- forbidden: edit-pr-branch; merge; push-to-pr; ruleset の変更・削除; probe の再実行
