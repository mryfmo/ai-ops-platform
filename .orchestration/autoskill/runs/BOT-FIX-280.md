# BOT-FIX-280 Autoskill Run

- `agmsg`: task/answer の受信と AGMSG-RESULT の返送に使用。
- `agmsg-orchestration`: task_file-first、Codex worker plan/todo、artifact、result lifecycle に使用。
- `ponytail` (full): 既存 GitHub composition、Jira helpers、Node `crypto` を再利用し、依存追加を避けた。
- `crit-cli`: repository review 手順を確認。`make require-crit-review` target が存在しなかったため Crit data lifecycle は開始していない。
- New skill candidate: なし。既存 skill で対応可能だった。

cost: n/a
