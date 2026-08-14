<!-- 根拠: FinalArch:FR-CP-008 / WBS P3-T10 / 08_feature_flags.yaml（control.temporal.enabled / control.legacy_scheduler.enabled） -->

# Temporal scheduler cutover runbook

legacy in-process scheduler（15 task）を Temporal workflow/schedule へ段階的に
切り替える手順。flag の正本は `06_implementation/08_feature_flags.yaml`、
per-task の対応表と等価性 evidence は `verification/temporal-shadow/`。

## 前提

- Temporal 環境（P3-T01 の deploy/temporal）と workflow/schedule 登録
  （P3-T05..T08 + 各 wiring）が対象 task 分だけ稼働していること
- P3-T09 shadow evidence（`shadow-evidence.json`）が最新 main で
  unreasoned differences = 0 であること

## 環境変数

| 変数                                          | 値                                 | 意味                                                             |
| --------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| `AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED`         | `shadow` \| `limited` \| `primary` | 正本 stage ladder                                                |
| `AIOPS_TEMPORAL_CUTOVER_TASKS`                | task 名の comma list               | `limited` 時のみ有効。記載 task の legacy 実行を抑止             |
| `AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED_KILL`    | `1`                                | kill switch。stage を無条件 `false` 化（下記）                   |
| `AIOPS_FLAG_CONTROL_LEGACY_SCHEDULER_ENABLED` | `false`                            | `primary` 到達後の legacy scheduler 全停止（正本の相互排他規則） |

task 名は `packages/server/src/config.ts` の `TEMPORAL_CUTOVER_TASK_NAMES`
（= P3-T09 inventory の 15 名。CI が完全一致を強制）。未知名・重複・空 list は
`E-CFG07` で起動拒否（fail-closed）。

## 段階手順

1. **shadow**: `AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED=shadow`。legacy 全稼働 +
   Temporal 側は write 構造抑止（P3-T05..T08 の shadow mode）。P3-T09 harness で
   計画等価を確認
2. **limited（per-task soak）**: 対象 task を 1 つ以上選び
   `AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED=limited` と
   `AIOPS_TEMPORAL_CUTOVER_TASKS=<task,...>` を設定して再起動。
   - 挙動: 対象 task は**登録は維持したまま run() のみ抑止**（起動 log に
     `temporal cutover: legacy execution suppressed for ...` が出る）。
     非対象 task は legacy 継続 = old path 可用性
   - Temporal 側の当該 workflow を active へ（各 wiring の executionMode）
   - soak 判定: 重複外部 write 0（各 workflow の TMP-003 台帳）+ 欠落 0
     （due-set が P3-T09 比較と一致）を最低 1 sla 周期分観測
3. **拡大**: list に task を追加して再起動を繰り返す（1 回の変更は少数に留める）
4. **primary**: 全 task soak 完了後、`AIOPS_TEMPORAL_CUTOVER_TASKS` を**削除**し
   `AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED=primary` +
   `AIOPS_FLAG_CONTROL_LEGACY_SCHEDULER_ENABLED=false` に設定して再起動
   （primary で list が残っていると E-CFG07 — 意図の明示を強制）

## Kill switch / rollback

- **即時全復帰**: `AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED_KILL=1` を設定して再起動。
  stage は無条件 `false` になり、**cutover list が残っていても不活性**（env 1 つで
  legacy 全稼働へ戻る設計。unit test で保証）。Temporal 側 schedule は
  shadow へ戻すか pause する
- 部分 rollback: `limited` のまま list から該当 task を外して再起動
- コード rollback: 本タスクの PR を revert（旧経路は常に registered のため
  データ migration は不要）

## 検証 evidence（env 到達後に追記）

- staging soak: 各 stage の起動 log・suppressed 一覧・TMP-003 台帳の重複 0 記録
- failure injection: kill switch 発動 → legacy 全稼働復帰の実測（TMP-005 due-set
  比較で欠落 0 を確認）
