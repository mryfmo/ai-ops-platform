# OPS-PR231: PR #231 approve 不能の診断と解消（Owner 命令）

- task_id: OPS-PR231
- worker: codex-deep-dot
- 種別: 運用対処（OPS-PR222 と同型）。Owner の明示指示
  「codexに実務はやらせるべき」に基づく委任

## 背景

- PR #231（P4-T02、author=app/aiops-pr-bot）: #230 との add/add conflict を
  orchestrator が解消 push（merge commit `11613a94c84431aff7de4251c0ff2241f20eaa48`、
  author/committer=mryfmo、pusher=App token）
- 現況（orchestrator 観測）: mergeable=MERGEABLE / checks 全 green
  （build-test・gitleaks・CodeRabbit）/ mergeStateStatus=BLOCKED /
  reviews=[DISMISSED]（解消 push が既存 approve を dismiss）
- Owner は approve できないと報告（web UI での失敗詳細は不明）。
  ruleset 20678089: require_last_push_approval=false /
  required_approving_review_count=1 / code owner review 必須 /
  thread resolution 必須 / dismiss_stale_reviews_on_push=true

## Objective（この順で）

1. **正確な診断**: gh api / gh pr view で approve を阻む実際の要因を特定する
   （PR author・review 状態・ruleset 評価・pending threads・head SHA 不一致等。
   推測でなく API 応答を証跡として記録）
2. **修正可能な要因があれば対処**（例: 未解決 thread の resolve、stale 状態）
3. 診断の結果、**唯一の blocker が「現 head への approve」のみ**であれば、
   OPS-PR222 と同一手順の Owner 命令執行として、Owner 認証済みの official
   gh CLI で approve → merge を実行する:
   - `gh pr review 231 --approve`
   - `gh pr merge 231 --squash --match-head-commit 11613a94c84431aff7de4251c0ff2241f20eaa48`
   - head が変わっていた場合は実行せず報告（--match-head-commit で保証）
4. merge 後: main の最新化確認と、diagnosis/実行ログを validation へ記録

## Forbidden

- PR 内容（コード・ファイル）の変更、force-push、branch の書き換え
- head SHA が上記と不一致のままの merge
- 診断を省略した実行（証跡なしの操作禁止）

## Expected artifacts

- report: `.orchestration/reports/OPS-PR231-REPORT.md`
  （診断結果・根本原因・実行した操作・恒久対策の提言）
- validation: `.orchestration/validation/OPS-PR231-VALIDATION.md`
  （gh api 応答・実行コマンドと出力）

## Done signal

AGMSG-RESULT v1 task_id=OPS-PR231
