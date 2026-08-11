# Production Remediation Phases

- Planned at: `21306d8`
- Workplan: `.orchestration/plan/remediation_workplan.md`
- Rule: a phase may start only after every repository-gate checkbox in the prior phase is checked by a reviewer. Executors cannot waive gates.
- Real-environment rule: each phase may finish repository implementation while its real-env rows remain OPEN, but no task may be marked `受入済` and no go-live may occur until GATE-5/PRG-031 accepts those rows. Mock/dev evidence cannot close a real-env row.
- Severity rule: unresolved CRITICAL/HIGH has no exception before GATE-5. MED exceptions require owner, reason, compensating control, and expiry.

## GATE-0: Decision Baseline and Self-Contained Critical Foundation

- Tasks: TASK-PRG001, TASK-PRG003, TASK-PRG023, TASK-PRG024, TASK-PRG025, TASK-SPC001, TASK-SPC002, TASK-SPC003, TASK-SPC005, TASK-SPC006, TASK-SPC007, TASK-SPC008, TASK-SPC013, TASK-SPC014, TASK-SPC015, TASK-SPC016, TASK-SPC017, TASK-SPC018, TASK-SPC019, TASK-SPC020, TASK-SPC021, TASK-SPC022, TASK-SPC023, TASK-SPC024, TASK-SPC025, TASK-SPC026
- Gate owner obligation: the accountable human owner for the final TASK-PRG031 go-live decision must be named in this gate; TASK-PRG031 itself remains in GATE-5.
- Start prerequisite: T30-V1 and T32 accepted. TASK-PRG001/003 may start after the owner accepts PostgreSQL 16 and Azure Container Apps. All canonical/specification tasks may start only when both `.orchestration/audit/specification_content_audit.md` and `.orchestration/audit/spec_reconstruction.md` are non-empty reviewer-approved inputs. A Specification Owner and the TASK-PRG031 accountable owner must be named; workers cannot fill either role.
- Why first: this follows the audit's decision-baseline dependency order. TASK-PRG001/003 are self-contained CRITICAL foundations. TASK-SPC001〜003/005〜008 establish catalog ownership, source provenance, gaps, exact trace, dead IDs, and testability before TASK-PRG023/024. TASK-SPC013〜021 fix normative policies and NFRs before TASK-PRG025. Root-cause specifications TASK-SPC022〜026 must be accepted before their implementation tasks TASK-PRG041/042/044/047/048.
- Explicit exception resolution: TASK-PRG002/004 are CRITICAL but are intentionally not in GATE-0. Their cited requirement definitions do not exist in the current repository, so starting them before TASK-PRG023/T32 owner approval would require inventing requirements.

### verified-integration gate

- [ ] PG16 applies fresh schema/migrations and accepts audit inserts (TASK-PRG001).
- [ ] Deploy workflow lint/dry-run proves digest promotion, health decision, and rollback path (TASK-PRG003).
- [ ] T32 is accepted and its content-audit/reconstruction outputs are version-pinned as direct inputs to TASK-PRG023/024/025.
- [ ] Canonical corpus accounts for all 295 IDs: catalog definition lines 32, indexed definitions 31, and 264 undefined (89.5%); rejected or unreconstructable text keeps the gate OPEN (TASK-PRG023).
- [ ] PrjOps REQ gaps 8 (022〜029), DevOps REQ gaps 17 (004〜009, 013, 014, 032〜040), total REQ gaps 25, and orphan DevOps `REQ-032` each have owner disposition; the AGENTS.md ADR-0014 omission is resolved (TASK-SPC001/003, TASK-PRG023).
- [ ] Canonical source ledger, exact namespaced mapping, unindexed acceptance criteria, 64 dead IDs, and 36 testless criteria have explicit owner decisions and machine-failing fixtures (TASK-SPC002/005〜008, TASK-PRG023/024).
- [ ] Retention/deletion, threshold versions, scheduler deadline, thinking budget, notification latency, capacity, cost reservation, and metric provenance have owner-approved normative contracts (TASK-SPC013〜021, TASK-PRG025).
- [ ] Scheduler ownership, holiday horizon, report slot provenance, delivery claim/lease, and immutable Teams actor identity contracts are approved before implementation (TASK-SPC022〜026).
- [ ] Semantic mapping and NFR schema gates pass against the accepted T32 inputs (TASK-PRG024/025).
- [ ] Specification Owner and TASK-PRG031 accountable human owner are recorded; neither role is self-assigned by an executor.
- [ ] `mise run ci` exits 0 and evidence exists under every GATE-0 task evidence directory.

### requires-real-env ledger

- [ ] PG16 staging migration/month-boundary evidence OPEN until PRG-031.
- [ ] ACA canary/rollback evidence OPEN until PRG-031.
- [ ] Requirement original/reconstruction, gap/dead-ID disposition, root-spec owner approval, and NFR business approval OPEN until PRG-031.

## GATE-1: Definition-Backed Critical Behavior and Privacy Baseline

- Tasks: TASK-PRG002, TASK-PRG004, TASK-PRG043, TASK-SPC004, TASK-SPC009, TASK-SPC010, TASK-SPC011, TASK-SPC012
- Start prerequisite: GATE-0 repository gate accepted. DevOps `SPEC-INT-011 / SPEC-INT-020 / SPEC-INT-030` and PrjOps `REQ-002 / REQ-040 / SPEC-INT-067` each have owner-approved definitions in the canonical corpus. Any missing definition blocks TASK-PRG002/004; existing implementation is not a substitute. ADR indexing and data-model/migration semantics cannot be finalized until their GATE-0 source and ownership decisions are accepted.

### verified-integration gate

- [ ] Composition tests prove BLD/DEP/INC agent side effects and retry behavior against the approved definitions (TASK-PRG002).
- [ ] Production-mode PrjOps provider/runtime composition rejects fixtures and produces the owner-approved behavior (TASK-PRG004).
- [ ] PII lifecycle tests cover lookup/correction/erasure/hold without modifying audit history.
- [ ] ADR catalog/AGENTS index equality and data-model/migration definitions for NULL vs 0, confidence/probability, delivery status, and role defaults pass exact schema fixtures (TASK-SPC004/009〜012).
- [ ] `mise run ci` exits 0.

### requires-real-env ledger

- [ ] Staging GitHub webhook agent effects OPEN until PRG-031.
- [ ] Private prjops-data scheduled refresh evidence OPEN until PRG-031.
- [ ] Privacy/legal policy, ADR owner review, migration compatibility, and subject-request drill OPEN until PRG-031.

## GATE-2: Data, Hosting, and Security Foundation

- Tasks: TASK-PRG005, TASK-PRG009, TASK-PRG010, TASK-PRG011, TASK-PRG012, TASK-PRG016, TASK-PRG017, TASK-PRG018, TASK-PRG026, TASK-PRG030, TASK-PRG034, TASK-PRG036, TASK-PRG044, TASK-PRG045, TASK-PRG048, TASK-PRG050
- Start prerequisite: GATE-1 repository gate accepted.

### verified-integration gate

- [ ] PG role denial, fresh/upgrade schema, partitions, backup runbook checks, and retention lifecycle tests pass.
- [ ] First-write sanitation, request limits, GitHub App provider, secret/config drift, and immutable action pin gates pass.
- [ ] Azure IaC validates; private metrics and alert rules/receivers pass.
- [ ] Immutable Teams actor propagation, production stakeholder authorization, cross-project report negative tests, and malicious HTML sink tests pass in that order.
- [ ] `mise run ci` exits 0.

### requires-real-env ledger

- [ ] Role denial, PITR restore, Azure deploy/network, Key Vault rotation, alert delivery, private scrape, partition rollover, tenant isolation, stakeholder authorization, and AAD attribution evidence OPEN until PRG-031.

## GATE-3: Product Runtime and Reliability

- Tasks: TASK-PRG006, TASK-PRG007, TASK-PRG008, TASK-PRG013, TASK-PRG014, TASK-PRG015, TASK-PRG035, TASK-PRG039, TASK-PRG040, TASK-PRG041, TASK-PRG042, TASK-PRG046, TASK-PRG047
- Start prerequisite: GATE-2 repository gate accepted.

### verified-integration gate

- [ ] Installed agent CLI smoke, production metric sourcing, and durable failsafe tests pass.
- [ ] Singleton Web pool, coding-task outbox/callback, DLQ operations, DORA delta, and failure-triage entrypoint tests pass.
- [ ] Ticket/incident contract, replica scheduler lease, holiday horizon, bounded retention, and 50-way delivery claim tests pass.
- [ ] `mise run ci` exits 0; Web tests run explicitly until TASK-PRG033 lands.

### requires-real-env ledger

- [ ] Hosted CLI, report ingest, dependency failure/restart, pool load, coding workflow recovery, DLQ replay, DORA data, failed-workflow triage, scheduler replicas, retention dry-run, and duplicate-delivery evidence OPEN until PRG-031.

## GATE-4: Operator Surface and Hosted Verification

- Tasks: TASK-PRG019, TASK-PRG020, TASK-PRG021, TASK-PRG022, TASK-PRG027, TASK-PRG032, TASK-PRG033, TASK-PRG037, TASK-PRG038, TASK-PRG049
- Start prerequisite: GATE-3 repository gate accepted.

### verified-integration gate

- [ ] Teams package/schema/icons/routes and XLSX/manual-ops docs executable checks pass.
- [ ] Container/composition/workflow CI, all Web tests+coverage, dependency/SBOM policy, and canonical CI parity pass.
- [ ] Verification report is generated from the same commit's CI artifacts.
- [ ] Provision/deprovision CLI is idempotent and audited.
- [ ] TASK-PRG027のDocker build/start CI上でnon-root・最小内容・read-only-rootfs image assertionsがpassする（TASK-PRG049）。
- [ ] `mise run ci` exits 0 and hosted CI is green.

### requires-real-env ledger

- [ ] Teams install, XLSX/manual drill, production image startup/read-only-rootfs, provisioning lifecycle, and hosted CI URLs OPEN until PRG-031.

## GATE-5: Real-Environment Proof and Go-Live Decision

- Tasks: TASK-PRG028, TASK-PRG029, TASK-PRG031
- Start prerequisite: GATE-4 repository gate accepted and every earlier real-env ledger row has an owner/environment/date.

### verified-integration gate

- [ ] E2E and load evidence schemas validate with no missing/duplicate task references.
- [ ] Small CI load smoke and go-live ledger link/expiry validators pass.
- [ ] `mise run ci` exits 0.

### requires-real-env final gate

- [ ] Full authenticated PostgreSQL/GitHub/Teams/Graph/Anthropic staging E2E passes, including negative tenant/auth/replay cases.
- [ ] 50-project steady, 100-project design, burst, soak, DB exhaustion, dependency failure, and shutdown workloads meet TASK-PRG025.
- [ ] Every PRG-001..050 and SPC-001..026 row has redacted evidence, owner, environment, date, and approver.
- [ ] CRITICAL open count = 0 and HIGH open count = 0.
- [ ] Every MED item is closed or has an approved compensating control and non-expired exception.
- [ ] Accountable human reviewers sign the go-live decision; agents do not self-approve.

## Coverage and Order Check

| Phase | TASK count | IDs |
| --- | ---: | --- |
| GATE-0 | 26 | PRG 001, 003, 023-025; SPC 001-003, 005-008, 013-026 |
| GATE-1 | 8 | PRG 002, 004, 043; SPC 004, 009-012 |
| GATE-2 | 16 | 005, 009-012, 016-018, 026, 030, 034, 036, 044-045, 048, 050 |
| GATE-3 | 13 | 006-008, 013-015, 035, 039-042, 046-047 |
| GATE-4 | 10 | 019-022, 027, 032-033, 037-038, 049 |
| GATE-5 | 3 | 028-029, 031 |
| **Total** | **76** | **TASK-PRG001..TASK-PRG050 + TASK-SPC001..TASK-SPC026 exactly once** |

## Plan quality self-audit

- [ ] No next phase starts before the prior repository gate is reviewer-accepted.
- [ ] Real-env evidence remains OPEN and cannot be substituted by mocks.
- [ ] Self-contained CRITICAL PRG-001/003 and the PRG-023/024/025 decision baseline are the first gate; CRITICAL PRG-002/004 are immediately next and cannot start before their cited definitions are owner-approved.
- [ ] All 76 tasks appear exactly once across phases; all 26 SPC tasks are in GATE-0 or GATE-1.
- [ ] TASK-SPC022/023/024/025/026 are accepted before TASK-PRG041/042/044/047/048 respectively; reverse prerequisites are absent.
- [ ] Final go-live authority is human and PRG-031 contains every evidence link.

## Deterministic Topological Order

Dependency edges are interpreted as `task -> blocked-by prerequisite`. Tasks in the same
gate execute in the order below; the next gate still requires reviewer acceptance of the
prior gate. This order is regenerated and compared verbatim by `T33-validate.mjs`.

- GATE-0: TASK-PRG001 -> TASK-PRG003 -> TASK-SPC001 -> TASK-SPC002 -> TASK-SPC003 -> TASK-SPC005 -> TASK-SPC006 -> TASK-SPC007 -> TASK-PRG023 -> TASK-SPC008 -> TASK-PRG024 -> TASK-SPC013 -> TASK-SPC014 -> TASK-SPC015 -> TASK-SPC016 -> TASK-SPC017 -> TASK-SPC018 -> TASK-SPC019 -> TASK-SPC020 -> TASK-SPC021 -> TASK-PRG025 -> TASK-SPC022 -> TASK-SPC023 -> TASK-SPC024 -> TASK-SPC025 -> TASK-SPC026
- GATE-1: TASK-PRG002 -> TASK-PRG004 -> TASK-PRG043 -> TASK-SPC004 -> TASK-SPC009 -> TASK-SPC010 -> TASK-SPC011 -> TASK-SPC012
- GATE-2: TASK-PRG009 -> TASK-PRG010 -> TASK-PRG016 -> TASK-PRG017 -> TASK-PRG011 -> TASK-PRG018 -> TASK-PRG012 -> TASK-PRG026 -> TASK-PRG030 -> TASK-PRG034 -> TASK-PRG036 -> TASK-PRG045 -> TASK-PRG048 -> TASK-PRG005 -> TASK-PRG044 -> TASK-PRG050
- GATE-3: TASK-PRG006 -> TASK-PRG007 -> TASK-PRG008 -> TASK-PRG013 -> TASK-PRG014 -> TASK-PRG015 -> TASK-PRG039 -> TASK-PRG040 -> TASK-PRG035 -> TASK-PRG041 -> TASK-PRG042 -> TASK-PRG046 -> TASK-PRG047
- GATE-4: TASK-PRG019 -> TASK-PRG020 -> TASK-PRG021 -> TASK-PRG027 -> TASK-PRG032 -> TASK-PRG033 -> TASK-PRG037 -> TASK-PRG038 -> TASK-PRG022 -> TASK-PRG049
- GATE-5: TASK-PRG028 -> TASK-PRG029 -> TASK-PRG031

Cycle-resolution rationale:

- TASK-PRG048 does not depend on TASK-PRG005: `raw.authorAadId` already exists at the
  receive boundary. TASK-PRG005 retains TASK-PRG048 as its prerequisite because production
  stakeholder authorization uses the immutable `(tenantId, authorAadId)` key.
- TASK-PRG027 does not depend on TASK-PRG049: Docker build/start CI can validate the current
  image. TASK-PRG049 retains TASK-PRG027 because non-root/minimal-image assertions need that
  CI execution path.
