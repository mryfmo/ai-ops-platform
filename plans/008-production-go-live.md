# Plan 008: supported runtime・CI・HA・監視・実環境E2Eでgo-live判定を閉じる

> **Executor instructions**: Plans 001–007がDONEでなければ開始しない。本planはproduction変更を自動承認しない。sandbox/stagingの証跡を揃え、人間のgo/no-go署名までを成果物とする。
>
> **Drift check**: `git diff --stat 21306d8..HEAD -- .mise.toml package.json pnpm-lock.yaml packages/*/package.json packages/server/Dockerfile .github/workflows verification runbooks docs`。依存plan未DONEまたは未review diffがあればSTOP。

## Status

- **Priority**: P0
- **Effort**: XL
- **Risk**: HIGH — runtime migration、deployment、external tenant/repository、go-live判断。
- **Depends on**: Plans 001–007 all DONE
- **Category**: migration / security / tests / operations / docs
- **Planned at**: commit `21306d8`, 2026-07-11

## Plan quality self-audit

- [x] Node EOL、CI差異、coverage欠落、Docker/HA/IaC/監視/E2E不足を測定。
- [x] phase gateとgo/no-go checklistを明示。
- [x] backup restore、failover、secret rotation、external smokeの敵対検証を配置。
- [ ] DONE時にacceptance recordと人間署名を保存。

## Why this matters

`mise run ci` はgreenでも、Node 20はEOL、GitHub CIはローカルDoDと不一致、Web coverageは実行されず、composition rootは0%、実PostgreSQL/M365/GitHub/agent E2Eは未実施である。コード完成ではなく、supported runtime、再現可能なdeployment、復旧、監視、実外部連携までを1つのgo-live gateとして閉じる。

go-liveは「テスト件数」では判定せず、要求ごとの実経路、negative test、運用者、rollback、証跡が揃ったかで判定する。

## Current state

- `.mise.toml:1-3` — Node 20/pnpm 9固定。
- `packages/server/Dockerfile:8-25` — Node 20、repo全体copy、runtimeとbuild未最小化。
- `.github/workflows/ci.yml:15-27` — lint/format/audit/workflow/Docker/DB integrationなし。
- `.mise.toml:41-43` — ローカルciはgovernance/lint/traceability/format/build/typecheck/coverage。
- `packages/web/package.json:7-14` — `test:coverage` scriptなし。
- `packages/server/vitest.config.ts:1-6` — explicit source include/thresholdなし。
- `packages/server/src/index.ts:143-525` — composition root coverage 0%、schedulerはprocess-local。
- `packages/server/src/http/routes/metrics.ts:9-11` — metrics無認証、scrape/alert配備なし。
- `verification/VERIFICATION_REPORT.md:22-49` — real environment項目未実施。
- `verification/VERIFICATION_REPORT.md:72-115` と`:224` — 359/750件が混在、現実測885件と不一致。
- repo root — Kubernetes/Helm/Terraform/Bicep/Compose production定義なし。
- `pnpm audit --prod` 実測 — moderate 3、low 1。

## Commands you will need

| Purpose        | Command                                                               | Expected                    |
| -------------- | --------------------------------------------------------------------- | --------------------------- |
| Runtime        | `node --version && pnpm --version`                                    | approved supported versions |
| Audit          | `pnpm audit --prod --audit-level high`                                | exit 0; no high/critical    |
| Full local     | `mise run ci`                                                         | exit 0                      |
| Workflow lint  | `npx actionlint .github/workflows/*.yml .github/actions/*/action.yml` | exit 0                      |
| Container      | `docker build -f packages/server/Dockerfile -t aiops:test .`          | exit 0                      |
| DB integration | `bash verification/run_db_integration.sh`                             | exit 0                      |
| E2E            | `bash verification/run_real_environment_e2e.sh --environment staging` | all required gates PASS     |
| Diff           | `git diff --check && git status --short`                              | expected files only         |

## Scope

**In scope**

- Node/pnpm/dependency upgrades and lockfile。
- CI parity、audit、coverage thresholds、actionlint、Docker/DB integration。
- production-grade container、IaC/deployment manifests、secret references、health probes。
- HA scheduler leader/lease、shared failsafe、zero/one execution tests。
- Prometheus scrape/alerts/dashboard、logs/traces correlation、on-call runbooks。
- backup/PITR/restore、secret/token rotation、DR/failover tests。
- staging real-environment E2E harness/evidence、verification docs、go-live checklist。

**Out of scope**

- production credentials/secret valuesのcommit。
- human approvalなしのproduction deployment。
- 新cloud/providerの選定。組織が選定済みplatformを使う。
- automatic merge、branch protection緩和。
- auditで未要求の新product feature。

## Steps

### Step 1: supported runtimeとdependency baselineへ移行する

- [ ] Node 24 LTS等、実施時点のsupported LTSを公式scheduleで確認し `.mise.toml`、Docker、Actions、enginesを統一。
- [ ] dependenciesを段階更新し、Next/Auth/AI SDK/Anthropic/pg/Honoのmigration notesを確認。
- [ ] `pnpm audit --prod` の各advisoryをapplicable/non-applicable/accepted riskで記録。

**Verify**

- Positive: supported runtimeでbuild/typecheck/test/container成功。
- Adversarial: Node 20でCI matrixを意図的に実行した場合、supported-runtime gateが失敗する。
- Positive: high/critical 0。
- Adversarial: known vulnerable fixture lockfileをvalidatorへ渡すと非0。

### Step 2: GitHub CIを唯一のDoDと一致させる

- [ ] `mise run ci` とworkflowの順序/commandを共通scriptへ寄せる。
- [ ] web `test:coverage`、全package source include、risk-based thresholdを設定。
- [ ] composition root、Graph token、BLD/INC/CHG、report CLIをintegrationで実行。
- [ ] actionlint、dependency audit、Docker build、fresh/upgrade DB、gitleaksをrequired checksへ追加。

**Verify**

- Positive: local/Actionsが同command set、全required green。
- Adversarial: lint/format error、0% critical file、invalid workflow、Docker Web build failure、invalid schemaの各fixtureで対応checkがred。

### Step 3: production deployment/IaCを作る

- [ ] 選定済みplatform用にservice、DB接続、TLS、private network、secret store参照、resource limit、probes、rollout/rollbackを宣言。
- [ ] immutable image digestとSBOM/provenanceを生成・署名。
- [ ] DB migration jobをapp rollout前の明示gateにする。
- [ ] staging/prod config差をsecret値なしで文書化。

**Verify**

- Positive: clean stagingへIaC apply→migration→rollout→ready。
- Adversarial: secret欠落、migration失敗、Web build欠落、readiness failureでrollout停止/rollbackしtrafficを流さない。

### Step 4: HA schedulerと共有failsafeを実装する

- [ ] DB advisory lease/leader election等、既存PostgreSQLで各task 1 active runnerを保証。
- [ ] failsafe state/failure countをDBへ保存しreplica間共有。
- [ ] leader death後のlease recovery、clock drift、long-running taskを処理。

**Verify**

- Positive: 3 replicasでtask side effect 1回、leader kill後に次replicaが引継ぐ。
- Adversarial: network partition/DB loss時はdeploy/close/grantを停止しrevoke/notify policyだけ維持。

### Step 5: observabilityとSLO alertを配備する

- [ ] `/metrics` をmonitor network/authへ限定。
- [ ] queue age/depth/dead、task failure/duration、delivery、DB pool、Graph renew、agent cost/error、failsafeをscrape。
- [ ] SLO/alert thresholds、severity、owner、runbook URL、paging先をcode化。
- [ ] trace IDをHTTP→queue→agent→external API→auditへ伝播。

**Verify**

- Positive: synthetic failureごとにexpected alertとrunbook link。
- Adversarial: public internetからmetrics拒否、secret/PII labelなし、alert stormはdedupe/silence規則で制御。

### Step 6: backup/restore/DRとrotationを検証する

- [ ] DB backup/PITR、audit partition、object/artifact retentionを定義。
- [ ] clean instanceへのrestore rehearsalを実行しRPO/RTOを測定。
- [ ] Graph/GitHub/Anthropic/Factory/Auth/HMAC secretを無停止または明示maintenanceでrotation。
- [ ] revoke旧credentialを確認。

**Verify**

- Positive: restore後のrow counts/checksums/critical flows一致、RPO/RTO内。
- Adversarial: corrupted backup、old token、partial rotation、region/service outageでrunbookどおりfail closed/rollback。

### Step 7: 実環境E2E harnessを実行する

- [ ] E2Eはsandbox/staging resourcesを自動作成または明示fixture IDで実行し、finally cleanup。
- [ ] Excel import→GitHub records、Teams/Outlook intake、PrjOps report、DevOps failure/deploy/incident、Claude/Droid draft PR、Web Entra personaを通す。
- [ ] positiveだけでなくsignature不一致、scope外、inactive、duplicate、429/5xx、LLM invalid、process restartを含める。
- [ ] raw logs、run URLs、artifact digests、DB queries、screenshotsをredacted evidence manifestへ保存。

**Verify**

- Positive: 以下Test planの全シナリオPASS。
- Adversarial: 1シナリオのoracleを故意に反転するとharness全体がnon-zeroになり、空虚なtestでない。

### Step 8: 文書を現実へ同期しgo/no-go判定する

- [ ] README/verification/config/http/runbooksを実command・件数・未検証範囲へ更新。
- [ ] traceabilityはID出現だけでなくcritical requirementのtest/evidence linkを検証。
- [ ] open risk、owner、期限、rollback、support modelを一覧化。
- [ ] CODEOWNERS/security/operations/product ownerの署名を取得し、署名なしはNO-GO。

**Verify**

- Positive: evidence manifestの全link/digestが存在し再検証可能。
- Adversarial: stale test count、missing evidence、未署名、P0/P1 open riskがあればgo-live validatorがNO-GO。

## Test plan

### A. Database and audit

- [ ] fresh schema、upgrade、second-run idempotency。
- [ ] audit append/select、role UPDATE/DELETE拒否、partition boundary/retention。
- [ ] backup→clean restore→checksum照合。

### B. Microsoft 365

- [ ] RSC install/consent、subscription validation/renew/lifecycle/delta。
- [ ] Teams created/updated/deleted/reply/card。
- [ ] Outlook sendMailとmail intake、mailbox allowlist。
- [ ] clientState/signature/tenant/scope negative cases。

### C. GitHub and agents

- [ ] App installation token生成/expiry/refresh、webhook delivery dedupe。
- [ ] BLD/DEP/INC/CHG/RPT/SEC/ORCH実event。
- [ ] failsafe、approval、rollback、false-positive human gate。
- [ ] Claude/Droid isolated patch→draft PR、no token exposure。

### D. PrjOps/report/Web

- [ ] Teams/Outlook/GitHub intake→master→AGT-03/04/07→approval→delivery。
- [ ] PRF-01〜05/investor/PRF-M/L/G認可matrix。
- [ ] metric source row→report value→audit evidence trace。
- [ ] Entra login、persona switch、scope denial、accessibility smoke。

### E. Excel/API/performance

- [ ] Excel dry-run/execute/retry/concurrency/crash/oversize/zip bomb。
- [ ] 413/415/429、security headers、proxy timeout。
- [ ] load: 100 projects/50 concurrent users、Pool max、queue latency。
- [ ] 3-replica scheduler single-execution/failover。

## Done criteria

- [ ] Plans 001–007が全てDONEでacceptance evidenceあり。
- [ ] supported Node LTSで全build/test/containerが成功。
- [ ] local/Actions DoDが一致し、required checksがgreen。
- [ ] high/critical production dependency vulnerability 0。
- [ ] coverageがcritical production compositionを実行しthresholdを満たす。
- [ ] staging IaC apply/rollback、migration、TLS、secret references成功。
- [ ] 3-replica single execution/failover/failsafe共有test成功。
- [ ] metrics/alerts/on-call runbook/synthetic paging成功。
- [ ] backup restoreとcredential rotation rehearsal成功、RPO/RTO内。
- [ ] A〜Eの全E2E scenarioがPASSしraw evidenceがある。
- [ ] verification docsの件数/日付/未検証範囲が現実と一致。
- [ ] P0/P1 open blocker 0。
- [ ] human ownersがgo-live checklistへ署名。
- [ ] `mise run ci`、actionlint、audit、Docker、DB integration、E2Eが全green。
- [ ] `plans/README.md` の008が更新される。

## STOP conditions

- Plans 001–007のいずれかが未DONE/BLOCKED。
- supported runtimeへのupgradeでproduction dependencyが非対応。
- stagingがproduction topology/permissionを代表しない。
- backup restoreまたはsecret rotationを実施できない。
- RPO/RTO/SLO/traffic capacityがowner未承認。
- sandbox tenant/repository/provider keyがない。
- real E2Eがmock/stubへ置換されている。
- P0/P1 defect、data leakage、duplicate side effect、approval bypassが1件でも残る。
- branch protection/CODEOWNERS/required checksを確認できない。
- Crit/security/operations review evidenceが不足。

## Maintenance notes

- quarterlyにruntime support、dependency audit、Graph lifetime/permission、CLI action versionを再確認する。
- monthlyにrestore sample、subscription renewal、alert routing、partition future coverageを自動確認する。
- E2E resourcesはsandbox専用prefix/labelsでcleanup可能にする。
- verification reportは生成可能なfactsと人間記述のriskを分離する。
- reviewerはgreen countよりoracle、negative case、raw evidenceを優先する。

## 安全回帰

- [ ] production secret値をrepo/evidenceへ保存しない。
- [ ] human approvalなしにmerge/deploy/production writeしない。
- [ ] permission scopeを取得側/平台側で強制する。
- [ ] audit append-only、retention区分を維持する。
- [ ] LLMに数値・色・thresholdを生成させない。
- [ ] agentへpush/deploy credentialを渡さない。
- [ ] retry/failoverで外部副作用を重複させない。
- [ ] trust boundaryのvalidation/rate/body limitを維持する。
