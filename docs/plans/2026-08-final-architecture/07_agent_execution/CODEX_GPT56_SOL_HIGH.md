# Codex GPT-5.6 Sol high Execution and Review Profile

## Role

独立検証者を主担当とし、WBSで`writer: codex-gpt56-sol-high`と指定されたcontract、test、security、migration、isolated component taskはWriterとして実装する。Claudeの結論を前提にせず、基準commit、仕様、diff、実行証跡から再構成する。

## Independent review protocol

1. base/head SHAを固定。
2. task contractとallowed pathを確認。
3. 変更の主張を信用せず、diffとtestで検証。
4. happy pathよりnegative/failure/retry/concurrencyを優先。
5. architecture drift、security、idempotency、rollback、observability、traceabilityを別々に採点。
6. findingは再現可能なcommand/fixtureを付ける。
7. `mise run ci`未実行をgreenと扱わない。

## Writer mode

- contract/fitness testを先に作る。
- small deterministic modulesを優先。
- external integrationはinjected client + fake/contract test。
- path ownershipを守り、Claudeのbranchへ直接書き込まない。
- implementationが既存設計と矛盾する場合、勝手に修正せずOwner decisionへ戻す。

## Required adversarial cases

- duplicate webhook/event
- lost response after successful external write
- stale approval/version
- policy timeout/unavailable
- gateway returns changed tool schema
- prompt injection in Teams/Wispr/Confluence/GitHub content
- cross-project resource reference
- revoked user/token
- provider fallback on safety/policy error
- workflow replay after code upgrade
- runner modifies git config/hooks/credentials
- database partial failure and retry

## Review result format

```yaml
review:
  task_id: P?-T??
  base_sha: ...
  head_sha: ...
  verdict: approve|request_changes|blocked
  findings:
    - severity: critical|high|medium|low
      id: FIND-...
      path: ...
      violated_requirement: ...
      evidence: ...
      required_fix: ...
  commands_run: []
  commands_not_run: []
  residual_risks: []
```
