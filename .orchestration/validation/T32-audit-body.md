## Findings

### SPC-001: DevOps REQ-032 is an orphan definition in the wrong namespace state

- 種別: 矛盾
- 重大度: **HIGH**
- 対象: `docs/spec/spec-id-catalog.md:39`, `packages/traceability/spec-ids/devops.json:3-28`
- 引用: catalog defines DevOps `REQ-032`, but the DevOps REQ index jumps from `REQ-031` to `REQ-041`.
- 再検証: **採用**。catalogは32定義行だが、`(system,id)` で295 indexed IDsへjoinできるのは31行だけで、未定義indexed IDは264件。さらにPrjOps indexには同じ`REQ-032`があり、PrjOps catalog定義はない。
- なぜ問題か: system namespaceを無視するとDevOps定義をPrjOps IDへ誤接続でき、1 IDを定義済みと誤計上する。PRG-024の文字列一致リスクが実データで成立している。
- 推奨対処: `DevOps:REQ-032` をindexへ追加するかcatalogから除外するowner dispositionを行い、件数をnamespace joinから再生成する。
- 既存所見: PRG-023 / PRG-024。

### SPC-002: canonical source documents are unavailable

- 種別: ヌケモレ
- 重大度: **CRITICAL**
- 対象: `README.md:6-8`, `docs/spec/spec-id-catalog.md:3`, `verification/VERIFICATION_REPORT.md:9`
- 引用: older IDs are delegated to PrjOps/DevOps archives and `/mnt/user-data/uploads`.
- 再検証: **採用**。repository全体に対象ZIP/PPTXはなく、`/mnt/user-data/uploads` も存在しない。
- なぜ問題か: 旧IDの原文、例外、優先順位、変更履歴を監査できず、実装コメントが事実上の仕様へ昇格している。
- 推奨対処: licensed originalsをversioned canonical corpusへ取り込む。入手不能分は本復元表を現状記述としてowner reviewし、実装追認せずnormative textを別途決裁する。
- 既存所見: PRG-023。

### SPC-003: both REQ namespaces contain 25 unexplained gaps

- 種別: ヌケモレ
- 重大度: **HIGH**
- 対象: `packages/traceability/spec-ids/prjops.json:23-31`, `packages/traceability/spec-ids/devops.json:3-28`
- 引用: PrjOps skips `REQ-022..029`; DevOps skips `REQ-004..009`, `REQ-013..014`, and `REQ-032..040`.
- 再検証: **採用**。PrjOps 8件 + DevOps 17件 = 25件。PrjOps 11 revisions / DevOps 5 revisionsを調査し、欠番numeric baseが過去に存在して削除された履歴は0件。ADRにも欠番理由がない。他カテゴリの全欠番もID inventoryに列挙した。
- なぜ問題か: 予約、削除、未移植のどれかを判定できず、再採番で外部原本と衝突し得る。
- 推奨対処: 各欠番へ`reserved/deleted/not-applicable/missing-source`のowner dispositionと根拠commit/文書を付ける。
- 既存所見: PRG-023。

### SPC-004: AGENTS.md omits accepted ADR-0014

- 種別: ヌケモレ
- 重大度: **MED**
- 対象: `AGENTS.md:77-81`, `docs/adr/0014-integration-delivery.md:3-25`
- 引用: the guide's ADR list stops at 0013 while ADR-0014 is Accepted.
- 再検証: **採用**。
- なぜ問題か: workerが現行delivery runtime、ingest、HMAC、recipient filteringの決定を見落とし、ADR-0003だけを正とし得る。
- 推奨対処: ADR listを自動生成またはdirectory completeness checkで検証する。
- 既存所見: なし（T32新規）。

### SPC-005: traceability matching has a concrete substring false positive

- 種別: 間違い
- 重大度: **HIGH**
- 対象: `packages/traceability/src/verifyTraceability.ts:84-98`, ID pair DevOps `ISS-01` / PrjOps `ISS-010`
- 引用: matching uses `corpus.includes(id)`.
- 再検証: **採用**。registry-to-registry containment pairはexact全数で1件、`ISS-010`.includes(`ISS-01`) is true。task例の`REQ-04`/`REQ-042`と`AC-01`/`AC-018-1`は短い側が現indexにないため再現例には使わない。
- なぜ問題か: DevOps `ISS-01` はPrjOps `ISS-010`だけで参照済みと誤計上でき、system namespaceも判定しない。
- 推奨対処: token parserと`(system,id)` mappingを使い、source/test edgeを明示する。
- 既存所見: PRG-024。

### SPC-006: implemented and tested AC-016-1 is absent from the indexes

- 種別: 矛盾
- 重大度: **HIGH**
- 対象: `packages/prjops/src/templates/index.ts:3-5`, `packages/prjops/tests/reportTemplates.test.ts:177-187`, `packages/traceability/spec-ids/prjops.json`
- 引用: code and test claim `AC-016-1`, but no index contains it.
- 再検証: **採用**。code/test未登録IDの全数検索では、実仕様候補は本IDのみ。`REQ-999`は`standardReportsRepo.test.ts:29`のsynthetic fixtureである。
- なぜ問題か: 実装・テストが主張する受入条件がtraceability gateの母集団外にある。
- 推奨対処: ownerが正式IDか誤記かを決裁し、index/catalog/test titleを同一変更で整合させる。
- 既存所見: PRG-024。

### SPC-007: 64 indexed IDs have no exact implementation or test reference

- 種別: ヌケモレ
- 重大度: **HIGH**
- 対象: `.orchestration/validation/T32-id-inventory.md` section `Dead IDs`
- 引用: 64 namespaced IDs have neither exact source nor exact test references after excluding registries and generated matrices.
- 再検証: **採用**。PrjOps 34、DevOps 30。full listはID inventoryに固定した。
- なぜ問題か: dead ID、missing implementation、lost sourceを区別できず、文字列gateの100%主張とも整合しない。
- 推奨対処: 各IDをimplement/test、document-only、retired、lost-specへowner分類し、retiredは理由とreplacementを残す。
- 既存所見: PRG-023 / PRG-024。

### SPC-008: 36 acceptance criteria lack exact test references

- 種別: ヌケモレ
- 重大度: **HIGH**
- 対象: `.orchestration/validation/T32-id-inventory.md` section `AC IDs without exact test reference`
- 引用: PrjOps 11 and DevOps 25 AC IDs have no exact test edge.
- 再検証: **採用**。full listをinventoryへ固定した。
- なぜ問題か: ACを満たしたという機械的証拠がなく、comment-only source referenceでgreenになり得る。
- 推奨対処: testable ACへtest case edge、operational ACへowner-approved real-env evidence edgeを必須化する。
- 既存所見: PRG-024。

### SPC-009: seven_keys_snapshots documentation names nonexistent columns

- 種別: 間違い
- 重大度: **HIGH**
- 対象: `docs/spec/data-model.md:25`, `packages/devops/src/db/schema.sql:71-83`
- 引用: spec lists `name`, `keys`, and `trace_id`; schema has `snapshot_id`, `keys_rag`, and `next_actions`, with no `trace_id`.
- 再検証: **採用**。
- なぜ問題か: repository/query/traceability実装者が存在しない列へ依存し、監査traceの有無も誤認する。
- 推奨対処: normative data modelをschemaへ合わせるか、必要列をowner-approved migrationで追加する。
- 既存所見: なし（T32新規）。

### SPC-010: events.status omits the dead state

- 種別: 間違い
- 重大度: **HIGH**
- 対象: `docs/spec/data-model.md:9`, `packages/devops/src/db/schema.sql:13-23`
- 引用: spec lists four states; schema CHECK includes `dead`.
- 再検証: **採用**。
- なぜ問題か: DLQ終端状態が仕様から消え、operator/API behaviorを完全に定義できない。
- 推奨対処: state machine、遷移条件、replay/retention責任をdata modelへ追加する。
- 既存所見: PRG-015。

### SPC-011: data model omits schema_migrations and event retry/claim semantics

- 種別: ヌケモレ
- 重大度: **HIGH**
- 対象: `docs/spec/data-model.md:5-27`, `packages/devops/src/db/schema.sql:7-29`
- 引用: the table list omits `schema_migrations`; events columns omit `attempts`, `next_attempt_at`, `claimed_at`, and `dedupe_key`.
- 再検証: **採用**。
- なぜ問題か: migration ordering、retry、lease recovery、dedupe contractが仕様から監査できない。
- 推奨対処: all tables/columnsではなくても、stateful invariantsとownershipをschema-derived documentationへ同期する。
- 既存所見: PRG-014 / PRG-015。

### SPC-012: data-model migration note contradicts the repository migration runner

- 種別: 間違い
- 重大度: **MED**
- 対象: `docs/spec/data-model.md:41`, `packages/devops/src/db/migrate.ts:33-78`, `packages/devops/src/db/migrations/`
- 引用: docs say actual migration rollout is outside the repository; the repository contains a runner and seven ordered SQL migrations.
- 再検証: **採用**。
- なぜ問題か: worker/operatorがschema commentsだけ、外部infraだけ、repo runnerのどれを正とするか判断できない。
- 推奨対処: fresh schemaとupgrade migrationsの責任境界、実行順、production operatorを明記する。
- 既存所見: PRG-001 / PRG-026。

### SPC-013: declared audit retention has no enforceable lifecycle

- 種別: 間違い
- 重大度: **CRITICAL**
- 対象: `docs/adr/0001-monorepo.md:26-31`, `packages/shared/src/auditLog.ts:5-15`, `packages/devops/src/db/schema.sql:186-216`
- 引用: ADR says separate PrjOps five-year and DevOps one-year policies are implemented; code supplies append APIs and a commented partition example only.
- 再検証: **採用**。repositoryにPrjOps five-year purge/retention mechanismはなく、audit partition lifecycle runbook/scriptもない。
- なぜ問題か: compliance period、storage bounds、legal holdを実行・証明できない。
- 推奨対処: system別retention policy、partition creation/drop、hold、dry-run、evidenceを実装・運用契約へ分離する。
- 既存所見: PRG-001 / PRG-036。

### SPC-014: one-year retention and 13-month rotation are treated as equivalent

- 種別: 矛盾
- 重大度: **HIGH**
- 対象: `packages/devops/src/db/schema.sql:213-216`, `docs/adr/0005-resident-server-and-teams-integration.md:39-42`
- 引用: schema comments pair `13 months` with `REQ-028: one year`; ADR calls 13-month message retention aligned with one-year audit retention.
- 再検証: **採用**。
- なぜ問題か: 12か月と13か月のどちらがnormativeか、暦月境界を含むかを実装者が決めることになる。
- 推奨対処: duration、inclusive boundary、timezone、hold exceptionをowner決裁し、別データ種別を「整合」とだけ表現しない。
- 既存所見: PRG-036 / PRG-046。

### SPC-015: Seven Keys is called deterministic while thresholds are non-canonical

- 種別: 曖昧
- 重大度: **HIGH**
- 対象: `docs/spec/spec-id-catalog.md:21`, `docs/adr/0010-seven-keys-canonical.md:24-30`
- 引用: catalog requires deterministic RAG; ADR calls 70%, 2/5, and 48/72h “initial calibration values, not canonical fixed values.”
- 再検証: **採用**。
- なぜ問題か: same input may be judged under silently changed thresholds with no effective date/version contract.
- 推奨対処: versioned threshold registry、effective date、owner、backfill/recalculation policyをnormative化する。
- 既存所見: PRG-025。

### SPC-016: scheduler minimum interval is approximate

- 種別: 曖昧
- 重大度: **MED**
- 対象: `docs/adr/0003-devops-runtime.md:14,39`
- 引用: GitHub Actions minimum interval is described as “概ね/程度5分”.
- 再検証: **採用**。
- なぜ問題か: runtime placement and SLO comparison use an undefined bound.
- 推奨対処: distinguish configured cron granularity, observed scheduling delay, and product deadline with measurable limits.
- 既存所見: PRG-025。

### SPC-017: extended-thinking default is absent from the decision record

- 種別: 曖昧
- 重大度: **MED**
- 対象: `docs/adr/0013-page-agent-reasoning-generative-ui.md:19`, `packages/web/src/server/chat/chatHandler.ts:35-37`, `packages/web/src/server/config.ts:31-34`
- 引用: ADR says “use the default” without a number; implementation chooses 12,000 tokens.
- 再検証: **採用**。implementation value exists, but the normative decision and change policy do not.
- なぜ問題か: cost/latency behavior can change without violating the written ADR because its default is unspecified.
- 推奨対処: pin default, min/max, model applicability, owner, and migration rule in the specification.
- 既存所見: PRG-025。

### SPC-018: notification latency uses an unmeasurable normal case

- 種別: 曖昧
- 重大度: **MED**
- 対象: `docs/adr/0005-resident-server-and-teams-integration.md:30-33`
- 引用: notification delay is “normally several seconds,” while polling has a five-minute maximum.
- 再検証: **採用**。
- なぜ問題か: Phase-2 migration trigger cannot be evaluated without percentile/window/error budget.
- 推奨対処: define p95/p99 delay, measurement point, window, and escalation threshold.
- 既存所見: PRG-025。

### SPC-019: 50/100 project and company limits have no requirement or acceptance edge

- 種別: ヌケモレ
- 重大度: **HIGH**
- 対象: `README.md:8`, spec indexes/catalog, repository tests
- 引用: approximately 50 projects, design limit 100 projects and 100 companies.
- 再検証: **採用**。exact search finds no indexed definition, DB constraint, workload model, or acceptance test that gives the limits operational meaning.
- なぜ問題か: design-limit claims are neither falsifiable nor tied to latency, concurrency, storage, or cost.
- 推奨対処: assign REQ/NFR/AC IDs and define workload shape, duration, thresholds, environment, and evidence.
- 既存所見: PRG-025 / PRG-029。

### SPC-020: cost reservation has no reconcile-failure or abandonment contract

- 種別: ヌケモレ
- 重大度: **HIGH**
- 対象: `docs/spec/data-model.md:33`, `packages/shared/src/clients/pgCostGuard.ts:97-173`, `packages/shared/tests/pgCostGuard.test.ts:130-222`
- 引用: docs specify reservation then reconciliation on successful completion; no expiry/recovery behavior is stated for a failed reconcile or abandoned stream.
- 再検証: **採用**。
- なぜ問題か: estimated rows can permanently consume the daily cap, and operators cannot distinguish real cost from stale reservation.
- 推奨対処: reservation state/TTL, reconcile idempotency, crash recovery, actual-vs-estimate accounting, and alerting semanticsを定義する。
- 既存所見: PRG-025。

### SPC-021: report metric provenance is unspecified; principle-7 violation is not proven

- 種別: 曖昧
- 重大度: **MED**
- 対象: `AGENTS.md:35-51`, `packages/shared/src/reporting/calculateReportMetrics.ts:7-16`, `packages/shared/src/reporting/finalizeReportJson.ts:26-31`
- 引用: metrics are read from `REPORT_COMPLETED`/`REPORT_BLOCKED`; evidence, period, and type are read from environment.
- 再検証: **部分採用**。これらは`src/lib/`でもexternal clientでもないCLI composition scriptsなので、原則1/7の字義違反は反証した。ただし原則2が求めるdata-derived deterministic metricに対し、env値の生成元・period alignment・provenance validationが仕様にない。
- なぜ問題か: arbitrary CI environment values can become apparently validated report metrics.
- 推奨対処: typed metrics input artifact、source query/run ID、period、commit、schema validationを仕様化する。envはtransportに限定する。
- 既存所見: PRG-007 / PRG-022。

### SPC-022: specifications do not define multi-replica scheduler coordination

- 種別: ヌケモレ
- 重大度: **HIGH**
- 対象: `docs/adr/0005-resident-server-and-teams-integration.md:17-23`, `packages/server/src/scheduler/scheduler.ts:73-114`
- 引用: ADR specifies an in-process multiple-execution guard, but no leader, lease, advisory lock, or replica ownership contract.
- 再検証: **採用**。docs/spec/ADR全検索でもmulti-replica semanticsはない。
- なぜ問題か: PRG-041 is rooted in an absent concurrency requirement, not only an implementation defect.
- 推奨対処: deployment cardinality or per-task distributed lease, fencing, expiry, idempotency, and failover behaviorをnormative化する。
- 既存所見: PRG-041。

### SPC-023: specifications do not fail closed outside the holiday-data horizon

- 種別: ヌケモレ
- 重大度: **HIGH**
- 対象: `packages/shared/src/calendar/jp_holidays.yaml:3-17`, `packages/shared/src/calendar/businessCalendar.ts:76-84`, undefined `PrjOps:SPEC-INT-054` / `DevOps:SPEC-INT-033`
- 引用: the data file says annual review, but neither indexed specification has repository text defining covered years, provisional handling, or startup/scheduling failure.
- 再検証: **採用**。
- なぜ問題か: PRG-042 is rooted in missing stale-calendar semantics; implementation treats every absent future date as a business day.
- 推奨対処: coverage metadata, verified flag semantics, fail-closed horizon, advance alert, and annual owner approvalを仕様化する。
- 既存所見: PRG-042。

### SPC-024: standard report specification lacks source project/tenant ownership

- 種別: ヌケモレ
- 重大度: **CRITICAL**
- 対象: `packages/shared/src/reporting/reportSchema.ts:25-35`, `docs/spec/spec-id-catalog.md:15,23,30,41-47`
- 引用: report schema has no tenant/project/source ownership; catalog defines recipient filtering but not provenance required before filtering.
- 再検証: **採用**。
- なぜ問題か: PRG-044 is rooted in a schema omission that allows unscoped content to be assigned to each recipient's allowed project.
- 推奨対処: report/slot-level system, tenant, project, source actor, and classification; reject unscoped detail before delivery.
- 既存所見: PRG-044。

### SPC-025: idempotent delivery outcome lacks an exclusive-claim and crash-recovery contract

- 種別: ヌケモレ
- 重大度: **HIGH**
- 対象: `packages/prjops/src/lib/idempotentDelivery.ts:4-7`, `docs/spec/spec-id-catalog.md:17,25,32,41-47`
- 引用: specs promise idempotent/no duplicate delivery but do not define concurrent claim ownership, lease expiry, or crash-before-sent recovery.
- 再検証: **採用**。
- なぜ問題か: PRG-047 is not resolved by an outcome sentence alone; multiple implementations can claim compliance while duplicating external sends.
- 推奨対処: atomic claim result, claimant identity, lease/TTL, retry suffix semantics, and reconciliation state machineをacceptance criteriaにする。
- 既存所見: PRG-047。

### SPC-026: action accountability lacks an immutable actor identity requirement

- 種別: ヌケモレ
- 重大度: **HIGH**
- 対象: `AGENTS.md:45-49`, undefined DevOps `AC-026a`, `packages/server/src/agents/teamsConversationAgent.ts:292-300,426-447,485-491`
- 引用: general audit rules require append-only records but do not specify AAD/object ID propagation distinct from persona.
- 再検証: **採用**。
- なぜ問題か: PRG-048 is rooted in absent identity semantics; persona-only actors can satisfy the written append-only rule while remaining non-attributable.
- 推奨対処: immutable subject ID, tenant, display/persona separation, minimization, retention, and every action boundary's propagation ruleを仕様化する。
- 既存所見: PRG-048。

## T30/T30-V1 Retrospective

| Existing finding | Was the scenario specified? | T32 conclusion | Root specification finding |
| --- | --- | --- | --- |
| PRG-041 replica duplication | No | ADR specifies process-local overlap only; distributed ownership is absent. | SPC-022 |
| PRG-042 calendar horizon | No | Annual-update comments exist, but covered-year and fail-closed behavior do not. | SPC-023 |
| PRG-044 cross-project report leak | No | Recipient filtering is specified; source project/tenant provenance is not. | SPC-024 |
| PRG-047 delivery TOCTOU | Partially | No-duplicate/idempotent outcome exists, but claim/lease/crash semantics do not. | SPC-025 |
| PRG-048 audit actor | No | Append-only auditing exists, but immutable individual identity propagation does not. | SPC-026 |

## Orchestrator Candidate Revalidation

| Candidate | Result | Finding |
| --- | --- | --- |
| seven_keys_snapshots columns | adopted | SPC-009 |
| events dead status | adopted | SPC-010 |
| retention implementation absent | adopted | SPC-013 |
| 12 vs 13 month retention | adopted | SPC-014 |
| non-canonical Seven Keys thresholds | adopted | SPC-015 |
| three vague defaults/latencies | adopted as three findings | SPC-016, SPC-017, SPC-018 |
| data model retry/migration omissions | adopted | SPC-011 |
| 50/100 scale claim | adopted | SPC-019 |
| PgCostGuard orphan reservation | adopted | SPC-020 |
| reporting env access / design principles | partially adopted; literal principles 1/7 refuted, provenance ambiguity retained | SPC-021 |

## Required Owner Decisions

1. Resolve `DevOps:REQ-032` catalog/index membership and update downstream plans that still carry the superseded 263 count.
2. Name a Specification Owner for each system and review every row in `spec_reconstruction.md`; current behavior is not normative approval.
3. Keep all `復元不能` rows blocked until originals are recovered or new normative text is authored.
4. Convert SPC-001 through SPC-026 into `TASK-SPCxxx` entries using the T31 expansion procedure.
