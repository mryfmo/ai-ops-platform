# GOV-PR-01 Acceptance

- task_id: GOV-PR-01
- status: accepted
- date: 2026-08-30
- reviewer: claude-deep-dot (orchestrator)
- commit: b6df5efa75b1d8319d1107141ede71414385a4f7 (branch agent/GOV-PR-01, parent 26b07ea)
- cost: n/a (worker-reported)

## Adversarial review performed

- スコープ: allowed 6ファイルちょうど（.env.example / AGENTS.md / ADR-0032 / runbook / mint script+test）。ruleset・App・credential・workflows 不変更を確認
- ADR-0032: author分離（CI=P8-T03 issuer / ローカル=mint script）、人間=review/merge専任、bypass_actors恒久空+break-glass、bot threadのエージェント解決境界、stacked PR retarget規則、ADR-0006維持——タスク要求の全決定事項を既存書式で記録
- mint script: 依存追加なし（node:crypto RS256）、App JWT は iat-60/exp+540、response の status/JSON/token/expiry を検証、**token のみ stdout**（他は stderr）、fetch 注入可。独立再実行 9/9 pass（orchestrator, temp worktree）
- AGENTS.md: 規約3行+ADR列挙のみの最小差分
- validation: 失敗マーカー1件は開示済み RED（.env.example の assignment 形式が config inventory 検査で拒否→コメント形式へ是正）。最終 fresh PostgreSQL `mise run ci` exit 0（stdout/stderr 分割ログを同梱、stderr の PostgreSQL ERROR は negative test 期待出力）
- CompactionDB decision 3897aed4-8d27-40e5-a4f9-6e41046a1e2c を DB 直接確認

## Bootstrap note

本PR自体は App 未作成のため mryfmo 名義+break-glass 相当手順で統合する（ADR-0032 導入前の最終ブートストラップ例外として記録）。App 作成後は runbook の手順で AIOPS_PR_TOKEN 経路へ移行する。

cost: n/a
