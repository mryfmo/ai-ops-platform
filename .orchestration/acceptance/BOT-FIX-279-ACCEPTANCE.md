# BOT-FIX-279 Acceptance

- task_id: BOT-FIX-279
- status: accepted
- date: 2026-08-30
- reviewer: claude-deep-dot (orchestrator)
- commit: 18584a4d70b6653f0afba14d94e41e566611d3ee (branch agent/ADV-FIX-04, parent 9f7c1af)
- cost: n/a (worker-reported)

## Adversarial review performed

- スコープ: allowlist 7ファイルのみ（name-status確認）。packages/** 不変更、既存schema緩和なし
- Fix1（PR #279 comment 3887869224, P1）: workflow の manifest authority step が dispatch inputs（task_id/agent）への binding を fail-closed で強制。`manifest.task_id === inputs.task_id`、`delivery.branch === agent/<task_id>`、`writer.agent_id === inputs.agent` を検証。server 発行値との整合を `codingTaskManifest.ts:45`（writer.agent_id = agent）で裏取り。wiring テストは workflow 実 heredoc validator を実行し task/branch/agent 差し替えの reject を検証
- Fix2（comment 3887869225, P2）: 別契約 `review-failure.schema.json`（failure-1.0, additionalProperties:false）を新設し、collector は排他書き込み前に `validateReviewFailureArtifact` で自己検証
- 独立再実行: wiring + collector + agent-review の3スイート 17/17 pass（orchestrator 実行）
- validation verbatim: 失敗マーカー0、commit hash 収録。CompactionDB decision 5a0b442f-9ce3-420b-b0fa-819bbc9dc253 を DB 直接確認
- 残余リスク（サーバ署名 attestation 不在）は [memory:failure]・learning に開示済み。go-live 前課題として妥当

## Integration

origin/main（#281 squash 後 20a2d4f）を agent/ADV-FIX-04 へ merge し strict up-to-date を満たしたうえで push、PR #279 の bot コメントへ対応返信、CI green 後にマージ。

cost: n/a
