# AGMSG-TASK: P3-T06 — JIT expiry and health workflows

- task_id: P3-T06
- writer: codex-gpt56-sol-high（WBS 指定 — worker 実装）
- reviewer: claude-code-fable5-xhigh（orchestrator adversarial review）
- depends_on: P3-T02 ✅。P3-T05 の確立様式（有限 workflow + Temporal Schedule、
  shadow 構造抑止、entry bundle、recorded fixtures）を踏襲
- risk: medium
- branch: `agent/P3-T06-jit-health-workflows`

## allowed_paths（WBS）

1. `packages/control-plane/src/workflows/**`（+ 対応 `src/lib/**`・`tests/**`・
   record script への fixture 追記）
2. `packages/devops/src/**`（**必要最小限**。既存 AGT_SEC.revokeExpiredGrants /
   health 判定の純粋関数は再利用が第一。lib/agents 分離原則維持）

## forbidden_actions

- main direct push / merge
- **PR 作成は AIOPS_PR_TOKEN（app/aiops-pr-bot）flow のみ。Owner 認証の gh での
  PR 作成禁止（#207 の self-approve 不能事故の再発防止）。token 不可なら
  AGMSG-RESULT status=blocked-auth で orchestrator に委譲**
- 既存 scheduler 経路（jitRevocationTask 1m ループ等）の削除・無効化・挙動変更
  （shadow 共存が前提）
- 実外部 API 呼び出しを含むテスト / 新規依存追加

## deliverables（WBS）

- **durable schedules and activities**: JIT 失効判定（毎分 SLA）と health 評価の
  Temporal workflow + Schedule 化。失効（revoke）は非冪等外部書き込みとして
  runExternalSideEffect + 決定的 idempotency key + reconcile（TMP-003）
- shadow mode: 構造的 write 抑止（P3-T05 様式）。active への cutover は別タスク

## acceptance（WBS）

- **expiry SLA preserved**: 毎分判定の SLA が workflow/Schedule 化後も保たれる
  （Schedule interval + catchupWindow + overlap policy で根拠を示す）
- **health evaluation deterministic**: 判定はコード（lib 純粋関数）、時刻は
  workflow logical time。LLM・乱数・実時刻直参照なし

## gates

- TMP-003（blocking, ci）: lost-response revoke で二重剥奪記録なし + reconcile 回収

## verification

- time-skipping/unit tests + recorded fixtures + replay（P3-T02..T05 harness）
- 恒久則（P3-T03..T05 で確立、binding）: unknown 受け + 参照前形検証 /
  相関 ID は schedule 前確定 / 権威は authoritative read / timeout→成功なし /
  fixture 毎一意 workflow ID / merged fixtures byte 不変（push head の
  merge-base diff で不在確認）/ 契約違反は non-retryable E-CP-CONTRACT
- fresh 使い捨て DB（run 毎再作成・same-shell）で `mise run ci` exit 0

## expected artifacts

- report/validation/sandbox/learning/autoskill: `.orchestration/*/P3-T06-*.md`
- done_signal: AGMSG-RESULT（non-draft PR + ai-generated label、App token author）

## scope amendment 2026-08-14（orchestrator 裁定）

- `packages/control-plane/vitest.config.ts` の coverage.exclude へ **P3-T06 新規
  workflow ファイルの追加のみ**許可（前例: P3-T02..T04 の
  replayProbe/approval/codingTask 除外と同一根拠 — Temporal VM 実行は host V8 に
  不可視で、行使は recorded-history replay が担保する）。
- 条件: (a) 除外は新規 sandbox 実行 workflow ファイルに限る（lib/ は除外禁止 —
  純粋判定は直接テスト必須）、(b) 既存の理由コメントに追記する形で根拠を明記、
  (c) threshold 値の変更は不可。
