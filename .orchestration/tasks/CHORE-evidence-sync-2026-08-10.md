# CHORE: .orchestration 証跡の一括同期 + workspace 整理（2026-08-10 セッション境界）

- task_id: CHORE-evidence-sync-2026-08-10
- Writer: codex-gpt56-sol-high / Reviewer: claude-code-fable5-xhigh
- 実施順: 現在のキュー（P0-T07-REVIEW → P0-T07 merge）完了後
- risk: low / max_turns: 15
- 根拠: agmsg レジーム規約「.orchestration 証跡はセッション境界で 1 chore タスクとして一括同期」

## 実装要件

1. branch `agent/CHORE-evidence-sync-2026-08-10`（base = 最新 main）で、
   `git add -f` により以下を tracked 化して 1 commit にまとめる:
   - .orchestration/tasks/**（P0-T01..T09, P0-T07-review, P0-T08-review, 本ファイル）
   - .orchestration/reports/** / .orchestration/validation/** / .orchestration/reviews/**
   - .orchestration/sandboxes/** / .orchestration/learning/** / .orchestration/autoskill/**
   - .orchestration/acceptance/**（存在する場合）
   - .orchestration/handoff/2026-08-10-p0-continuation.md
2. **秘密情報検査必須**: 追加前に全ファイルへ gitleaks 相当スキャン + 手動確認
   （実 credential・実テナント ID・key 素材が皆無であること）。検出時は該当箇所を
   redact してから追加し、redaction を report に記録
3. workspace 整理（同 PR には含めない。ローカル操作のみ）:
   - main worktree（/Users/mryfmo/Workspace/ai-ops-platform）を `git checkout main` +
     `git pull` で最新 main へ戻す
   - squash merge 済みローカル branch を削除: a049-pr142 / a049-pr94 /
     agent/P0-T01-baseline-revalidation / agent/P0-T04-fitness-checks /
     agent/P0-T05-perf-baseline / agent/P0-T06-license-inventory /
     agent/P0-T09-secret-identity-migration / agent/a028-basis-header-scope（#131 squash 済み）
   - 自分の作業残骸 worktree（/private/tmp/aiops-p0-t04-revise、/private/tmp/aiops-p0-t07-review）を
     `git worktree remove` + `git worktree prune`
   - **削除禁止**: agent/P0-T07-temporal-profile（#160 open）/ agent/P0-T02-branch-protection（#161 open）と
     その worktree
4. PR（ai-generated）→ checks green → 受入後に merge ゲート

## forbidden

- main direct push / force push / .orchestration 以外のファイル変更 / 履歴改変・証跡の書換
  （追加のみ。内容の遡及編集は禁止）

## 完了報告

AGMSG-RESULT v1 task_id=CHORE-evidence-sync-2026-08-10 status=ready_for_review report=.orchestration/reports/CHORE-evidence-sync-2026-08-10-report.md validation=.orchestration/validation/CHORE-evidence-sync-2026-08-10-validation.md sandbox=see-report learning=see-report autoskill=see-report
