# Plan 003: PrjOps AGT-01〜07の収集・分析・報告・配信ループを稼働させる

> **Executor instructions**: 既存pure lib/agentを再利用し、別実装を作らない。各channelの受信から正本commit、report deliveryまでを順に接続する。依存PlanがDONEでなければ開始しない。
>
> **Drift check**: `git diff --stat 21306d8..HEAD -- packages/prjops packages/server/src .github/workflows/report-generation.yml`。agent signatureやmaster schemaが変わればSTOP。

## Status

- **Priority**: P0
- **Effort**: L
- **Risk**: HIGH — 誤配信、二重処理、承認前配信の危険。
- **Depends on**: Plans 002, 005
- **Category**: direction / correctness / integration
- **Planned at**: commit `21306d8`, 2026-07-11

## Plan quality self-audit

- [x] 未配線agentと不存在workflowを測定。
- [x] channel別、状態遷移別の敵対検証を配置。
- [x] 承認前配信禁止と数値非LLMを安全回帰へ記載。
- [ ] 完了時にend-to-end trace chainを受入記録化。

## Why this matters

AGT-01〜07の個別ロジックは存在するが、実行DAG、永続job state、Outlook/GitHub入力、正本更新がない。exportされているだけのagentを、再試行可能で監査可能な1本の運用ループへ接続する。

## Current state

- `packages/prjops/src/agents/AGT01_orchestrator.ts:8-11` — scheduler/workflow未実装を明記。
- `packages/prjops/src/agents/AGT01_orchestrator.ts:42-53` — DAG順序定数のみ。
- `packages/prjops/src/agents/AGT02_collector.ts:107-172` — ingest関数はあるがproducer/正本writeなし。
- `packages/prjops/src/agents/AGT03_analyzer.ts:49-99` — 判定関数はあるが周期jobなし。
- `packages/prjops/src/agents/AGT04_reportGenerator.ts:61` — executive例のみ。
- `packages/prjops/src/agents/AGT05_distributor.ts:1` — 配信関数はあるが本体DAG未接続。
- `packages/prjops/src/agents/AGT06_tracker.ts:1` — 追跡関数のみ。
- `packages/prjops/src/agents/AGT07_verifier.ts:1` — verifier関数のみ。
- `packages/prjops/src/workflows/` — NO MATCH/ディレクトリなし。

## Commands you will need

| Purpose            | Command                                             | Expected             |
| ------------------ | --------------------------------------------------- | -------------------- |
| Package tests      | `pnpm --filter @aiops/prjops test`                  | all pass             |
| Server integration | `pnpm --filter @aiops/server test -- prjopsRuntime` | all pass             |
| Traceability       | `mise run traceability`                             | exit 0               |
| Full gate          | `mise run ci`                                       | exit 0               |
| Wiring check       | `rg -n 'ingestOne                                   | analyzeProjectStatus | generateExecutiveReport | verifyReport | deliver' packages/server/src` | production composition matches |

## Scope

**In scope**: `packages/prjops/src/agents`,必要なpure lib、`packages/server/src/scheduler/tasks/prjops*`、job state repo/schema migration、Outlook/GitHub/Teams adapters、tests、runbook。

**Out of scope**: 新LLM provider、数値/色のLLM生成、Web UI再設計、Microsoft Graph低層修正（Plan 005）、report workflow CLI（Plan 006）。

## Steps

### Step 1: 永続job state machineを追加する

- [ ] `analyze→report→verify→approval→deliver` の状態、attempt、next_run、trace IDをDBへ保存。
- [ ] compare-and-setでclaimし、複数workerの二重実行を防ぐ。
- [ ] 10分間隔、最大2 retry、3回目escalateを既存decision関数で実装。

**Verify**: Positive—成功DAGが順番にDONE。Adversarial—同jobを2 workerがclaimしても1件だけ実行、verify失敗時deliver未呼出。

### Step 2: Outlook/Teams/GitHub収集をAGT-02へ統一する

- [ ] Outlook mailbox subscription/polling、Teams normalized message、GitHub report inputを `IncomingReport` へ変換。
- [ ] sender/master照合、project解決、clarification countを永続化。
- [ ] accepted時だけ正本providerへsanitized updateをcommit/write。

**Verify**: Positive—3 channelの同等入力が同じstructured recordになる。Adversarial—unknown sender、ambiguous project、secret入り本文、4回目不足は正本へ書かれない。

### Step 3: AGT-03/04/07をreport jobへ配線する

- [ ] master snapshotからstatus/severity/metricをcode計算。
- [ ] LLMにはsanitized narrative材料だけを渡す。
- [ ] 全profile reportを生成しAGT-07検証後にapproval待ちへ遷移。

**Verify**: Positive—同snapshotで数値/色が決定的。Adversarial—LLMが未根拠数値、placeholder、2MB超、scope外rowを出すとverify失敗。

### Step 4: approvalとAGT-05配信を閉じる

- [ ] profile別recipientをrequest時に再取得。
- [ ] approval者/時刻/reasonを監査し、approved stateだけ配信。
- [ ] recipient/reportの冪等キーでOutlook/Teams二重送信を防ぐ。

**Verify**: Positive—approved reportを各recipientへ1回配信。Adversarial—unapproved/rejected/inactive/別project recipientは0回、retryも二重送信なし。

### Step 5: AGT-06追跡と運用監視を配線する

- [ ] reminder、approval timeout、delivery failure escalationをschedulerへ追加。
- [ ] queue age、job state、retry/escalation metricsを公開。
- [ ] manual recovery runbookを追加。

**Verify**: Positive—時間fixtureで予定時刻にreminder。Adversarial—process restart後もcountを失わず、重複通知しない。

## Test plan

- pure state machine boundary tests。
- DB repo transaction/claim/restart tests。
- 3-channel adapter contract tests。
- full DI integration: ingest→master→analyze→report→verify→approval→deliver。
- real sandbox smokeはPlan 008で実施。

## Done criteria

- [ ] AGT-01〜07すべてにproduction callerがある。
- [ ] 3 channel収集と正本更新がtestで閉じる。
- [ ] 承認前配信0、retry二重配信0。
- [ ] restart/並行worker testが通る。
- [ ] `mise run ci` green、trace chain証跡あり。
- [ ] README 003更新、Scope外変更なし。

## STOP conditions

- Outlook/GitHub report入力仕様が確定しない。
- approval主体/権限が仕様から決定できない。
- 正本へatomic write/commitするAPIがない。
- AGT-04の未実装profile narrative要件が確定しない。
- Plan 005のTeams/Outlook sandbox smokeが失敗。
- LLMなしfallback要件が未定。

## Maintenance notes

- schedulerは既存 `ScheduledTask` とDB claimを使い、新queue製品を導入しない。
- DAG変更時はstate transitionとtraceabilityを同時更新。
- LLM prompt変更は数値非生成のadversarial testを必須にする。

## 安全回帰

- [ ] 数値・色・表はcode算出。
- [ ] LLM入力前にsanitize。
- [ ] approval前に配信しない。
- [ ] recipient scopeは取得側で強制。
- [ ] auditはappend-only。
- [ ] retryで外部副作用を重複させない。
