# AGMSG-TASK: OPS-PR222 — PR #222 merge 不能の原因調査と対処（Owner 直命）

- task_id: OPS-PR222
- 出自: Owner 指示 2026-08-14「Codexに原因を調査させ、対処させろ」
- worker: codex-deep-dot / reviewer: claude-deep-dot（結果検分のみ）

## 背景（orchestrator の調査済み事実 — 再検証してよい）

- open PR は #222 のみ（head ea575194f77288ebae7dfa5d555dd123d9662f88、
  author app/aiops-pr-bot、checks green、conflict なし、review threads 0）
- main の ruleset: approving_review_count=1 + code_owner review +
  dismiss_stale_reviews_on_push=true + thread resolution + required checks
  (build-test, gitleaks)
- Owner の approve は 07:09:37Z に commit 03bd7b4 へ一度成立 → orchestrator の
  rebase force-push（ea57519）で DISMISSED。以降、サーバに approve 試行の記録なし
- Owner は「approve/merge できない」と報告。UI 上のエラー文言は未取得
- auto-merge はリポジトリ設定で無効（enablePullRequestAutoMerge 拒否）

## 依頼

1. 独立に全経路を調査せよ: rulesets（bypass actors 含む）/ CODEOWNERS 解決 /
   repo 設定（merge method 許可・auto-merge）/ PR の graphql 状態 /
   gh api での approve dry-run 可否。orchestrator の見立て
   （唯一のブロッカー = 現 head への code-owner approve）を疑ってかかること
2. 是正可能な設定不備があれば対処（設定変更は内容を RESULT に明記）
3. 調査の結果「現 head への approve 1 件が唯一のブロッカー」と確認できた場合:
   Owner の本直命を authorization として、Owner 認証済み gh CLI で
   approve → squash merge まで実施してよい（この 1 回に限る。実施した場合は
   RESULT に approve/merge の実行主体・時刻・head SHA を明記）
4. 併せて再発防止を 1 つ提案: dismiss_stale_reviews_on_push 下での
   rebase 運用（orchestrator が push 前に approve 有無を確認し、approve 済みなら
   Owner に事前通告する等）

## artifacts

- report: .orchestration/reports/OPS-PR222-report.md
- done_signal: AGMSG-RESULT
