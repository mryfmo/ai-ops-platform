# BOT-FIX-289 Learning

- [memory:decision] ループ内で現在値を変数へ代入し、その直後の1式でしか使わない場合は、現在値を直接使う。今回は `s.atSecondsFromDeploy - runStart` にすることで、600 秒閾値とリセット挙動を変えずに不要代入を消せた。
- [memory:decision] lint の新しい major version を依存変更なしで再現できないタスクでは、現行 lint、該当パターンの消失、既存の境界テスト、全CIをローカル証拠とし、新 major の最終判定先を明記する。
- [memory:failure] 一時的な launchd 検証 job は `KeepAlive` により親プロセス終了後も再起動し得る。タスク終了時に `launchctl bootout` し、plist と対象プロセスが残っていないことを確認する。
- [memory:failure] shared worktree では複数の `vitest --coverage` が同じ `coverage/.tmp` を競合して壊すため、全CIの同時実行を避ける。

CompactionDB decision: `ccbda29f-d7b7-4241-bb63-284e7b8d62e6`

既存ロジックの1式への置換だけで完了したため、新しい共通 skill や依存は追加しない。

cost: n/a
