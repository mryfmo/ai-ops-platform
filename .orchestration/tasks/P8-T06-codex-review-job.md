# P8-T06: Implement Codex independent review job

- task_id: P8-T06
- writer: codex-deep-dot（WBS どおり codex）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P8-T01 ✅（#247 merged）
- requirement_refs: PRD-008 / FR-AGT-001..006
- adr_refs: ADR-0027
- acceptance_gate_ids: COD-006（workflow security tests — ci 面）
- risk: medium
- **並行注意**: open PR #250（.orchestration）/ #251（scripts/guard +
  .github/actions/run-coding-agent/path-boundary + root package.json）/
  #252（channel/server/schema）。**#251 の変更ファイルに触れない**
  （.github/workflows/** は #251 対象外なので可。scripts/ へ追加する場合は
  新規ファイルのみ・guard 2 ファイルへの接触禁止。root package.json が
  必要なら要 amendment — #251 と重なるため原則回避し workflow 内結線を優先）

## Canon（必読）

- `09_coding_agents.md`: Review dimensions（spec compliance / architecture
  drift / security / correctness / idempotency / test adequacy /
  observability / migration・rollback / documentation・traceability）、
  One Writer protocol（reviewer は read-only、修正は task 返却）
- P8-T01 manifest（writer/reviewer/paths/gates/budget）— review job は
  manifest を入力とし reviewer role を検証
- 既存 `.github/workflows/coding-task.yml` の構造

## Objective

1. **review workflow**（`.github/workflows/`）: coding-task PR に対する
   Codex 独立 review job —
   - **read-only 保証（acceptance の核心）**: job の permissions を
     `contents: read` 系へ最小化し、writer branch への push 資格を持たない
     ことを workflow 定義で構造化（token scope の負 test）
   - manifest の reviewer 指定と実行 profile の一致検証
   - review 対象: diff / spec 準拠 / security の各 dimension を機械可能な
     範囲で collect（LLM 呼出結線は P8-T04/T05 の runner 系が前提のため、
     本タスクは**構造化 findings artifact の契約 + 収集骨格**まで）
2. **findings artifact 契約**: 構造化 findings（dimension / severity /
   file / line / evidence / suggestion）の schema と validation
   （contracts 系の確立パターン。配置は `contracts/agent-review/` 等）
3. **workflow security tests**: reviewer が writer branch へ push できない
   こと（permissions 検証）、findings が構造化契約に適合すること、
   actionlint green

## Acceptance（WBS）

- reviewer cannot push to writer branch（workflow permissions の機械検証）
- findings structured（schema validation）

## Forbidden

- #251 対象ファイル（guard 2 ファイル・path-boundary action・root
  package.json）への接触 / 依存追加 / 実資格情報・実 LLM 呼出
- 既存必須 check の弱体化 / main direct push / merge / approve

## Scope / allowed_paths（WBS + 並行制約）

- `.github/workflows/**` / `scripts/**`（新規ファイルのみ）/
  `contracts/agent-review/**` + `contracts/package.json`（test 1 行）/
  `docs/plans/2026-08-final-architecture/07_agent_execution/**`
- `.orchestration/**`（証跡）

## Validation

- actionlint / workflow security tests / contracts tests green
- fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P8-T06-codex-review-job`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P8-T06-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P8-T06 status=ready_for_review
