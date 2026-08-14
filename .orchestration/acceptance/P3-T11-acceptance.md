# ACCEPTANCE: P3-T11 — durable execution chaos suite

- task_id: P3-T11
- status: accepted（Owner merge 待ち）
- date: 2026-08-14
- writer: codex-deep-dot / reviewer: claude-deep-dot
- final head: `240042395efc3d8fbdbda38ac78ba73a79dfbf47`（PR #226、App token author）
- evidence: 14 workflows × 56 scenarios — duplicateSideEffects 0 /
  runningWedges 0 / silentSuccesses 0（recovered 43 / explicit failures 13）。
  Vitest gate が evidence の byte 等価再生成と 0 値を強制
- finding 運用: P3-T11-001（replayProbe RUNNING wedge）を worker が契約どおり
  報告 → orchestrator 裁定 fix（E-CP-EXTERNAL-UNRESOLVED terminal 化）→
  worker が期待値更新・evidence 再生成。隣接 flake（plan-only 5s timeout）は
  orchestrator 随伴 fix
- gates: TMP-001/TMP-004 充足。222 tests / fresh-DB 素の `mise run ci` exit 0
  （writer + reviewer 双方）/ clean-runner CI green（head 2400423）
- next_action: Owner merge — **#225（P3-T10 証跡 sync）→ #226**。
  merge 後: P3-T11 証跡 sync → P3-T12（P3 最終タスク）。
