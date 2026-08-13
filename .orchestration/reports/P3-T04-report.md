# P3-T04 report — CodingTaskWorkflow

- writer: claude-code-fable5-xhigh / branch `agent/P3-T04-coding-task-workflow` / PR #205（head `dc90804`）
- 実装: 正典状態機械の耐久実行。approval は P3-T03 child、dispatch は
  single-attempt + reconcile（TMP-003）、callback/review は unknown 受け signal
  （duplicate 冪等・conflict 先勝ち・malformed 非 wedge）、期限超過はすべて
  failed 終端（no auto-approval / no auto-complete）
- 設計判断:
  - server 経路（ADR-0006 人間明示クリック + DB 原子確保）不変更。結線は
    control.temporal.enabled 配下の統合タスク（P3-T03 と同型のスコープ判断）
  - review-timeout は complete への自動遷移ではなく failed 終端（安全側読み）
  - fixture 毎一意 taskId（旧 run への query route による RPC 無期限 block の根治）
