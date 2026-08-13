# P3-T03 report — approval child workflow

- writer: claude-code-fable5-xhigh / branch `agent/P3-T03-approval-workflow` / PR #202（head `3c11713`）
- 実装:
  - `lib/approvalDecision.ts`: decision signal 受理判定（純粋関数）。version 完全一致 CAS、
    stale/二重決定/id 不一致/不正 decision/無記名 approver は理由付き拒否
  - `workflows/approval.ts`: approvalWorkflow — defineSignal/Query + condition(expiryMs)。
    期限超過は expired（no auto-approval）。拒否 signal は決定的カウンタで outcome に記録
  - `workflows/entry.ts`: workflowsPath 単一 entry（bundle 対象の正本）
  - fixtures: approved（stale+mismatch 拒否込み）/ expired / restart-safe の 3 recorded history
- 設計判断:
  - 承認権威は approvalsRepo（DB CAS、P1-T05/DELTA-03）が正本のまま。workflow は
    待機・期限の耐久化のみ（第二台帳を作らない）
  - server route / web は不変更（deliverable/acceptance は workflow 層で充足。
    Temporal client 結線は control.temporal.enabled 配下の統合 = P3-T04 以降）
  - restart-safety の CI 証跡は maxCachedWorkflows=0 の per-task history 再構築記録。
    実プロセス 3 回再起動 E2E は deploy/temporal smoke 系（staging）の管轄と明記
