# BOT-FIX-280 Acceptance

- task_id: BOT-FIX-280
- status: accepted
- date: 2026-08-30
- reviewer: claude-deep-dot (orchestrator)
- commit: c3f6ea2cec51a809b34bfcef2879fc5450beae6e (branch agent/JIRA-INT-01, parent e6f360f)
- cost: n/a (worker-reported)

## Adversarial review performed

- スコープ: 18ファイル+fixture 18再生成、すべて allowed_files 内（AGMSG裁定3件: index.ts / runtime-seams / configuration.md を含む）。依存・lock・thresholds・contracts/workflows 不変更
- Fix1（composition, comment 3887867714）: `createJiraRuntimeComposition` を env-gated で導入。JIRA_* 設定済み+backend 未注入は startup throw（fail-closed）を diff で確認。config.ts の Zod superRefine が変数ペア（mapping+secret / site+token、snapshot→mapping 依存）を強制。dist/src 双方で成立する validator 相対 import を確認
- Fix2（revision, comment 3887867716）: `JiraSyncIdentity.revision`（SHA-256(canonical updated + fieldHash)）を identityKey・businessKey・idempotencyKey・全 ledger parser（identityMatches）へ組み込み。webhook/snapshot 双方から決定的導出可能な選定理由を確認。replay fixture 18件は recorder 再生成（手書きなし）
- Fix3（JQL, comment 3887867717）: 終端は `isLast === true` のみ。それ以外は有効 token 必須、欠落は E-JIRA-MALFORMED throw
- Fix4（署名, comment 3887867719）: production mapping は provenance.signature 除外の再帰 key-sort canonical JSON を Ed25519 verify。鍵は PEM/base64-SPKI、非 Ed25519 鍵は拒否。dev fixture ゲートは不変更
- 独立再実行（orchestrator）: control-plane 31/31（state+replay）、integrations 6/6、server 92/92（新規 jiraComposition.test.ts 含む）、mapping validator 7/7
- validation verbatim: 失敗マーカー0、commit hash 収録、fresh PostgreSQL で `mise run ci` exit 0。CompactionDB decision ece271c9-2dce-4e31-98c3-5e937d8b53d5 を DB 直接確認
- go-live 前提（deployment composition による Temporal jira-sync backend 注入）は Runtime prerequisite として report・runbook に記載済み

cost: n/a
