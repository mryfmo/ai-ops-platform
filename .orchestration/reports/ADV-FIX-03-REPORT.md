# ADV-FIX-03 Report

- Status: **blocked**
- Branch: `agent/ADV-FIX-03`
- Base/head: `c8704c54c304669036054dfab23f92b7aa560d90` (`origin/main`)
- Product/workflow implementation changes: none
- cost: n/a

## Disposition

[memory:decision] ADV-FIX-03 は task_file の STOP 条件に該当する。現行 production 経路に validated task manifest bytes/path/digest の authority がなく、`coding-task.yml` だけへ pre/post action を追加しても実データを供給できない。schema/product code を本 task の allowed files 外で推測実装せず blocked とする。

## Evidence

1. `.github/workflows/coding-task.yml:40-66` の dispatch inputs は `task_id`, `project_id`, `instruction`, `base_ref`, `agent` のみで、manifest path/content/digest がない。
2. `packages/server/src/http/routes/codingTasks.ts:198-212` は同じ 5 input だけを dispatch する。task issuer/confirm route に manifest validation または digest binding はない。
3. `packages/devops/src/db/schema.sql:463-483` の `coding_tasks` に manifest bytes/path/digest 列がない。repository 層にも対応 field がない。
4. `contracts/agent-task/` に存在するのは schema/validator と fixture であり、task ごとの production manifest instance を生成・永続化・dispatch する caller はない。
5. `.github/actions/run-coding-agent/path-boundary/action.yml:5-17` は validated manifest path と ephemeral integrity key を必須とするため、authority のない値を workflow 内で合成できない。
6. `.github/workflows/coding-task-review.yml:5-26,64-81` は review target 内 manifest path のみを受ける。`scripts/collect-agent-review.mjs:119-131` は target checkout の bytes をそのまま parseし、外部 digest と照合しない。
7. `scripts/coding-agent-path-guard.mjs:161-165,190-221` の digest は manifest raw bytes の SHA-256 であり、pre/post 間だけは正しく固定される。この raw-byte authority を upstream から供給する契約が欠けている。

## Why a workflow-only patch is unsafe

- required manifest inputs を `coding-task.yml` に追加すると現行 server dispatch が値を送らないため production execution は全件失敗する。
- checkout 内 path を task ID から推測すると、task ごとの allowed/forbidden scope が存在せず、fixture または writer-controlled content を authority と誤認する。
- review workflow に digest input だけ追加しても、その digest を確定する queue/orchestrator source が存在せず、operator が writer 提示値を転記できる穴が残る。

## Minimum unblock design

1. **Trusted task issuer**: task enqueue 前に complete manifest を `validateAgentTaskManifest()` で検証し、exact UTF-8 bytes と raw-byte SHA-256 を task authority として固定する。instruction から workflow 内で合成しない。
2. **Immutable persistence**: `coding_tasks` に exact manifest bytes（または immutable object reference）と `manifest_sha256` を追加し、task lifecycle 中の UPDATE を禁止する migration/repository tests を伴わせる。JSONB 再直列化だけでは raw-byte digest が変わるため、exact bytes または canonicalization 契約が必要。
3. **Bound dispatch**: server/Temporal dispatch が manifest material/reference と digest を同じ task ID に束縛して coding/review workflow へ渡す。missing/mismatch は credential issue・agent execution 前に fail-closed。
4. **Coding workflow**: trusted step が manifest を `${RUNNER_TEMP}` に materializeして schema+digest を検証し、job-local random HMAC keyを maskする。pre guard → agent → credential revoke → post guard の順とし、post success 前に Detect/commit/GitHub credential issue/pushへ進めない。
5. **Review workflow**: writer checkout 外の dispatch authority から exact digest を `collect-agent-review.mjs` へ渡す。mismatch/missing 時は critical machine finding artifact を書いて nonzero exit、upload step は `if: always()` で証跡を保持する。

## Required scope amendment / prerequisite

- `packages/devops/src/db/schema.sql` + migration
- `packages/server/src/db/codingTasksRepo.ts` と tests
- `packages/server/src/http/routes/codingTasks.ts` と tests
- task manifest issuer/queue または Temporal activity contract と tests
- authority design 裁定（exact bytes vs canonical JSON vs immutable object reference）

これらが owner 承認で先行し、manifest authority が production dispatch に現れた後、本 task の workflow/collector 結線を再開できる。

## Side effects

- Persistent external effects: none
- Commit/push/PR/merge/ruleset changes: none

## CompactionDB

`.claude/hooks/contextdb_cli.py` は current main に存在しないため unavailable。標準 waiver に従い、受入時 consolidation は orchestrator 所管とする。
