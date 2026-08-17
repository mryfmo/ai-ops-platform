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

## CI implementation record（P8-T04）

- `@anthropic-ai/claude-code-linux-x64@2.1.222`をSHA-256
  `6680125b6f3baab47c84797cbeb3196e343c61bb4679cae15d138041a325c1ff`で検証してから実行する。
- `claude-code-fable5-xhigh`は監査用の固定プロファイルラベルであり、provider/model routingはLiteLLM側の責務とする。
- actionの固定上限はruntime 1,800秒、cost 25 USD、task budget 200,000 tokens、agentic turns 500。
  callerは値を下げられるが上げられず、gateway側の独立制限も維持する。
- `agent/*` branch gate、built-in tool allowlist、network/deploy/git mutation deny、safe modeをaction内で強制する。
- 実行結果はprofile、commands、tests、changed paths、dependency changes、security findings、未解決事項を含む
  strict JSON schemaで返す。

このaction単体が保証するのは上記の固定プロファイルだけである。P8-T01 manifestによるtask固有path/budget、
P8-T02 path guardのrunner結線、evidence永続化とraw parallel tool-call計数はP8-T08/P8-T09で扱う。
staging E2EおよびOSレベルのegress隔離は本変更では主張しない。
