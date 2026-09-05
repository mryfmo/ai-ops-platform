# AGMSG-TASK CHORE-HYG-01: traceability matrix の陳腐化を根本是正 + runbook 権限表の実測整合

- task_id: CHORE-HYG-01
- repo: /Users/mryfmo/Workspace/ai-ops-platform
- 依頼者: claude-deep-dot（orchestrator）
- max_turns: 40

## Objective

main にコミット済みの `packages/traceability/output/traceability_matrix.md` が 2026-08-10 生成のまま 13 マージ分陳腐化していた。原因は (a) 生成物に timestamp が含まれ再生成が非冪等、(b) CI がコミット済み生成物と再生成結果の一致を検証しないこと。両方を根本是正する。あわせて `runbooks/ai-pr-identity.md` の App 権限表を実測に合わせる。

## Branch

`git switch -c agent/CHORE-HYG-01 origin/main`。直接コミット、push禁止。

## Fix 1: matrix 生成の決定論化

- `packages/traceability/src/verifyTraceability.ts` の matrix 出力から壁時計 timestamp（`生成日時: ...Z`）を排し、再現可能な由来表記（例: 「対象commit: `git rev-parse --short HEAD` 時点」…ただし working tree 実行では hash が変わるため、**hash も入れず「生成物はコミット時点のリポジトリ状態を反映する」旨の凡例に変更**が最も冪等）へ変更する。過去の P3-T02 learning（「mise run ci が再生成するため timestamp を merge-base に復元」した経緯）を読み、同じ痛点を恒久解消する形にすること
- 既存テスト（packages/traceability/tests/）を追随

## Fix 2: 鮮度ゲート

- `mise run ci` の traceability 段階で、再生成後に `git diff --exit-code packages/traceability/output/traceability_matrix.md` 相当の一致検証を行い、コミット済み matrix が古いままなら fail させる（実装位置は `.mise.toml` の traceability タスク or verifyTraceability 内の self-check、既存構成に自然な方）
- これにより ID を変える PR は matrix 再生成コミットを同梱しないと CI が落ち、main の陳腐化が構造的に起きなくなる。決定論化（Fix 1）が前提
- 注意: 連続マージで main 上のみ組み合わせが変わるケースは ID 集合が単調なら一致する想定だが、REPORT で影響を検討し断言すること

## Fix 3: matrix の現行化

- Fix 1 適用後の形式で matrix を再生成しコミットに含める（手編集禁止）

## Fix 4: runbooks/ai-pr-identity.md の実測整合

- App `aiops-pr-bot` の実権限は **contents: write / pull_requests: write / metadata: read の3項目**（2026-09-05 に workflows:write 除去済み、issues:write は不要と実測 — PR #291 で pull_requests:write のみで label 付与成功）
- 権限表と manifest JSON 例から Issues 行を削除し、「label 付与は pull_requests:write で可能（実測 2026-09-05, PR #291）」の注記へ置換

## Validation（verbatim）

- `mise run traceability` を2回連続実行し、2回目に diff が出ないこと（冪等性の証明）
- matrix を意図的に1行改変→ ci の traceability 段階が fail する RED 証明→復元
- `mise run ci`
- `git log -1 --format='%H %s'` / `git status --porcelain`

## allowed_files

- packages/traceability/src/** / packages/traceability/tests/**
- packages/traceability/output/traceability_matrix.md（再生成コミットのみ）
- .mise.toml（traceability タスクへの一致検証追加が必要な場合のみ、最小差分）
- runbooks/ai-pr-identity.md
- .orchestration/{reports,validation,sandboxes,learning,autoskill/runs}/CHORE-HYG-01*
- .agents/worklog/codex/**

## forbidden_actions

- git push / PR 操作 / 依存追加 / lock 変更 / matrix の手編集 / 他 runbook・contracts の変更 / LLM API 呼び出し

## Expected artifacts

- report / validation / sandbox / learning / autoskill: .orchestration 配下 CHORE-HYG-01*（cost: 行、[memory:decision]/[memory:failure]、CompactionDB decision コマンド全文）
- done_signal: AGMSG-RESULT v1
