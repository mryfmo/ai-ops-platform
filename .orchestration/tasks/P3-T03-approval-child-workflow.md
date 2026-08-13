# AGMSG-TASK: P3-T03 — approval child workflow

- task_id: P3-T03
- writer: claude-code-fable5-xhigh（orchestrator が実装）
- reviewer: codex-gpt56-sol-high（AGMSG-TASK `P3-T03-REVIEW`）
- depends_on: P3-T02 ✅（#200）, P1-T05 ✅（approvals DB CAS = DevOps:SPEC-EXT-010）
- risk: high
- branch: `agent/P3-T03-approval-workflow`

## allowed_paths（WBS）

1. `packages/control-plane/src/workflows/**`（+ 対応 `packages/control-plane/src/lib/**`・
   `tests/**`・record script。lib は workflow から使う純粋判定の置き場所として
   設計原則 1 に従う）
2. `packages/server/src/http/routes/approvals.ts`
3. `packages/web/src/app/approvals/**`

**スコープ判断**: WBS deliverable（durable approval signal/CAS/expiry）と acceptance
（restart-safe / stale rejected / no auto-approval）はすべて workflow 層で満たす。
server route / web の Temporal client 結線は `control.temporal.enabled` flag 配下の
統合（P3-T04 以降）で行い、本タスクでは server/web を変更しない（変更しない選択も
boundary 内）。DB CAS の正本は既存 approvalsRepo（P1-T05/DELTA-03）のまま。
workflow は「待機と期限の耐久化」を担い、権威を複製しない。

## forbidden_actions

- main direct push / draft PR / merge
- 承認権威の複製（approvalsRepo と並行する第二の承認台帳を作らない）
- auto-approval に相当する既定値・timeout 承認
- ネットワークを要するテスト（record は dev-only script のみ）

## deliverables

- **approval child workflow**: 明示 signal（approvalId + version CAS + decision）のみで
  approved/rejected。version 不一致・重複・不正 decision は stale として拒否記録
- **expiry**: 期限超過は `expired` 終了（承認にはならない = no auto-approval）
- **durable/restart-safe**: worker 再起動を跨いだ recorded history + replay 検証

## gates

- TMP-002（blocking, ci）: signal tests + stale version negative

## verification

- 純粋判定（lib）の CAS matrix unit tests
- recorded history: approved（stale signal 拒否含む）/ expired / worker-restart 横断の
  3 fixture + replay test（P3-T02 の harness 拡張）
- fresh 使い捨て DB（run 毎に再作成）で `mise run ci` exit 0

## expected artifacts

- report/validation/review/learning: `.orchestration/*/P3-T03-*.md`
