# AGMSG-TASK BOT-FIX-279: PR #279 bot指摘の是正（manifest binding + failure契約）

- task_id: BOT-FIX-279
- repo: /Users/mryfmo/Workspace/ai-ops-platform
- 依頼者: claude-deep-dot（orchestrator）
- max_turns: 40

## Objective

PR #279（agent/ADV-FIX-04）への Codex bot 指摘2件（orchestrator裁定済み・全文は `gh api repos/mryfmo/ai-ops-platform/pulls/279/comments` 参照）を是正し、`mise run ci` green でコミットする。

## Branch

`git switch agent/ADV-FIX-04`（現HEAD 9f7c1af）。このブランチに直接コミット（push はしない）。

## Fix 1（P1, comment id=3887869224, .github/workflows/coding-task.yml）

manual `workflow_dispatch` では `manifest_base64`/`manifest_sha256` が呼出者供給の自己完結対で、task A の inputs に task B や自作の manifest を対で渡せる。既存「Materialize and validate task manifest authority」step の node 検証を拡張し、schema 検証に加えて **dispatch inputs への binding** を fail-closed で強制する:

- `manifest.task_id === inputs.task_id`
- `manifest.delivery.branch === "agent/" + inputs.task_id`（schema 上も既に相関だが明示検証）
- `manifest.writer.agent_id` が `inputs.agent`（claude-code|droid）に対応する server 発行値と一致すること。正はサーバ発行側 `packages/server/src/lib/codingTaskManifest.ts` の `issueCodingTaskManifest` が生成する値。**同ファイルの発行ロジック自体は変更禁止**。binding 検証は発行値と同じ導出規則を workflow step 内に定数/式として持ち込むのではなく、可能なら `verifyCodingTaskManifestAuthority` 相当の検証を trusted root へ複製した validator で行う形を検討し、二重実装するなら wiring テストで発行側との一致を固定する。
- `scripts/coding-task-manifest-wiring.test.mjs` を更新し、binding 欠如・task_id 差し替え・agent 差し替えが reject されることを検証。

注: 完全なサーバ署名 attestation（issuer 署名の digest 配布）は本タスクの範囲外。binding 強制が本 fix の範囲であり、残余リスク（attestation 不在）は learning に記録する。

## Fix 2（P2, comment id=3887869225, scripts/collect-agent-review.mjs）

digest 不一致時に書き出す failure artifact が `review-artifact.schema.json`（additionalProperties:false, 必須 task_id/reviewer/reviewed_dimensions/collection）に適合せず、契約検証する消費者に拒否される。bot 提示の選択肢のうち「**別契約の failure artifact を定義**」を採用:

- `contracts/agent-review/review-failure.schema.json` を新規定義（schema_version const "failure-1.0"、status const "failed"、source{base_sha,head_sha}、findings 最小形。additionalProperties:false）
- `contracts/agent-review/review-validator.mjs`（または適切な既存 validator ファイル）へ failure artifact 検証関数を export 追加
- `scripts/collect-agent-review.mjs` の failure 出力を新契約準拠へ（現行フィールドとの差分最小）
- `scripts/collect-agent-review.test.mjs` と `contracts/agent-review/agent-review.test.mjs` に正負テスト追加

## Validation（verbatim を validation ファイルへ）

- `node --test scripts/coding-agent-path-guard.test.mjs scripts/collect-agent-review.test.mjs contracts/agent-review/agent-review.test.mjs` 相当の focused 実行
- `node --test scripts/coding-task-manifest-wiring.test.mjs`
- `mise run ci`
- `git log -1 --format='%H %s'` / `git status --porcelain`

## allowed_files

- .github/workflows/coding-task.yml
- scripts/coding-task-manifest-wiring.test.mjs
- scripts/collect-agent-review.mjs
- scripts/collect-agent-review.test.mjs
- contracts/agent-review/review-failure.schema.json（新規）
- contracts/agent-review/review-validator.mjs / workflow-validator.mjs（validator 追加に必要な範囲）
- contracts/agent-review/agent-review.test.mjs
- .orchestration/{reports,validation,sandboxes,learning,autoskill/runs}/BOT-FIX-279*
- .agents/worklog/codex/**

## forbidden_actions

- git push / PR 操作 / 他ブランチ変更
- packages/** の変更（codingTaskManifest.ts の発行ロジック含む）
- 依存追加・lock/mise 変更・schema（agent-task/review-artifact 既存 schema）の緩和
- LLM API 呼び出し

## Expected artifacts

- report: .orchestration/reports/BOT-FIX-279-REPORT.md（cost: 行、[memory:decision]/[memory:failure]）
- validation: .orchestration/validation/BOT-FIX-279-validation.md
- sandbox: .orchestration/sandboxes/BOT-FIX-279-SANDBOX.md
- learning: .orchestration/learning/BOT-FIX-279-learning.md（attestation 残余リスクを記録）
- autoskill: .orchestration/autoskill/runs/BOT-FIX-279.md
- done_signal: AGMSG-RESULT v1
