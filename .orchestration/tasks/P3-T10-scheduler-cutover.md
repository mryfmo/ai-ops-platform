# AGMSG-TASK: P3-T10 — Cut over scheduler functions incrementally

- task_id: P3-T10
- writer: claude-code-fable5-xhigh / reviewer: codex-gpt56-sol-high
- depends_on: P3-T09 ✅（#221）
- risk: high
- branch: `agent/P3-T10-scheduler-cutover`

## allowed_paths（WBS）

1. `packages/server/src/index.ts`
2. `packages/server/src/config.ts`
3. `runbooks/**`
（付随: `packages/server/tests/**` は検証の必要随伴物として許可 — 既往前例踏襲）

## deliverables（WBS + flag 正本 08_feature_flags.yaml）

- **feature-flagged per-workflow cutover**: `control.temporal.enabled` の stage
  （shadow/limited/primary）+ 新 env `AIOPS_TEMPORAL_CUTOVER_TASKS`（P3-T09 の
  15 task 名の comma list）で、legacy scheduler から該当 task を段階的に外す
  決定的 selector（config.ts 内純粋関数）
  - shadow / false: 全 legacy task 稼働（cutover list は無視 — 旧経路完全維持）
  - limited: list 記載 task のみ legacy 停止（残りは legacy 継続 = soak）
  - primary: 全 task legacy 停止（mutually_exclusive 正本規則に整合）
- **kill switch**: `AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED_KILL=1` で無条件 false →
  legacy 全稼働へ即時復帰（resolveMigrationFlags 既存機構）。restart 手順は runbook
- **old path available during soak**: legacy 停止は「登録スキップ」でなく
  「登録済み + 実行ガード」とし、kill/flag 変更後の restart で常に復元可能。
  unknown task 名・重複は E-CFG 系で fail-closed
- **runbooks/temporal-cutover.md**: 段階手順（shadow→limited per-task→primary）、
  kill switch、soak 判定（P3-T09 shadow evidence 突合）、rollback

## acceptance / gates

- kill switch tested（unit: kill env で selector が全 legacy 稼働へ戻る）
- old path available during soak（limited で非対象 task が legacy 実行される）
- TMP-005（blocking, ci）: due-set comparison / duplicate・missed 0 —
  P3-T09 harness の 15-task inventory と selector の整合を CI で機械検証
  （cutover 対象名は inventory の部分集合であることを fail-closed）
- staging soak / failure injection は AWS env（Owner 準備）到達後の後続 evidence
  として validation に明記（コード側はここで完結）

## expected artifacts

- report/validation/review/acceptance/learning: `.orchestration/*/P3-T10-*.md`

## scope amendment（起票時、orchestrator 裁定）

- `verification/temporal-shadow/**` の期待値更新を必要随伴物として許可:
  index.ts へ cutover guard を導入すると P3-T09 harness の AST 検分
  （inventory / call inventory / guard hash）が fail するため。更新は
  「guard wrapper を理解しつつ inventory 完全性の fail-closed を維持する」
  範囲に限る（弱体化禁止）。
- `packages/server/tests/**` は検証の必要随伴物として許可（前例踏襲）。
