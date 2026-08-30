# P8-T03: Issue scoped runner credentials（GOV-003 amended scope）

> **2026-08-17 凍結解除**: GOV-003 署名発効（#263 merge、
> docs/decisions/2026-08-17-gov-003-p8-t03-amendment.md が Accepted）。
> 本タスクは **amended WBS P8-T03**（02_wbs.yaml L2457 以降の改訂版）を正本とし、
> 以下の追加 scope を含む:
>
> 1. **GitHub App installation token の job-scoped mint/use/revoke**:
>    対象 repository と最小 permission（contents/PR）に限定し、
>    **push/PR 専用 step にのみ注入**（agent 実行 step へ渡さない）
> 2. **workflow → issuer 認証は GitHub OIDC audience-bound token**。
>    runner は master key / provider key / App private key を一切保持しない。
>    endpoint 設定不在・OIDC token 不在・audience 不一致は fail-closed
> 3. **always-run cleanup**: LiteLLM virtual key と installation token を
>    成功・失敗とも revoke。revoke failure は報告（握り潰し禁止）。
>    有限 expiry は defense in depth
> 4. verification 追加: out-of-scope repository / main-push / 期限切れ /
>    cleanup failure / root-credential 非流出の負テスト
> 5. PAT removal readiness まで（AIOPS_PR_TOKEN secret の最終削除は P10-T10）
>
> allowed_paths += `packages/control-plane/tests/**`（署名済み）。
> open PR 非接触条項: 現在 open PR なし（#260-263 merge 済み）。

- task_id: P8-T03
- writer: codex-deep-dot（Owner 指示 2026-08-15 により実務委任。WBS 原記載
  writer=claude。orchestrator は起票・adversarial review・acceptance）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P2-T08 ✅ / P8-T01 ✅（#251 系）
- requirement_refs: PRD-001 / FR-COD 系
- acceptance_gate_ids: COD-002 / COD-004（ci 面。sandbox-github の live 証跡は
  環境到達後）
- risk: high

## Canon / 前提（必読）

- canon 04_component_specs/09_coding_agents.md「Runner environment」:
  **LiteLLM scoped virtual key / no master key/provider key** /
  max runtime/cost/tokens 上限
- 現況: `.github/workflows/coding-task.yml` は**長命 repo secret**
  `LITELLM_CODING_VIRTUAL_KEY` を composite action へ input 渡し。
  本タスクはこれを **job-scoped key lifecycle** に置換する
- deploy/litellm/config.yaml（P2 系）: master_key は `os.environ/` 参照。
  enterprise 無効・route-allowlist 等の既存 gate を壊さない
- P8-T01/T02 の contracts/agent-task 系 gate（path guard・manifest）は非接触

## Objective

1. **issuer（control-plane activity、注入可能）**: LiteLLM key management API
   （`/key/generate` / `/key/delete`）への型付き client + activity。
   発行 key は **job 単位**で: models=当該 task の alias のみ /
   max_budget / duration（expiry）を必須指定（未指定は型で表現不能に）。
   master key は issuer 内のみ — 発行結果（virtual key）以外を runner へ
   渡さない。fetch/clock は注入（FetchLike 踏襲、ネットワークなしで test）
2. **revocation（acceptance: revoked after run）**: run 終了時（成功・失敗とも）
   に `/key/delete`。revoke 失敗は握り潰さず報告（fail-closed 記録）。
   expiry は defense-in-depth（revoke 漏れでも duration で死ぬ）
3. **workflow 結線**: `coding-task.yml` を job-scoped 前提の形へ
   （長命 key の直接消費を廃し、issuance/revoke step 構造 + `always()` revoke。
   live LiteLLM 未到達のため実行面は環境 gate 後 — 構造と検証 gate を先行）
4. tests: **key negative/expiry tests**（WBS verification）—
   budget/model/expiry 未指定の拒否、期限切れ key の拒否、
   revoke-after-run（失敗 path 含む）、master key 非流出
   （runner へ渡る値集合に master key が含まれない test）

## Acceptance（WBS）

- model/budget/expiry enforced（型 + 負 fixture）
- revoked after run（always path + 失敗時報告）

## Forbidden

- main direct push / merge / approve / production configuration
  （approved environment gate なし）
- 依存追加 / 実資格情報・実 URL のコミット（placeholder のみ）
- open PR **#260 / #261 / #262** 変更ファイル接触
- master key・provider key を runner env / composite action input へ渡す変更

## Scope / allowed_paths（WBS）

- `packages/control-plane/src/activities/**`
- `deploy/litellm/**`
- `.github/workflows/coding-task.yml`
- `.orchestration/**`（証跡）

## Validation

- 新規 tests green（ネットワークなし）/ fresh DB で `mise run ci` exit 0
  （単独判定）

## PR / blocked-auth

- branch `agent/P8-T03-scoped-runner-credentials`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P8-T03-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P8-T03 status=ready_for_review
