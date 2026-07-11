# Plan 004: DevOps agentをGitHub・監視イベントと状態台帳へ実配線する

> **Executor instructions**: audit-only handlerを実agent呼出しへ置換する。自動deploy/rollback/close/permission変更は既存approval/failsafe制約を迂回しない。依存plan未完了なら開始しない。
>
> **Drift check**: `git diff --stat 21306d8..HEAD -- packages/devops packages/server/src .github/workflows packages/devops/src/workflows`。event/state schema差異はSTOP。

## Status

- **Priority**: P0
- **Effort**: L
- **Risk**: HIGH — production deploy・権限・incidentへの副作用。
- **Depends on**: Plans 001, 005
- **Category**: correctness / integration / security
- **Planned at**: commit `21306d8`, 2026-07-11

## Plan quality self-audit

- [x] audit-only handlers、missing script、echo deployを測定。
- [x] 主要副作用ごとにnegative/adversarial gateを記載。
- [x] state machine、failsafe、human approvalを安全回帰へ固定。
- [ ] 完了時にsandbox GitHub/monitor end-to-end証跡を保存。

## Why this matters

現在はWebhookを受けてもAGT-BLD/DEP/INCが監査記録するだけで、deployments/incidentsを更新せず、AGT-CHG/RPT/SECも実イベントへ未接続である。監査可能な状態機械とhuman gateを維持したまま、7 agentを実際の運用経路へ接続する。

## Current state

- `packages/server/src/index.ts:194-226` — 3 handlerがaudit appendだけ。
- `packages/server/src/lib/githubEventRouter.ts:187-195` — BLD/DEP/INC選択のみ。
- `packages/devops/src/db/schema.sql:88-123` — deployments/incidents表はあるがserver writer repoなし。
- `packages/devops/src/workflows/deploy-prod.yml:27-40` — echoだけのdeploy。
- `packages/devops/src/workflows/on-workflow-failure-triage.yml:18-23` — 不存在scriptを実行。
- `packages/devops/scripts/jobs/README.md:7-9` — scriptsは「想定」のみ。
- `packages/server/src/index.ts:308-317` — monitor eventもaudit-only。
- `packages/server/src/scheduler/tasks/jitRevocationTask.ts:1` — SECの失効だけはproduction配線済み。

## Commands you will need

| Purpose            | Command                                                                      | Expected |
| ------------------ | ---------------------------------------------------------------------------- | -------- |
| DevOps tests       | `pnpm --filter @aiops/devops test`                                           | all pass |
| Server integration | `pnpm --filter @aiops/server test -- githubEvent devopsRuntime scheduler`    | all pass |
| Workflow syntax    | `npx actionlint .github/workflows/*.yml packages/devops/src/workflows/*.yml` | exit 0   |
| Full gate          | `mise run ci`                                                                | exit 0   |

## Scope

**In scope**: DevOps agent orchestration、deployments/incidents/grants/report repo、GitHub/monitor adapters、実workflow/scripts、scheduler、tests/runbooks。

**Out of scope**: 対象project固有deploy commandの発明、automatic merge、承認省略、monitor vendor新規選定、Graph client低層（Plan 005）。

## Steps

### Step 1: eventsと状態repoをcontract化する

- [ ] GitHub/monitor payloadをagent別typed inputへvalidateする。
- [ ] deployments/incidents/reportsのrepoをtransaction/CAS付きで追加する。
- [ ] raw payload保存前sanitizeとsource/delivery idempotencyを共通化する。

**Verify**: Positive—valid push/workflow/deploy/issue/alertを正規化。Adversarial—欠落field、未知repo、secret、重複deliveryは副作用0。

### Step 2: AGT-BLD/INCを実配線する

- [ ] workflow failureのlog取得→分類→read-only修正案→PR comment/escalationを実装。
- [ ] alert→severity候補→incident INSERT→GitHub Issue/Teams通知を実装。
- [ ] false-positiveは候補化のみで人間確認なしにcloseしない。

**Verify**: Positive—sandbox failure/alertで台帳と通知が一致。Adversarial—prompt injection log、unknown alert、LLM errorで自動close/commitしない。

### Step 3: AGT-DEP/CHGを状態機械へ配線する

- [ ] risk score/threshold/approvalからdeploy stateを遷移。
- [ ] project repoが提供する明示deploy interfaceをworkflowから呼ぶ。未設定はfail closed。
- [ ] monitoring windowとrollback targetを台帳化し、TH-003条件だけrollback。
- [ ] CHG notificationをapproved scheduleから生成。

**Verify**: Positive—sandbox deploy成功→monitoring→stable。Adversarial—未承認、高risk、failsafe、invalid target、monitor欠測ではprod deployしない。

### Step 4: AGT-SEC/RPT/ORCHを閉じる

- [ ] grant/revoke台帳とGitHub実permissionを照合し、expiry/reconciliationを記録。
- [ ] report snapshotをDB実データから生成。
- [ ] ORCH health対象へGraph/GitHub/LLM/queue/agent heartbeatを加え、failsafe通知を実装。

**Verify**: Positive—expired grantだけrevoke、DORA/incident reportが実rowと一致。Adversarial—API failure時にgrant付与・deploy・closeを停止し通知だけ許可。

### Step 5: workflowとrestart/parallel統合を検証する

- [ ] missing scriptsを実装し、workflowをSHA pinする。
- [ ] process restart、redelivery、two workersを実DBで検証。
- [ ] manual recovery/rollback runbookを更新。

**Verify**: Positive—全7 agentにproduction callerとtrace chain。Adversarial—二重webhook/workerでdeploy・Issue・commentが1回だけ。

## Test plan

- payload schema/repo/state-machine unit tests。
- DI integration for BLD/DEP/INC/CHG/RPT/SEC/ORCH。
- actionlint、sandbox GitHub Actions workflow_dispatch。
- monitor replay、API 429/5xx、restart、failsafe adversarial tests。

## Done criteria

- [ ] 7 agentにproduction callerがありaudit-only placeholderがない。
- [ ] deployments/incidents/report snapshotsが実イベントで更新される。
- [ ] deploy/rollback/close/grantのnegative gatesが通る。
- [ ] missing script/echo deployがない。
- [ ] actionlint、focused tests、`mise run ci` green。
- [ ] sandbox trace証跡、README 004更新。

## STOP conditions

- project固有deploy interface/rollback contractが未定。
- monitor sourceと署名方式が未定。
- GitHub App permissionが必要最小権限で構成できない。
- production environment reviewer/gateが未設定。
- incident severity source of truthが競合。
- Plan 005送信smokeが未完了。

## Maintenance notes

- agent選択は既存router、判定はlib、外部副作用はagent/repoに維持。
- project固有deployはallowlisted command/action参照のみ。
- 新event追加はschema、idempotency、replay testを同時追加。

## 安全回帰

- [ ] mainへ直接push/自動mergeしない。
- [ ] deploy/rollback/close/grantはhuman/failsafe gateを通る。
- [ ] raw input保存・LLM投入・出力前にsanitize。
- [ ] audit append-only。
- [ ] 数値/thresholdはcode算出。
- [ ] retry/redeliveryで副作用を重複させない。
