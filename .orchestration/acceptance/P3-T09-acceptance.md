# ACCEPTANCE: P3-T09 — Temporal scheduler shadow

- task_id: P3-T09
- status: accepted（Owner merge 待ち）
- date: 2026-08-14
- writer: codex-deep-dot / reviewer: claude-deep-dot
- final head: `43aba54d436bd05ee7226bca9322893cf685bf67`（PR #221。#216/#218 merge 後の rebase — conflict は package.json/lockfile の機械的解消のみで PR 実内容不変、rebase 後も frozen install / shadow 4/4 / clean-runner CI green）
- review: `.orchestration/reviews/P3-T09-REVIEW.md` — R01（並列 coverage での
  5s timeout、reviewer が素の CI で検出）/ R02（esbuild 未宣言の hoisting 依存、
  clean runner が検出）→ いずれも解消。R02 では worker の native-bin 指摘を採択し
  amendment を修正（exact devDep 0.28.1 + buildSync API）
- gates:
  - DELTA-01: 15/15 inventory（inline 含む）を AST で fail-closed 捕捉
  - 副作用抑止: structural-plan-only + bundle network-denial + node --permission。
    12 match / 3 reasoned / 0 unreasoned / 1 temporal-only、external writes 0
  - index.ts 差分 0 / writer + reviewer 双方で素の fresh-DB `mise run ci` exit 0 /
    clean-runner build-test（7m32s）+ gitleaks green
- next_action: Owner merge — **#216（P3-T08 証跡 sync）→ #221** の順。
  merge 後: P3-T09 証跡 sync → P3-T10 以降（WBS 順）。
