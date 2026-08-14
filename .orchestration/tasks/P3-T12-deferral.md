# P3-T12 — Retire migrated in-process loops（deferral 記録）

- task_id: P3-T12（起票のみ・実行 deferred）
- 判定日: 2026-08-14（orchestrator 裁定）
- 理由: acceptance「rollback window closed by owner」は、実環境での cutover と
  staging soak（P3-T10 runbook の evidence 欄）完了後にのみ Owner が閉じられる
  gate であり、現時点で前提の AWS env / Temporal runtime wiring が Owner 準備
  待ち（P2-T10 と同系列の env-blocked）。legacy loop の物理削除を先行すると
  実環境が zero-writer になるため、コード先行は安全側でない。
- 再開条件: (1) AWS env + Temporal 稼働、(2) P3-T10 手順での per-task cutover と
  soak evidence、(3) Owner による rollback window close 宣言。
- 参照: P0 継続 handoff（Owner 待ち 3 点）+ 本記録。
