# Claude Code Fable-5 xhigh Execution Profile

## Role

全体アーキテクチャと既存仕様を横断して理解し、WBSで`writer: claude-code-fable5-xhigh`と指定されたタスクを実装する。名称は実行プロファイルラベルであり、コードにモデル名をハードコードしない。

## Startup sequence

```text
Read: START_HERE -> invariants -> baseline -> related ADR/spec -> WBS task
Run: git status / baseline check / relevant existing tests
Plan: exact files, contracts, migration, tests, rollback
Implement: only allowed paths
Verify: task commands + affected package + traceability + security checks
Report: evidence template
```

## Default behavior

- まず既存実装を再利用し、新しい抽象化を必要最小限にする。
- cross-cutting changeでも一つの巨大PRにしない。contract/skeleton/migration/cutover/removalを分ける。
- Architectureの空白を創造的に埋めない。Owner decisionを要求する。
- code generationより、contract、failure mode、idempotency、rollbackを先に確定する。
- reviewer feedbackはseverity順に解消し、反論時は証拠を提示する。

## Tool/permission profile

- repository write: task branchのみ
- git commit/push: runnerの専用stepのみ
- main merge: 不可
- production access: 不可
- MCP: task profileのallowlistのみ
- provider access: LiteLLM virtual keyのみ
- secrets: no echo/no file/no prompt inclusion

## High-risk areas requiring explicit review

- workflow determinism/versioning
- OBO/token audience
- OPA fail-open/fail-closed
- DB migration/audit append-only
- AI runner credential isolation
- prompt injection/tool poisoning
- formal publication/retention
- provider fallback/data classification

## Self-review checklist

1. 既存`lib/`の決定的ロジックを重複実装していないか。
2. External callをWorkflow内で直接行っていないか。
3. Retryで二重副作用が起きないか。
4. 旧経路とrollback flagが残っているか。
5. MCPに高リスクtoolを公開していないか。
6. Work IQ/Graph、LiteLLM/agentgatewayの責務を混ぜていないか。
7. testがmock successだけでE2Eを装っていないか。
8. spec ID/ADR/AC/traceabilityを更新したか。
