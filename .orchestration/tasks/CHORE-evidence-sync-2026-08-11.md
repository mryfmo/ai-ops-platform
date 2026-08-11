# CHORE evidence sync（2026-08-11、P0 完了境界）

- task_id: `CHORE-evidence-sync-2026-08-11`
- 目的: P0 完了(#170 merge `0989319`)までの `.orchestration` 証跡を main へ同期する
  (レジーム規則: セッション/レジーム境界での一括同期)
- Writer: codex-gpt56-sol-high / 受入: claude-code-fable5-xhigh
- branch: `agent/CHORE-evidence-sync-2026-08-11`(base = main `0989319` 以降)
- 前例: `.orchestration/tasks/CHORE-evidence-sync-2026-08-10.md` / PR #163 の手順を踏襲

## 対象(今日の増分)

- tasks: P0-T02-branch-protection / P0-T02-review / P0-T07a-canonical-amendments /
  P0-T10-review / P0-T10a-review / 本 chore
- reviews: P0-T07-REVIEW(最終形)/ P0-T02-REVIEW / P0-T07a-REVIEW / P0-T10-REVIEW /
  P0-T10a-REVIEW
- validation: P0-T02-probes.log
- learning: 2026-08-11-ci-gate-chain-violation.md(**内容改変禁止** — 違反記録は原文のまま)
- そのほか今日生成された reports/acceptance/sandboxes/autoskill の増分

## 手順・制約(前回と同じ)

1. 秘密情報スキャン(fake fixture 含む)→ 検出時は `[REDACTED …]` 置換を報告書に明記
2. `git add -f` で対象のみ追加。**非 .orchestration ファイルの変更禁止**
3. **新フロー**: branch push と PR 作成は App token(`AIOPS_PR_TOKEN` = aiops-pr-bot、
   mint: `~/.config/aiops/mint-aiops-pr-token.sh`)で行う。merge は Owner approve 後
   (approve された exact head のまま。update branch しない)
4. fresh DB `mise run ci` exit 0 を単独判定してから push(連結で exit を潰さない)
5. force-push 禁止 / 遡及証跡編集禁止

## 成果物パス

- report: `.orchestration/reports/CHORE-evidence-sync-2026-08-11-report.md`
- validation: `.orchestration/validation/CHORE-evidence-sync-2026-08-11-validation.md`
- sandbox/learning/autoskill: see-report 可
