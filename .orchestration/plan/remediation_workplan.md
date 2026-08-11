# Production Remediation Workplan

- Source audit: `.orchestration/audit/production_readiness_gap_audit.md`
- Planned at: commit `21306d8`, 2026-07-10
- Scope: 受入済みT30-V1 PRG-001 through PRG-050 + T32 SPC-001 through SPC-026（76所見）
- Status owner: remediation orchestrator

## Executor Contract

1. Read this task fully. Run `git diff --stat 21306d8..HEAD --` followed by every literal path in that task's 許可ファイル/スコープ before editing. If cited code or schema has drifted materially, STOP and report; do not reinterpret the task.
2. Edit only the listed scope. New files require the same directory boundary and a specification-ID header. Never weaken tests, gates, authorization, sanitation, audit append-only behavior, or fail-closed behavior to obtain green.
3. Add the smallest production implementation plus the named regression tests. Dependency additions, public contract changes, data loss, or scope expansion require an explicit owner decision; otherwise STOP.
4. Store redacted evidence under the task's evidence path. A mock/DI test is `verified-integration`, never proof of PostgreSQL/Docker/GitHub/Graph/Anthropic behavior. Real-environment evidence is mandatory only at the final PRG-031 go-live gate but must remain OPEN until executed.
5. Every task ends with `mise run ci`. Because current CI omits Web tests, tasks touching Web must also run `pnpm --filter @aiops/web run test` until TASK-PRG033 is accepted.

## Coverage: 受入済みPRG-001〜050 + SPC-001〜026（76所見）

| PRG-ID | TASK-ID |
| --- | --- |
| PRG-001 | TASK-PRG001 |
| PRG-002 | TASK-PRG002 |
| PRG-003 | TASK-PRG003 |
| PRG-004 | TASK-PRG004 |
| PRG-005 | TASK-PRG005 |
| PRG-006 | TASK-PRG006 |
| PRG-007 | TASK-PRG007 |
| PRG-008 | TASK-PRG008 |
| PRG-009 | TASK-PRG009 |
| PRG-010 | TASK-PRG010 |
| PRG-011 | TASK-PRG011 |
| PRG-012 | TASK-PRG012 |
| PRG-013 | TASK-PRG013 |
| PRG-014 | TASK-PRG014 |
| PRG-015 | TASK-PRG015 |
| PRG-016 | TASK-PRG016 |
| PRG-017 | TASK-PRG017 |
| PRG-018 | TASK-PRG018 |
| PRG-019 | TASK-PRG019 |
| PRG-020 | TASK-PRG020 |
| PRG-021 | TASK-PRG021 |
| PRG-022 | TASK-PRG022 |
| PRG-023 | TASK-PRG023 |
| PRG-024 | TASK-PRG024 |
| PRG-025 | TASK-PRG025 |
| PRG-026 | TASK-PRG026 |
| PRG-027 | TASK-PRG027 |
| PRG-028 | TASK-PRG028 |
| PRG-029 | TASK-PRG029 |
| PRG-030 | TASK-PRG030 |
| PRG-031 | TASK-PRG031 |
| PRG-032 | TASK-PRG032 |
| PRG-033 | TASK-PRG033 |
| PRG-034 | TASK-PRG034 |
| PRG-035 | TASK-PRG035 |
| PRG-036 | TASK-PRG036 |
| PRG-037 | TASK-PRG037 |
| PRG-038 | TASK-PRG038 |
| PRG-039 | TASK-PRG039 |
| PRG-040 | TASK-PRG040 |
| PRG-041 | TASK-PRG041 |
| PRG-042 | TASK-PRG042 |
| PRG-043 | TASK-PRG043 |
| PRG-044 | TASK-PRG044 |
| PRG-045 | TASK-PRG045 |
| PRG-046 | TASK-PRG046 |
| PRG-047 | TASK-PRG047 |
| PRG-048 | TASK-PRG048 |
| PRG-049 | TASK-PRG049 |
| PRG-050 | TASK-PRG050 |
| SPC-001 | TASK-SPC001 |
| SPC-002 | TASK-SPC002 |
| SPC-003 | TASK-SPC003 |
| SPC-004 | TASK-SPC004 |
| SPC-005 | TASK-SPC005 |
| SPC-006 | TASK-SPC006 |
| SPC-007 | TASK-SPC007 |
| SPC-008 | TASK-SPC008 |
| SPC-009 | TASK-SPC009 |
| SPC-010 | TASK-SPC010 |
| SPC-011 | TASK-SPC011 |
| SPC-012 | TASK-SPC012 |
| SPC-013 | TASK-SPC013 |
| SPC-014 | TASK-SPC014 |
| SPC-015 | TASK-SPC015 |
| SPC-016 | TASK-SPC016 |
| SPC-017 | TASK-SPC017 |
| SPC-018 | TASK-SPC018 |
| SPC-019 | TASK-SPC019 |
| SPC-020 | TASK-SPC020 |
| SPC-021 | TASK-SPC021 |
| SPC-022 | TASK-SPC022 |
| SPC-023 | TASK-SPC023 |
| SPC-024 | TASK-SPC024 |
| SPC-025 | TASK-SPC025 |
| SPC-026 | TASK-SPC026 |

### T32受入後のカバレッジ再生成記録

1. T32受入済み正本2点からSPC-001〜026を抽出し、TASK-SPC001〜026へ一対一で追加した。
2. PRG 50行 + SPC 26行の和集合を機械検査し、76所見/76task、missing 0、duplicate 0をT33 validationへ固定する。
3. SPC追加後もPRG番号は変更せず、将来の新監査は別prefixのtaskを同じ手順で追記する。
4. 仕様オーナー未承認の復元は実装taskの開始根拠にせず、TASK-SPCのSTOP条件を維持する。

## 新規仕様ID採番ガバナンス

- 対象task: TASK-PRG001, TASK-PRG004, TASK-PRG011, TASK-PRG013, TASK-PRG014, TASK-PRG015, TASK-PRG016, TASK-PRG017, TASK-PRG018, TASK-PRG019, TASK-PRG022, TASK-PRG023, TASK-PRG024, TASK-PRG025, TASK-PRG026, TASK-PRG027, TASK-PRG028, TASK-PRG029, TASK-PRG030, TASK-PRG031, TASK-PRG032, TASK-PRG033, TASK-PRG034, TASK-PRG038, TASK-PRG040, TASK-PRG041, TASK-PRG043, TASK-PRG044, TASK-PRG045, TASK-PRG046, TASK-PRG048, TASK-PRG049, TASK-PRG050, TASK-SPC003, TASK-SPC005, TASK-SPC008, TASK-SPC010〜TASK-SPC026。
- 責任: Specification Ownerが採番のaccountable、Traceability Maintainerがregistry更新のresponsible。実装workerは番号を予約・決定せず、必要な種別、system namespace、意味、依存taskを申請する。
- 規則: `(system, category, number)` を一意キーとし、1 IDは1定義だけを持つ。欠番や廃止番号を再利用せず、PrjOps `REQ-022`〜`REQ-029` とDevOps `REQ-004`〜`REQ-009` / `REQ-013`〜`REQ-014` / `REQ-032`〜`REQ-040`（計25件）はowner disposition完了まで予約禁止。孤児定義DevOps `REQ-032` はTASK-SPC001決裁までquarantineする。採番はcanonical registryで先に予約し、定義、semantic mapping、test/evidence edge、owner approvalを同一変更で追加する。
- 停止条件: T32で名前空間・欠番・死にIDのdispositionが確定する前、またはSpecification Owner不在時は新規IDを採番せずBLOCKED報告する。

## Tasks

### TASK-PRG001: PostgreSQL監査スキーマをfresh DBで成立させる
- 対応所見: PRG-001
- 観点(surface / lens): 実装 / 信頼性
- 現状(as-is): `packages/devops/src/db/schema.sql:186-216` は `at` を含まない主キーでrange partitionし、実partitionはコメントのみ。
- 精査で判明した欠陥: fresh schema適用自体と初回audit insertが失敗し、全監査依存経路を停止させる。
- 改善(to-be): 主キーを `(log_id, at)` に変更し、default partition + 3か月先までの月次partitionをmigration runnerで作る。別案の非partition化は保持量要件を満たさないため採用禁止。
- 許可ファイル/スコープ: `packages/devops/src/db/`, `packages/server/src/db/`, `packages/server/tests/integration/`
- 禁止事項: 共通Executor Contractに加え、非partition化、schema.sqlだけ直してmigrationを省略、mock DBでDDL成功扱い。
- 前提/停止条件: PostgreSQL 16を基準とする。接続可能なephemeral PGが用意できなければ実DB検証をBLOCKED報告。
- 完了条件(DoD、チェックボックス):
  - [ ] fresh schemaと全migrationがPG16へexit 0で適用されaudit insertが成功
  - [ ] 現月/default/future partitionと主キー列をSQL assertionで確認
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: `DATABASE_URL="$EPHEMERAL_DATABASE_URL" pnpm --filter @aiops/server exec vitest run tests/integration/auditSchema.test.ts` → pass。
  - requires-real-env: staging PG16でmigration dry-run、月境界insert、rollback/backup復元を実施しPRG-031台帳へ結果を記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-001/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): なし（GATE-0）
- 仕様トレース: DevOps REQ-028 / SPEC-INT-056。partition lifecycle ACは新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG002: GitHubイベントを実DevOpsエージェントへ結線する
- 対応所見: PRG-002
- 観点(surface / lens): 実装 / 仕様完全性
- 現状(as-is): `packages/server/src/index.ts:194-226` のAGT_BLD/DEP/INC handlerはaudit appendのみ。
- 精査で判明した欠陥: 署名済みイベントをdone扱いしても分類・インシデント・デプロイ動作が起きない。
- 改善(to-be): owner承認済みのDevOps `SPEC-INT-011 / SPEC-INT-020 / SPEC-INT-030` 定義に従い、event種別→指定AGT関数の明示mapをcomposition rootへ追加し、必要adapterをDIする。未知eventと失敗時の処理も承認定義どおり実装し、既存実装から要求を推測しない。
- 許可ファイル/スコープ: `packages/server/src/`, `packages/server/tests/`, `packages/devops/src/agents/`
- 禁止事項: 共通Executor Contractに加え、agentロジックをserverへ複製、audit-only handler維持、外部APIをunit testで直呼び。
- 前提/停止条件: T32が受入済みで、TASK-PRG023のcanonical corpusまたはT32逆再構成により引用3 IDの定義文がSpecification Owner承認済みであること。1件でも未確定なら実装に着手せずBLOCKED報告する。承認後も既存agent入力型で必要情報を作れなければ型不足をBLOCKED報告し、推測fieldを作らない。
- 完了条件(DoD、チェックボックス):
  - [ ] BLD/DEP/INC各代表eventが対応agent side effectを1回だけ呼ぶcomposition test追加
  - [ ] 失敗時eventがdoneにならずretry/dead規約に従う
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: `pnpm --filter @aiops/server exec vitest run tests/githubEventRouter.test.ts tests/eventsPollingTask.test.ts tests/indexComposition.test.ts` → pass。
  - requires-real-env: staging GitHub Appから3種webhookを送信し、redacted Graph/GitHub side effectとaudit traceをPRG-031へ保存。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-002/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): T32（受入済）, TASK-PRG023
- 仕様トレース: DevOps SPEC-INT-011 / SPEC-INT-020 / SPEC-INT-030。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG003: 本番deploy workflowを実デプロイへ置換する
- 対応所見: PRG-003
- 観点(surface / lens): 実装 / 運用性
- 現状(as-is): `packages/devops/src/workflows/deploy-prod.yml:36-41` はechoのみで、active workflowでもない。
- 精査で判明した欠陥: 成功表示でもartifact promotion、health確認、rollbackが一切ない。
- 改善(to-be): Azure Container Appsを標準platformに決定し、immutable image digestのstaging→production promotion、Environment承認、15分health判定、直前revision rollbackをworkflow化する。platform不承認なら実装せずADR決裁をBLOCKED報告。
- 許可ファイル/スコープ: `packages/devops/src/workflows/`, `.github/workflows/`, `packages/devops/tests/`, `docs/adr/`
- 禁止事項: 共通Executor Contractに加え、latest tag、echo成功、production直build、Environment承認迂回、別cloudの独断採用。
- 前提/停止条件: Azure Container Apps採用がowner承認済みであること。未承認ならSTOP。
- 完了条件(DoD、チェックボックス):
  - [ ] workflow lintで全local ref/action pinが合格
  - [ ] dry-run fixtureでpromotion→health→rollback stateを検証
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: workflow static test + mocked `az` adapter testをrepo CIでpass。
  - requires-real-env: staging ACA/ACR/Environmentを用意しcanary deployと故障注入rollbackを実施、run URL/digestをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-003/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): なし（GATE-0）
- 仕様トレース: DevOps SPEC-INT-020 / SPEC-INT-060 / TH-003 / AC-010a。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG004: PrjOps本番データproviderと定期runtimeを構成する
- 対応所見: PRG-004
- 観点(surface / lens): 実装 / 仕様完全性
- 現状(as-is): `packages/web/src/server/personaResolver.ts:74-85` 等はinterface/in-memory、routeは空provider、`packages/server/src/index.ts:354-362` はsnapshot disabled。
- 精査で判明した欠陥: persona、project data、分析・追跡・reportが本番入力で動かない。
- 改善(to-be): owner承認済みのPrjOps `REQ-002 / REQ-040 / SPEC-INT-067` 定義に従い、versioned private `prjops-data` Git repositoryを正本とするread-only YAML providerとresident scheduleを実装する。repository方式は承認済み定義と矛盾しない場合だけ採用し、実装やfixtureから未定義の要求を補完しない。
- 許可ファイル/スコープ: `packages/prjops/src/`, `packages/server/src/`, `packages/web/src/server/`, `packages/*/tests/`
- 禁止事項: 共通Executor Contractに加え、in-memory providerをproduction fallback、fixtureデータ出荷、provider取得失敗を空データ成功扱い。
- 前提/停止条件: T32が受入済みで、TASK-PRG023のcanonical corpusまたはT32逆再構成により引用3 IDの定義文がSpecification Owner承認済みであること。1件でも未確定なら実装に着手せずBLOCKED報告する。承認後もprjops-data schema/versionとread credential ownerが未確定ならBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] production modeでin-memory/empty providerを起動拒否
  - [ ] representative YAMLでpersona→summary→snapshotのcomposition test合格
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: `pnpm --filter @aiops/server exec vitest run tests/prjopsRuntimeComposition.test.ts` とWeb handler tests → pass。
  - requires-real-env: staging private repo credential、scheduled run、更新反映、credential失効時fail-closedをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-004/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): T32（受入済）, TASK-PRG023
- 仕様トレース: PrjOps REQ-002 / REQ-040 / SPEC-INT-067。runtime/provider ACは新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG005: Teams認可を本番stakeholder正本へ切り替える
- 対応所見: PRG-005
- 観点(surface / lens): 実装 / セキュリティ
- 現状(as-is): `packages/server/src/index.ts:122-136,228-239` は単一SAMPLE_STAKEHOLDERSで認可。
- 精査で判明した欠陥: 実利用者が拒否され、fixture identityだけが誤ったproject権限を得る。
- 改善(to-be): TASK-PRG004のversioned stakeholder providerを注入し、取得不能・stale・重複identityはfail closed。productionでfixture providerを型/起動検査で禁止。
- 許可ファイル/スコープ: `packages/server/src/lib/`, `packages/server/src/index.ts`, `packages/server/tests/`, `packages/prjops/src/data/`
- 禁止事項: 共通Executor Contractに加え、fixture拡張で対応、emailだけで認可、provider障害時の既定profile付与。
- 前提/停止条件: TASK-PRG004 provider contractとTASK-PRG048の`(tenantId, authorAadId)`伝播が受入済みであること。認可keyをpersona/emailへ戻す必要がある場合はBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] SAMPLE_STAKEHOLDERS production参照0件
  - [ ] 未登録/別project/stale/重複identityのdeny test追加
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: `pnpm --filter @aiops/server exec vitest run tests/stakeholderProfileResolver.test.ts tests/indexComposition.test.ts` → pass。
  - requires-real-env: staging tenantで許可/拒否各ユーザーのTeams commandを実行しaudit traceをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-005/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG004, TASK-PRG048
- 仕様トレース: PrjOps REQ-002 / ADR-0005。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG006: hosted workflowのagent CLIを固定導入する
- 対応所見: PRG-006
- 観点(surface / lens): 実装 / 運用性
- 現状(as-is): `.github/actions/run-coding-agent/action.yml:23-50` とreport workflowは未導入のclaude/droidを呼ぶ。
- 精査で判明した欠陥: clean hosted runnerで最初のagent呼出しが失敗する。
- 改善(to-be): 公式の固定SHA action/installerが存在するagentだけを有効化する。初期標準はClaude Code、Droidは検証完了までchoiceから削除。version/checksumを固定。
- 許可ファイル/スコープ: `.github/actions/`, `.github/workflows/`, `packages/devops/src/workflows/`, `runbooks/`
- 禁止事項: 共通Executor Contractに加え、curl|sh、floating tag、未検証CLI flag、両agentを見せかけで維持。
- 前提/停止条件: 公式installerとライセンスが確認できなければそのagentを無効化してBLOCKED記録。
- 完了条件(DoD、チェックボックス):
  - [ ] clean runner smokeでCLI versionとnon-interactive helpが成功
  - [ ] workflow inputに未導入agentが残らない
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: actionlint/fixture workflow smokeをCIでpass。
  - requires-real-env: 専用staging repoでread-only task/reportを1回実行し課金/権限/ログをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-006/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG003, TASK-PRG017, TASK-PRG018, TASK-PRG045
- 仕様トレース: ADR-0006 / PrjOps REQ-040 / SPEC-INT-067。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG007: 標準report metricを本番snapshotから生成する
- 対応所見: PRG-007
- 観点(surface / lens): 実装 / 仕様完全性
- 現状(as-is): `calculateReportMetrics.ts:7-16` は未設定を0、workflowはdata sourceなし・ingest未設定を成功skip。
- 精査で判明した欠陥: 欠測を実績0と偽り、配信されなくても成功する。
- 改善(to-be): TASK-PRG004のversioned snapshotを必須入力にし、欠測はNA/error、production scheduleではingest必須とする。
- 許可ファイル/スコープ: `packages/shared/src/reporting/`, `.github/workflows/report-generation.yml`, `packages/shared/tests/`, `packages/server/tests/`
- 禁止事項: 共通Executor Contractに加え、env未設定=0、production ingest skip、LLMに数値生成、fixtureをproduction入力。
- 前提/停止条件: metric source schema未確定ならTASK-PRG025へblocker返却。
- 完了条件(DoD、チェックボックス):
  - [ ] 欠測fixtureが非zeroかつ明示failure/NA
  - [ ] valid snapshot→schema検証→ingestのtest合格
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: `pnpm --filter @aiops/shared exec vitest run tests/reporting.test.ts` とserver ingest tests → pass。
  - requires-real-env: staging snapshot/APIとworkflow scheduleを接続しreport/ingest一致をPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-007/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG004, TASK-PRG023, TASK-PRG025
- 仕様トレース: PrjOps REQ-040 / SPEC-INT-067; DevOps SPEC-INT-082。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG008: 既存failsafe guardを依存healthとdurable stateへ拡張する
- 対応所見: PRG-008
- 観点(surface / lens): 実装 / 信頼性
- 現状(as-is): `index.ts:252-268` はDBだけをcheckし通知no-op、stateはmemory。既存guardはevent/reconcile/reportと3 mutating routeで機能。
- 精査で判明した欠陥: 外部障害を検知せずrestartで消え、DB復帰だけで自動解除する。
- 改善(to-be): 既存guardを保持し、DB schema/GitHub/Graph/agent二重signal、PostgreSQL durable state、operator ack解除、全project通知を追加。JIT失効/healthは常時許可、subscription/channel pollingはread-only継続と明文化。
- 許可ファイル/スコープ: `packages/server/src/scheduler/`, `packages/server/src/http/`, `packages/server/src/db/`, `packages/server/tests/`, `runbooks/`
- 禁止事項: 共通Executor Contractに加え、guard全面再実装、JIT失効停止、自動解除、外部障害をmock successで隠す。
- 前提/停止条件: dependency failure policyがTASK-PRG025で承認済み。
- 完了条件(DoD、チェックボックス):
  - [ ] 3失敗+2独立signalでdurable failsafe、restart後もactive
  - [ ] ackなし自動解除不可、既存guard regression全合格
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: server scheduler/route tests + ephemeral PG state test → pass。
  - requires-real-env: stagingでGitHub/Graph遮断とrestartを実施し通知/遮断/手動解除をPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-008/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG001, TASK-PRG002, TASK-PRG025, TASK-PRG030
- 仕様トレース: DevOps REQ-029 / SPEC-INT-040 / SPEC-EXT-042。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG009: audit append-only DB roleをDDLで強制する
- 対応所見: PRG-009
- 観点(surface / lens): 実装 / セキュリティ
- 現状(as-is): `schema.sql:198-201` のREVOKE/GRANTはコメントでapp role bootstrapなし。
- 精査で判明した欠陥: application owner/default権限でaudit UPDATE/DELETEが可能。
- 改善(to-be): owner/migrator/appの3 roleをbootstrap SQL化し、appへaudit INSERT/SELECTとsequenceだけ付与、UPDATE/DELETE/TRUNCATEを明示deny。
- 許可ファイル/スコープ: `packages/devops/src/db/`, `packages/server/tests/integration/`, `runbooks/database-migrations.md`
- 禁止事項: 共通Executor Contractに加え、アプリ側guardだけ、owner credentialをruntimeへ供給、監査行UPDATE/DELETE。
- 前提/停止条件: role作成権限付きephemeral PGがなければreal DB検証をBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] app role INSERT成功、UPDATE/DELETE/TRUNCATE失敗
  - [ ] migrator/ownerとruntime credentialが分離
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: PG16 integration role-denial test → pass。
  - requires-real-env: staging app credentialでdeny実証、rotation/ownershipをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-009/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG001
- 仕様トレース: DevOps REQ-028 / SPEC-INT-056。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG010: GitHub payloadを初回永続化前にsanitizeする
- 対応所見: PRG-010
- 観点(surface / lens): 実装 / セキュリティ
- 現状(as-is): `githubWebhook.ts:46-69`→`eventsRepo.ts:99-120` がsigned JSONをraw保存し、兄弟repoはsanitize。
- 精査で判明した欠陥: 正規GitHub本文に貼られたcredentialがeventsへ残る。
- 改善(to-be): enqueue境界で構造をpreserveしたdeterministic recursive sanitizerを適用し、routingに不要なfieldはdrop。redaction metadataだけaudit。
- 許可ファイル/スコープ: `packages/server/src/http/routes/`, `packages/server/src/db/`, `packages/shared/src/`, `packages/server/tests/`
- 禁止事項: 共通Executor Contractに加え、署名済みだから安全扱い、LLM投入時だけsanitize、raw copyの別列保存。
- 前提/停止条件: routingに必要なfield一覧が不足ならイベント種別ごとにBLOCKED報告。
- 完了条件(DoD、チェックボックス):
  - [ ] secret-like fixtureがevents SQL parameterに残らない
  - [ ] event routing/dedupe regression全合格
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: webhook/events repo testsにtoken fixtureを追加しpass。
  - requires-real-env: staging webhookへredacted test markerを送りDB/audit/log全層を確認しPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-010/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG002, TASK-PRG009
- 仕様トレース: PrjOps REQ-036 / DevOps REQ-031/032 / SPEC-INT-070。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG011: 公開HTTP境界へbody limitとrate limitを置く
- 対応所見: PRG-011
- 観点(surface / lens): 実装 / セキュリティ
- 現状(as-is): 複数routeがauth前にbody全量bufferし、413/rate limiterなし（例 `xlsxImport.ts:51`, `githubWebhook.ts:30`）。
- 精査で判明した欠陥: internet requestがHMAC前にmemory/CPUを枯渇させる。
- 改善(to-be): Hono middlewareでroute別Content-Length+stream hard limit、IP/identity token bucketを実装。既定: JSON 1MiB、XLSX 10MiB、chat 256KiB。proxyにも同値以下を設定。
- 許可ファイル/スコープ: `packages/server/src/http/`, `packages/web/src/app/api/`, `packages/*/tests/`, `runbooks/`
- 禁止事項: 共通Executor Contractに加え、Content-Lengthだけ信頼、auth後limit、dev proxy限定、依存追加は承認なし禁止。
- 前提/停止条件: proxy/platform設定がTASK-PRG017と一致しなければSTOP。
- 完了条件(DoD、チェックボックス):
  - [ ] chunked/偽Content-Length oversized requestが413か429でbody parse前拒否
  - [ ] 正当上限内request regression pass
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: Hono app.request/Web route testsでlimit/rate cases pass。
  - requires-real-env: staging proxyへburst/oversizeを送りmemory/latency/429をPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-011/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG017, TASK-PRG025
- 仕様トレース: 新規security/NFR仕様ID採番が必要。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG012: GitHub App installation token providerへ移行する
- 対応所見: PRG-012
- 観点(surface / lens): 実装 / セキュリティ
- 現状(as-is): `index.ts:181-184` は未検証のoptional GITHUB_TOKEN fallback。
- 精査で判明した欠陥: credentialなしでもready、長期/broad token利用とrotation漏れ。
- 改善(to-be): GitHub App JWT→installation token providerを標準化し、owner/repo単位cacheはexpiry前更新。productionでGITHUB_TOKEN fallbackを起動拒否。
- 許可ファイル/スコープ: `packages/shared/src/clients/`, `packages/server/src/auth/`, `packages/server/src/config.ts`, `packages/server/tests/`, `docs/reference/`
- 禁止事項: 共通Executor Contractに加え、PAT fallback、token値log/audit、scope不明token、ready成功。
- 前提/停止条件: App ID/private key/installation IDのownerとsecret storeがTASK-PRG018で決まらなければBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] missing/expired/wrong-installation credentialでstartup/readiness failure
  - [ ] token refreshとrepo scope unit tests pass
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: shared client + server config tests → pass。
  - requires-real-env: staging GitHub Appでallowed repo成功/other repo拒否/rotationをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-012/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG017, TASK-PRG018
- 仕様トレース: DevOps SPEC-INT-061。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG013: Web PostgreSQL poolをprocess singletonへ統合する
- 対応所見: PRG-013
- 観点(surface / lens): 実装 / 信頼性
- 現状(as-is): `packages/web/src/app/dashboard/page.tsx:55` ほか8箇所が`new pg.Pool`、共有end/timeoutなし。
- 精査で判明した欠陥: request/reloadごとにdefault poolが増えDB接続を枯渇。
- 改善(to-be): `packages/web/src/server/db.ts` のlazy singleton poolへ全route/pageを集約しserverと同じmax/timeoutsをconfig化。test注入はPgQueryable維持。
- 許可ファイル/スコープ: `packages/web/src/server/`, `packages/web/src/app/`, `packages/web/tests/`
- 禁止事項: 共通Executor Contractに加え、route別pool、globalThis無型cast、testで実DB強制、pool limit無制限。
- 前提/停止条件: Next.js runtimeがNodeであること。Edge化要求が出たらSTOP。
- 完了条件(DoD、チェックボックス):
  - [ ] production `new pg.Pool` callsiteがdb.tsの1件のみ
  - [ ] 8 callerのDI/close/config tests pass
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: `pnpm --filter @aiops/web run test` とtypecheck → pass。
  - requires-real-env: staging負荷でpool totalが設定max以下をPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-013/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG001, TASK-PRG017
- 仕様トレース: 新規DB capacity NFR ID採番が必要。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG014: coding-task dispatchとcallbackをrecoverableにする
- 対応所見: PRG-014
- 観点(surface / lens): 実装 / 信頼性
- 現状(as-is): `codingTasks.ts:168-184` はGitHub dispatch後DB running、workflow curlは-fなし、confirm token期限なし。
- 精査で判明した欠陥: 外部成功/DB失敗でqueued再dispatch、callback rejectでもgreen、古いlinkが有効。
- 改善(to-be): DBにdispatching outboxをtransaction insertしworkerがdispatch、delivery ID/run IDを相関。callbackは`curl -fsS`、tokenはnonce+expiry+single-use。
- 許可ファイル/スコープ: `packages/server/src/http/routes/`, `packages/server/src/db/`, `.github/workflows/coding-task.yml`, `packages/server/tests/`, `runbooks/`
- 禁止事項: 共通Executor Contractに加え、外部APIをDB transaction内で呼ぶ、期限なしtoken、callback HTTP status無視。
- 前提/停止条件: schema変更はTASK-PRG001/009方式に従う。
- 完了条件(DoD、チェックボックス):
  - [ ] DB failure/retryでworkflow dispatch最大1回
  - [ ] expired/replayed tokenとnon-2xx callbackを拒否
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: ephemeral PG outbox + route/state tests、workflow shell test → pass。
  - requires-real-env: staging GitHub dispatch/callback障害注入とreconcileをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-014/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG001, TASK-PRG009, TASK-PRG012
- 仕様トレース: ADR-0006 / AC-002b。outbox/expiry AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG015: dead-letter queueを可視化し安全に再処理する
- 対応所見: PRG-015
- 観点(surface / lens): 実装 / 信頼性
- 現状(as-is): `eventsRepo.ts:237-244` はdeadをmetric除外し、registryは0固定。replay tool/runbookなし。
- 精査で判明した欠陥: poison eventが見えず、原因修正後も回復不能。
- 改善(to-be): dead count/age metric、redacted list/detail CLI、reason必須のsingle/batch requeueを追加。payloadは出力時sanitize、audit append。
- 許可ファイル/スコープ: `packages/server/src/db/`, `packages/server/src/observability/`, `packages/server/src/cli/`, `packages/server/tests/`, `runbooks/`
- 禁止事項: 共通Executor Contractに加え、dead payload全量log、DB手動UPDATEを通常手順、attempt reset無監査。
- 前提/停止条件: operator auth/role未決ならCLIはDB role限定でBLOCKED記載。
- 完了条件(DoD、チェックボックス):
  - [ ] dead count/oldest metricが実rowと一致
  - [ ] requeueがreason/audit/attempt policyを強制
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: eventsRepo/metrics/CLI tests + ephemeral PG → pass。
  - requires-real-env: staging poison event→dead→repair→requeueをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-015/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG001, TASK-PRG030, TASK-SPC010, TASK-SPC011
- 仕様トレース: 新規DLQ運用SPEC/AC採番が必要。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG016: backup・PITR・restore drillを実行可能にする
- 対応所見: PRG-016
- 観点(surface / lens): 文書 / 運用性
- 現状(as-is): `runbooks/database-migrations.md:39-41` はbackup/PITR要求だけで手順/RPO/RTOなし。
- 精査で判明した欠陥: corruption/region lossから復旧できる証拠がない。
- 改善(to-be): Azure Database for PostgreSQL Flexible Serverのgeo backup/PITRを標準化し、RPO15分/RTO4時間を初期目標、quarterly isolated restore drillとowner/escalationをrunbook化。
- 許可ファイル/スコープ: `runbooks/`, `docs/adr/`, `verification/`
- 禁止事項: 共通Executor Contractに加え、未実行手順をverified表示、productionへrestore、backup存在だけで完了。
- 前提/停止条件: Azure platform/RPO/RTO owner承認がなければBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] runbookに前提/command/rollback/validation/owner/頻度
  - [ ] 最新drill evidenceがRPO/RTO内
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: Markdown command/link lintとrunbook checklist test → pass。
  - requires-real-env: 隔離DBへPITR restore、row/schema/audit整合と所要時間をPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-016/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG001, TASK-PRG025
- 仕様トレース: 新規RPO/RTO/DR仕様ID採番が必要。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG017: Azure production topologyとupgrade経路を正典化する
- 対応所見: PRG-017
- 観点(surface / lens): 文書 / 運用性
- 現状(as-is): `docs/adr/0003-devops-runtime.md:34-49` はAWS/Azure未決、deploy/IaC/TLS/network/upgradeなし。
- 精査で判明した欠陥: sourceからsecured serviceへ再現可能に到達できない。
- 改善(to-be): Azure Container Apps + ACR + PostgreSQL Flexible Server + Key Vault + Azure Monitorを決定ADR/IaC正典とし、private network/TLS/scale/rollout/rollback/upgrade matrixを固定。
- 許可ファイル/スコープ: `docs/adr/`, `runbooks/`, `infra/`, `packages/server/Dockerfile`
- 禁止事項: 共通Executor Contractに加え、複数cloud同時対応、portal手作業だけ、latest image、worker独断のplatform変更。
- 前提/停止条件: ownerがAzure案を拒否したらコード/IaCを書かずplatform decisionをBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] ADR acceptedでresource/data/network/identity diagramとowner記載
  - [ ] IaC validate/planがdriftなし
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: IaC fmt/validate/security lint（選定toolのlocked version）→ pass。
  - requires-real-env: staging subscriptionへdeploy/upgrade/rollbackしoutputsをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-017/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG003, TASK-PRG025
- 仕様トレース: ADR-0003/0005。production topology AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG018: secret供給・分離・rotationを運用化する
- 対応所見: PRG-018
- 観点(surface / lens): 文書 / セキュリティ
- 現状(as-is): `docs/reference/configuration.md:3-69` はenv一覧のみで`.env.example`なし、`packages/server/src/config.ts:83-89` はcallback secret二用途。
- 精査で判明した欠陥: owner/store/rotation/least privilegeとzero-downtime更新が未定。
- 改善(to-be): Azure Key Vault + managed identityを標準とし、秘密ごとにowner/consumer/cadenceをmatrix化。callback HMACとBearerを分離しdual-key rotationを実装計画に含め、名前だけの`.env.example`を作る。
- 許可ファイル/スコープ: `docs/reference/`, `runbooks/`, `packages/server/src/config.ts`, `.github/workflows/`, `.env.example`
- 禁止事項: 共通Executor Contractに加え、secret値/実tokenをcommit、1 key多用途、manual exportをproduction標準。
- 前提/停止条件: Key Vault/managed identity不採用なら代替decisionをowner承認までBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] 全config secretがowner/store/cadence/consumerと対応
  - [ ] dual-key rotation/revocation testsとenv name drift check pass
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: server config tests + env-doc drift script → pass。
  - requires-real-env: stagingで各主要secretを無停止rotationしold key拒否をPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-018/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG017, TASK-PRG025
- 仕様トレース: DevOps REQ-032 / SPEC-INT-070。secret lifecycle AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG019: Teams app packageをinstallableにする
- 対応所見: PRG-019
- 観点(surface / lens): 文書 / 文書実効性
- 現状(as-is): `docs/teams-app/manifest.json:5-52` はplaceholder、icons/privacy/terms/install flowなし。
- 精査で判明した欠陥: packageをvalidate/installできずonboarding不能。
- 改善(to-be): manifest値をenvironment build input化し、192x192 color/32x32 transparent outline、privacy/terms routes、versioned zip builderとTeams validation手順を追加。
- 許可ファイル/スコープ: `docs/teams-app/`, `packages/web/src/app/`, `scripts/`, `runbooks/`
- 禁止事項: 共通Executor Contractに加え、placeholderをproduction zipへ残す、RSC権限拡大、手zip、法務未承認文面を確定扱い。
- 前提/停止条件: legal privacy/terms URLとEntra App ID未承認ならpackage publishをBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] manifest schema/placeholder/icon dimension check pass
  - [ ] generated zipがTeams validator合格
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: package builder test + manifest JSON schema test → pass。
  - requires-real-env: staging tenant/teamへinstall/uninstallしRSC scopeをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-019/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG017, TASK-PRG018
- 仕様トレース: ADR-0005 / SPEC-INT-001。Teams packaging AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG020: XLSX API/security文書を実装契約へ同期する
- 対応所見: PRG-020
- 観点(surface / lens): 文書 / 文書実効性
- 現状(as-is): `docs/reference/http-api.md:19-21` とguideはHMAC/allowlistを欠き実装と矛盾。
- 精査で判明した欠陥: operatorが正しく署名できずsecurity boundaryを誤認。
- 改善(to-be): raw-byte HMAC、header、allowlist、confirm、status code、safe curl生成例をreference/guide/configへ一元記載しcontract testでrouteと同期。
- 許可ファイル/スコープ: `docs/reference/`, `docs/guide/`, `packages/server/tests/`, `scripts/`
- 禁止事項: 共通Executor Contractに加え、実secret例、dry-run無認証表記、docsだけでroute契約を変える。
- 前提/停止条件: current route contractを正とする。変更要求はTASK-PRG018へ戻してSTOP。
- 完了条件(DoD、チェックボックス):
  - [ ] XLSX2変数と署名/allowlist/confirmが全3文書に一致
  - [ ] docs exampleをfixture secretで実行し期待status
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: docs snippet test + xlsx route tests → pass。
  - requires-real-env: staging endpointでsigned dry-run/execute/denyをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-020/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG011, TASK-PRG018
- 仕様トレース: REQ-037 / SPEC-INT-063 / AC-037-1。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG021: manual opsを現行制御で再構築する
- 対応所見: PRG-021
- 観点(surface / lens): 文書 / 文書実効性
- 現状(as-is): `runbooks/manual-ops.md:12-61` はecho deploy、継続通知、未適用REVOKEを稼働済みと記載。
- 精査で判明した欠陥: incident responderが効かない/危険な操作を実施する。
- 改善(to-be): TASK-PRG003/008/009後のAPI/workflowだけを手順化し、raw SQL grantを禁止、各手順にowner/前提/rollback/期待auditを付けstaging drillする。
- 許可ファイル/スコープ: `runbooks/manual-ops.md`, `runbooks/`, `verification/`
- 禁止事項: 共通Executor Contractに加え、未検証command、raw INSERT/UPDATEを通常運用、未実装通知を記載。
- 前提/停止条件: 依存task未受入なら文書確定せずBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] 全commandが実在しexpected status/auditを明記
  - [ ] staging tabletop/drill evidenceが全手順に対応
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: runbook command existence/link checker → pass。
  - requires-real-env: stagingでfailsafe/deploy/role incident drillを行いPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-021/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG003, TASK-PRG008, TASK-PRG009
- 仕様トレース: DevOps SPEC-INT-060 / REQ-029。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG022: verification reportをcommit別CI証跡から生成する
- 対応所見: PRG-022
- 観点(surface / lens): 文書 / 検証完全性
- 現状(as-is): `verification/VERIFICATION_REPORT.md:72-115,203-224` に359/750/985相当の矛盾とobsolete status。
- 精査で判明した欠陥: go-live判断が再現不能な古い数字に依存。
- 改善(to-be): CI artifactsからpackage別test count/coverage/status/commitを生成し、historical sectionを分離。手編集のauthoritative countを禁止。
- 許可ファイル/スコープ: `verification/`, `scripts/`, `.github/workflows/ci.yml`, `package.json`
- 禁止事項: 共通Executor Contractに加え、固定件数、過去結果の上書き、Web test skipをgreen表示。
- 前提/停止条件: TASK-PRG027/033/038のcanonical CI command確定後に生成formatを固定。
- 完了条件(DoD、チェックボックス):
  - [ ] reportのcommit/test countがCI artifactと一致
  - [ ] current/historical/requires-real-envが機械区分
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: report generator fixture testとfresh CI artifact diff=0。
  - requires-real-env: PRG-031 ledgerのexternal evidence linkをredacted参照し、未実施はopen表示。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-022/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG027, TASK-PRG033, TASK-PRG038
- 仕様トレース: verification governance ID新規採番が必要。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG023: canonical requirement corpusをrepositoryへ導入する
- 対応所見: PRG-023
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): T32確定値では仕様IDは295件（PrjOps 156 / DevOps 139、ISS・TOBE・ASMを含む）、カタログ定義行32件、索引済み定義31件、未定義264件（89.5%）である。ADRは`docs/adr/0001-*.md`〜`0014-*.md`の14本だが`AGENTS.md`の参照リストはADR-0014を欠落する。REQ欠番はPrjOps 8件（022〜029）とDevOps 17件（004〜009、013、014、032〜040）の計25件で、DevOps `REQ-032` は孤児定義である。
- 精査で判明した欠陥: 264件の意味/edge/conflict/changeをrepo内で監査できず、欠番、ADR参照漏れ、外部原本不在を実装workerが独断で補う余地がある。
- 改善(to-be): T32受入済み成果物 `.orchestration/audit/specification_content_audit.md` と `.orchestration/audit/spec_reconstruction.md` を直接入力にする。入手・利用可能な外部原本はnamespace/id/text/source locator/version/owner/statusへ正規化する。外部原本が入手不能なIDはT32逆再構成を現状記述として取り込み、確信度と根拠を保持したままSpecification Ownerが要求として承認する。ownerが復元を却下または復元不能と判定したIDは、ownerが新たなnormative定義を書くまでBLOCKEDのままにする。重複IDはsystem namespaceで分離する。
- 許可ファイル/スコープ: `docs/spec/`, `packages/traceability/spec-ids/`, `packages/traceability/src/`
- 禁止事項: 共通Executor Contractに加え、出典なしparaphraseを正典化、PrjOps/DevOps同番号混同、権利不明原本commit、存在しない外部原本へのlocatorだけで完了、実装どおりの復元を正しい要求として追認。
- 前提/停止条件: T32が受入済みで正本2成果物が非空かつreviewer承認済みであり、Specification Ownerが指名済みであること。未充足なら着手せずBLOCKED。source利用許諾が無い場合もlocatorで停止せず、T32逆再構成とowner判定の代替経路を使う。
- 完了条件(DoD、チェックボックス):
  - [ ] 295件すべてが、利用可能な外部原本の正典text、T32逆再構成に対するSpecification Owner承認済みtext、またはownerが新規作成したnormative textを持ち、264未定義IDが1件ずつ照合できる。復元不能・owner却下はこのcheckboxを閉じずTASK-PRG023をBLOCKEDに保つ
  - [ ] PrjOps 156 / DevOps 139、カタログ定義行32 / 索引済み定義31 / 未定義264（89.5%）、ADR 14（0001〜0014）の件数gateがpassし、PrjOps 8件 + DevOps 17件のREQ欠番計25件、孤児定義DevOps `REQ-032`、AGENTS.mdのADR-0014欠落にowner dispositionがある
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: traceability corpus schema/uniqueness tests → pass。
  - requires-real-env: 原本ownerがsample突合・版承認しPRG-031へsign-off。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-023/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): T32（受入済）, TASK-SPC001, TASK-SPC002, TASK-SPC003, TASK-SPC006, TASK-SPC007
- 仕様トレース: 仕様管理meta-spec ID新規採番が必要。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG024: traceabilityをsemantic mappingへ置換する
- 対応所見: PRG-024
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): T32確定値の仕様ID 295件（PrjOps 156 / DevOps 139、ISS・TOBE・ASMを含む）のうちカタログ定義行は32件、索引済み定義31件、未定義264件（89.5%）である一方、`verifyTraceability.ts:84-98` はString.includesであり、AC/test欠落をhard failしない。ADRは14本（0001〜0014）。
- 精査で判明した欠陥: commentにIDがあるだけでbehavior/testなしでもgreenになり、未定義264件、system間の同番号、部分文字列、復元不能IDをsemanticに区別できない。
- 改善(to-be): T32受入済みの `.orchestration/audit/specification_content_audit.md` と `.orchestration/audit/spec_reconstruction.md` を直接入力にし、TASK-PRG023 corpusとexplicit mapping fileでrequirement→implementation symbol→test case→evidence typeを管理する。testable ACはtest必須、operational ACはapproved evidence必須、復元不能IDはpassではなくBLOCKEDとする。
- 許可ファイル/スコープ: `packages/traceability/src/`, `packages/traceability/spec-ids/`, `packages/traceability/tests/`, `docs/spec/`
- 禁止事項: 共通Executor Contractに加え、lexical fallbackをpass条件、全ACを非testable扱い、missingをwarning化。
- 前提/停止条件: T32が受入済みで正本2成果物が非空かつreviewer承認済みであること、およびTASK-PRG023 corpus schemaとowner dispositionが確定していること。未充足ならmapping formatを独断確定せずBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] fake comment-only mappingがgate failure
  - [ ] namespaced 295 IDすべてにtyped edge、種別上の非適用理由、またはowner承認済みBLOCKED exceptionがあり、PrjOps 156 / DevOps 139、カタログ定義行32 / 索引済み定義31 / 未定義264、ADR 14の入力件数が一致
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: traceability unit fixtures + `mise run traceability` → pass。
  - requires-real-env: operational evidence exceptionsをowner reviewしPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-024/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): T32（受入済）, TASK-PRG023, TASK-SPC005, TASK-SPC006, TASK-SPC007, TASK-SPC008
- 仕様トレース: traceability meta-spec ID新規採番が必要。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG025: production NFRとgo-live acceptanceを数値化する
- 対応所見: PRG-025
- 観点(surface / lens): 仕様 / 運用性
- 現状(as-is): `README.md:8,109-112` の50/100 project claimにRPO/RTO/latency/concurrency/cost/rollback等の合否基準なし。
- 精査で判明した欠陥: production readinessを客観判定できず各workerが設計値を独断する。
- 改善(to-be): T32受入済みの `.orchestration/audit/specification_content_audit.md` と `.orchestration/audit/spec_reconstruction.md` を直接入力にし、仕様の矛盾・曖昧・欠落を解消した上で、初期値をavailability 99.9%、RPO 15分、RTO 4h、API p95 1s、webhook ack p95 2s、50 steady/100 design、rollback 15分、月次cost budget owner承認制としてNFR catalog化する。承認でのみ変更する。
- 許可ファイル/スコープ: `docs/spec/`, `docs/adr/`, `runbooks/production-gates.md`
- 禁止事項: 共通Executor Contractに加え、測定不能な「高速/十分」、workerの閾値変更、実測なしgo-live。
- 前提/停止条件: T32が受入済みで正本2成果物が非空かつreviewer承認済みであること。未充足ならNFRを発明せずBLOCKED。business ownerが初期値を拒否した場合、代替値の署名まで全依存taskをBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] 各NFRにmetric/threshold/window/owner/evidence source
  - [ ] PRG-029 workloadとPRG-031 checklistが全NFRを参照
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: NFR schema completeness/link test → pass。
  - requires-real-env: staging/load/DR結果を各thresholdへ紐付けPRG-031で承認。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-025/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): T32（受入済）, TASK-PRG023, TASK-SPC013, TASK-SPC014, TASK-SPC015, TASK-SPC016, TASK-SPC017, TASK-SPC018, TASK-SPC019, TASK-SPC020, TASK-SPC021
- 仕様トレース: 新規NFR REQ/AC一式を採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済


### TASK-PRG026: schema/repositoryを実PostgreSQLで検証する
- 対応所見: PRG-026
- 観点(surface / lens): 検証 / 検証完全性
- 現状(as-is): `verification/VERIFICATION_REPORT.md:28-46` の環境にはPostgreSQLがなく、repository testsはquery mock中心。
- 精査で判明した欠陥: PRG-001/009級SQL不良がCI green。
- 改善(to-be): CI service PG16へfresh schema+全migration+role denial+repo CRUD/concurrencyを適用するintegration suiteを追加。
- 許可ファイル/スコープ: `.github/workflows/`, `packages/server/tests/integration/`, `packages/devops/src/db/`, `scripts/`
- 禁止事項: 共通Executor Contractに加え、SQLite代替、mock DBでintegration命名、migration一部省略。
- 前提/停止条件: CI service container不可ならrunner方針をBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] fresh/upgrade/role/partition tests pass
  - [ ] CIがPG test failureでred
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: CI PG16 jobとlocal `DATABASE_URL` test → pass。
  - requires-real-env: staging supported versionで同suiteを実行しPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-026/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG001, TASK-PRG009, TASK-SPC012
- 仕様トレース: DB verification AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG027: production composition・container・workflowをCI検証する
- 対応所見: PRG-027
- 観点(surface / lens): 検証 / 検証完全性
- 現状(as-is): `.github/workflows/ci.yml:21-27` はDocker/hosted workflow/index/mainを実行せず、`packages/server/Dockerfile:17` はWeb build失敗をmask。
- 精査で判明した欠陥: critical wiringとartifact不良がgreen。
- 改善(to-be): composition startup test、Docker build/start health smoke、action/workflow lintをcanonical CIへ追加しWeb build `|| echo`を削除。
- 許可ファイル/スコープ: `.github/workflows/`, `packages/server/Dockerfile`, `packages/server/tests/`, `scripts/`
- 禁止事項: 共通Executor Contractに加え、build failure mask、source factoryだけの代替、Docker未実行をpass。
- 前提/停止条件: CI Docker利用不可ならrunner承認までBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] image build/start/health/ready smoke pass
  - [ ] 全workflow/action lint/local ref check pass
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: CI Docker + composition tests → pass。
  - requires-real-env: staging image digestをdeployしhealth/terminationをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-027/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG001, TASK-PRG003, TASK-PRG006, TASK-PRG017, TASK-PRG026
- 仕様トレース: production composition AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG028: 実環境E2Eを完遂し証跡化する
- 対応所見: PRG-028
- 観点(surface / lens): 検証 / 検証完全性
- 現状(as-is): `verification/VERIFICATION_REPORT.md:39-50` と `runbooks/e2e-real-environment.md:115-125` はauth/PG/GitHub/Teams/Graph/LLMを未実施。
- 精査で判明した欠陥: identity・scope・delivery・provider behaviorが未証明。
- 改善(to-be): 専用staging tenant/org/DBでredacted end-to-end matrixを実行しcommit/environment/operator/timeをledger化。
- 許可ファイル/スコープ: `runbooks/e2e-real-environment.md`, `verification/`, `.orchestration/evidence/`
- 禁止事項: 共通Executor Contractに加え、production tenant、mockをE2E扱い、secret/raw payload保存。
- 前提/停止条件: 全依存task受入とstaging credentialが無ければOPEN/BLOCKEDのまま。
- 完了条件(DoD、チェックボックス):
  - [ ] 全E2E rowにpass/fail/evidence
  - [ ] negative auth/tenant/replay cases pass
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: runbook/evidence schema checker → pass。
  - requires-real-env: 記載matrixをstagingで実行しPRG-031へ集約。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-028/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG003, TASK-PRG004, TASK-PRG005, TASK-PRG006, TASK-PRG008, TASK-PRG012, TASK-PRG017, TASK-PRG018, TASK-PRG026, TASK-PRG027, TASK-PRG032, TASK-PRG033, TASK-PRG039, TASK-PRG044, TASK-PRG048, TASK-PRG049, TASK-PRG050
- 仕様トレース: T14 / real-env E2E AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG029: load・capacity・failure injectionをNFR gate化する
- 対応所見: PRG-029
- 観点(surface / lens): 検証 / 検証完全性
- 現状(as-is): `packages/devops/tests/deployMonitor.test.ts:12-86` はpure array testで、traffic harnessや50/100 project測定なし。
- 精査で判明した欠陥: scale/SLO/retry/resource設定に実測根拠なし。
- 改善(to-be): k6等の新規依存はowner承認後のみ導入し、50 steady/100 design、webhook burst、DB exhaustion、dependency outage、soakをTASK-PRG025 thresholdで判定。
- 許可ファイル/スコープ: `verification/load/`, `scripts/`, `.github/workflows/`, `runbooks/`
- 禁止事項: 共通Executor Contractに加え、pure function arrayをload test扱い、閾値後付け、production負荷。
- 前提/停止条件: tool依存追加承認とisolated stagingが無ければBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] workload/version/threshold再現可能
  - [ ] steady/burst/soak/failure結果がNFR合格
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: small deterministic smoke workloadをCIでpass。
  - requires-real-env: staging full workloadとcapacity reportをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-029/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG025, TASK-PRG027, TASK-PRG041, TASK-PRG046, TASK-PRG047, TASK-SPC019
- 仕様トレース: NFR load AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG030: SLO収集・alert・on-callを配線する
- 対応所見: PRG-030
- 観点(surface / lens): 実装 / 運用性
- 現状(as-is): `runbooks/observability-slo.md:18-24` はprose条件のみでscrape/rule/receiver/dashboardなし。
- 精査で判明した欠陥: 障害がoperatorへ届かない。
- 改善(to-be): Azure Monitor managed Prometheusへprivate scrape、recording/burn-rate alert、Action Group receiver、dashboard、owner/ack/escalationをIaC化。
- 許可ファイル/スコープ: `infra/`, `runbooks/observability-slo.md`, `packages/server/src/observability/`, `verification/`
- 禁止事項: 共通Executor Contractに加え、public scrape、alert receiverなし、secret label。
- 前提/停止条件: TASK-PRG017 platformとTASK-PRG025 SLO承認が必要。
- 完了条件(DoD、チェックボックス):
  - [ ] IaC rule/receiver/dashboard validate
  - [ ] synthetic alertがtest receiverへ到達
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: metrics/rule unit + IaC validate → pass。
  - requires-real-env: staging burn-rate/failure alert deliveryをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-030/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG017, TASK-PRG025
- 仕様トレース: SPEC-INT-010; SLO AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG031: evidence-backed go-live checklistを最終gateにする
- 対応所見: PRG-031
- 観点(surface / lens): 文書 / 運用性
- 現状(as-is): `runbooks/production-gates.md:1-31` はCODEOWNERS/token/gitleaksのみ。
- 精査で判明した欠陥: critical prerequisitesをskipできる。
- 改善(to-be): PRG 50件 + SPC 26件の全76 taskをowner/evidence/date/env/approver/exception-expiry付きledgerへ集約し、CRITICAL/HIGH openはNO-GO、MED exceptionは期限/owner必須。
- 許可ファイル/スコープ: `runbooks/production-gates.md`, `verification/`, `.orchestration/evidence/`
- 禁止事項: 共通Executor Contractに加え、evidenceなしcheck、永久exception、worker自己承認。
- 前提/停止条件: 全先行task evidenceが揃うまで受入済にしない。
- 完了条件(DoD、チェックボックス):
  - [ ] 76 task全rowがclosedかapproved exception
  - [ ] PRG/SPCを合算したCRITICAL/HIGH open=0
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: ledger schema/link/expiry validator → pass。
  - requires-real-env: CAB/ownerが全real-env evidenceをreview/sign-off。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-031/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG001〜TASK-PRG030, TASK-PRG032〜TASK-PRG050, TASK-SPC001〜TASK-SPC026
- 仕様トレース: go-live governance AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG032: operator onboardingとproject provisioningを自動化する
- 対応所見: PRG-032
- 観点(surface / lens): 文書 / 文書実効性
- 現状(as-is): `docs/teams-app/README.md:26` は非存在install flowを参照し、roles/recipients/channels/provider/partition作成flowなし。
- 精査で判明した欠陥: zeroからleast-privilege working projectを作れない。
- 改善(to-be): idempotent provision/deprovision CLI+runbookでdry-run/approval/audit/rollbackを提供。env templateはTASK-PRG018を使用。
- 許可ファイル/スコープ: `packages/server/src/cli/`, `packages/server/src/db/`, `runbooks/`, `docs/teams-app/`, `packages/server/tests/`
- 禁止事項: 共通Executor Contractに加え、portal-only、raw SQL通常手順、fixture provider、rollbackなし。
- 前提/停止条件: TASK-PRG004/005/017/018 contract受入済み。
- 完了条件(DoD、チェックボックス):
  - [ ] second provisionはno-opでaudit
  - [ ] deprovision/revoke/rollback tests pass
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: CLI DI + ephemeral PG tests → pass。
  - requires-real-env: staging projectをprovision→use→deprovisionしPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-032/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG004, TASK-PRG005, TASK-PRG017, TASK-PRG018
- 仕様トレース: provisioning SPEC/AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG033: Web全testとcoverageをhosted CI必須にする
- 対応所見: PRG-033
- 観点(surface / lens): 検証 / 検証完全性
- 現状(as-is): `packages/web/package.json:7-13` はtestのみ、`.github/workflows/ci.yml:21-27` はtest:coverageだけなので152 testsを一切実行しない。
- 精査で判明した欠陥: auth/persona/data/chat regressionがhosted gate外。
- 改善(to-be): Webへtest:coverageを追加しrisk-based global/per-file threshold、CIでexplicit Web test/coverageを実行。
- 許可ファイル/スコープ: `packages/web/package.json`, `packages/web/vitest.config.*`, `.github/workflows/ci.yml`, `packages/web/tests/`
- 禁止事項: 共通Executor Contractに加え、--if-present skip、threshold 0、test除外拡大。
- 前提/停止条件: current 152 tests baselineを減らす必要が出たらSTOP。
- 完了条件(DoD、チェックボックス):
  - [ ] CI logにWeb test count>=152
  - [ ] critical route/server files threshold enforce
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: `pnpm --filter @aiops/web run test:coverage` → pass。
  - requires-real-env: 不要。hosted CI run URLをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-033/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG027
- 仕様トレース: CI verification AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG034: metrics endpointをprivateに隔離する
- 対応所見: PRG-034
- 観点(surface / lens): 実装 / セキュリティ
- 現状(as-is): `metrics.ts:10` はpublic Hono app無認証。
- 精査で判明した欠陥: telemetry reconnaissance/scrape abuse。
- 改善(to-be): 127.0.0.1別listenerまたはprivate ingress専用routeへ分離。標準はprivate ACA ingress + managed scrape identity。
- 許可ファイル/スコープ: `packages/server/src/http/`, `packages/server/src/index.ts`, `infra/`, `packages/server/tests/`
- 禁止事項: 共通Executor Contractに加え、shared public port無認証、query token、metric labelへPII。
- 前提/停止条件: TASK-PRG017/030 network/scrape方式が必要。
- 完了条件(DoD、チェックボックス):
  - [ ] public ingress /metrics非到達
  - [ ] private authenticated scrape成功
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: app routing/auth tests + IaC policy validate。
  - requires-real-env: staging public deny/private scrapeをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-034/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG017, TASK-PRG030
- 仕様トレース: SPEC-INT-010; metrics access AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG035: DORA前週deltaを実データから計算する
- 対応所見: PRG-035
- 観点(surface / lens): 実装 / 仕様完全性
- 現状(as-is): `AGT_RPT.ts:96-111` は全delta literal 0。
- 精査で判明した欠陥: 欠測/変化をno changeと表示。
- 改善(to-be): current/previous typed inputsからdelta、欠測はNA。period/window/unitをTASK-PRG025へ固定。
- 許可ファイル/スコープ: `packages/devops/src/agents/`, `packages/devops/src/lib/`, `packages/devops/tests/`
- 禁止事項: 共通Executor Contractに加え、欠測=0、LLM計算、期間違い比較。
- 前提/停止条件: previous source未提供なら表示をNAにしてBLOCKED evidence。
- 完了条件(DoD、チェックボックス):
  - [ ] positive/negative/no-data delta tests
  - [ ] report no literal delta zero
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: devops DORA/report tests → pass。
  - requires-real-env: staging2期間snapshotと表示一致をPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-035/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG007, TASK-PRG040
- 仕様トレース: DevOps REQ-023 / AC-023a/b。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG036: audit partition retentionを自動運用する
- 対応所見: PRG-036
- 観点(surface / lens): 実装 / 運用性
- 現状(as-is): `packages/devops/src/db/schema.sql:213-216` のpartition create/dropはcomment、PrjOps5年storage未結線。
- 精査で判明した欠陥: 月境界write停止・retention違反。
- 改善(to-be): advisory lock付き月次taskで3か月先create、13か月DevOps drop、5年PrjOps policyを別table/storeに実装しalert。
- 許可ファイル/スコープ: `packages/devops/src/db/`, `packages/server/src/scheduler/`, `packages/server/tests/integration/`, `runbooks/`
- 禁止事項: 共通Executor Contractに加え、cron手作業のみ、required evidence drop、同一retention混同。
- 前提/停止条件: TASK-PRG001/009/016/026受入済み。
- 完了条件(DoD、チェックボックス):
  - [ ] concurrent lifecycle task idempotent
  - [ ] boundary insert/drop/hold tests pass
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: PG16 time-shift integration tests → pass。
  - requires-real-env: staging month rollover/retention dry-runをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-036/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG001, TASK-PRG009, TASK-PRG016, TASK-PRG026, TASK-SPC013, TASK-SPC014
- 仕様トレース: REQ-028 / ADR-0001。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG037: dependency advisoryとSBOMをCI gate化する
- 対応所見: PRG-037
- 観点(surface / lens): 検証 / セキュリティ
- 現状(as-is): `.github/workflows/ci.yml:29-45` はdependency auditなしで、2026-07-10実測は3 moderate+1 low。
- 精査で判明した欠陥: advisory reachability/owner/expiryを継続判断しない。
- 改善(to-be): production audit+SBOMをCI生成し、high/critical fail、moderateはowner/expiry/reachability exception必須。既存4件を個別triage。
- 許可ファイル/スコープ: `.github/workflows/`, `scripts/`, `verification/security/`, `package.json`
- 禁止事項: 共通Executor Contractに加え、audit無効化、severity一括ignore、期限なしexception。
- 前提/停止条件: 新tool依存はowner承認、可能ならpnpm nativeを優先。
- 完了条件(DoD、チェックボックス):
  - [ ] high fixtureでgate red
  - [ ] 4 advisoryにowner/reachability/expiry
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: audit policy fixture + SBOM generation → pass。
  - requires-real-env: 不要。CI artifact/signatureをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-037/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG006, TASK-PRG033
- 仕様トレース: DevOps REQ-032。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG038: canonical verification commandとCI parityを修復する
- 対応所見: PRG-038
- 観点(surface / lens): 文書 / 文書実効性
- 現状(as-is): `package.json:17` のverify:allは不存在script、`.github/workflows/ci.yml:21-27` はlint/format/Web test欠落。
- 精査で判明した欠陥: one-command verificationとlocal/remote parityが虚偽。
- 改善(to-be): `mise run ci`を唯一のcanonical commandとしverify:allはalias化、hosted CIも同commandを呼ぶ。Web explicit gateはTASK-PRG033。
- 許可ファイル/スコープ: `package.json`, `.mise.toml`, `.github/workflows/ci.yml`, `README.md`, `AGENTS.md`, `verification/`
- 禁止事項: 共通Executor Contractに加え、重複script、存在しないcommand、CIだけskip。
- 前提/停止条件: TASK-PRG033のWeb gateをcanonical ciへ含める。
- 完了条件(DoD、チェックボックス):
  - [ ] pnpm verify:all/mise ci/hosted jobが同stage
  - [ ] command existence test pass
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: local canonical command + CI workflow fixture → pass。
  - requires-real-env: 不要。hosted run URLをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-038/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG033, TASK-SPC004
- 仕様トレース: verification governance ID新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG039: workflow failure triage entrypointを実装配布する
- 対応所見: PRG-039
- 観点(surface / lens): 実装 / 運用性
- 現状(as-is): `packages/devops/src/workflows/on-workflow-failure-triage.yml:19` は不存在on-build-failure.mjsを実行。
- 精査で判明した欠陥: 初回failureでMODULE_NOT_FOUND。
- 改善(to-be): TASK-PRG002のAGT-BLD adapterを呼ぶthin entrypointを追加しinput/env validation、read-only permission、installed workflow smokeを提供。
- 許可ファイル/スコープ: `packages/devops/scripts/jobs/`, `packages/devops/src/workflows/`, `packages/devops/tests/`, `.github/workflows/`
- 禁止事項: 共通Executor Contractに加え、duplicate classifier、missing env silent、write permission拡大。
- 前提/停止条件: TASK-PRG006 CLIと045 pins受入済み。
- 完了条件(DoD、チェックボックス):
  - [ ] entrypoint existence/import/invalid env tests
  - [ ] hosted smoke reaches classifier mock once
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: node entrypoint fixture + workflow lint → pass。
  - requires-real-env: staging failed workflowでtriage notificationをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-039/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG002, TASK-PRG006, TASK-PRG045
- 仕様トレース: SPEC-INT-011 / AC-002b。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG040: incidentとticketのdata contractを分離する
- 対応所見: PRG-040
- 観点(surface / lens): 実装 / 仕様完全性
- 現状(as-is): `packages/devops/src/lib/incidentBurndown.ts:7-11` はincidentを暫定ticket扱いし、`packages/web/src/server/reportData/devopsReportData.ts:300-301` が表示。
- 精査で判明した欠陥: managerがincident-onlyを全ticket backlogと誤認。
- 改善(to-be): ticket source-of-truthとinclude/status/link contractを新規仕様化。adapter未接続時はmetric NA、incident chartは別名表示。
- 許可ファイル/スコープ: `docs/spec/`, `packages/devops/src/lib/`, `packages/web/src/server/reportData/`, `packages/*/tests/`
- 禁止事項: 共通Executor Contractに加え、暫定解釈維持、欠測0、名前だけ変更。
- 前提/停止条件: ticket system owner未決ならNA表示まで実装しadapterはBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] incident/ticket別typed inputs
  - [ ] no sourceでNA、representative adapter test pass
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: devops + Web report tests → pass。
  - requires-real-env: staging ticket source reconcileをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-040/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG004, TASK-PRG023
- 仕様トレース: ticket metric SPEC/AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG041: schedulerをreplica間single executionにする
- 対応所見: PRG-041
- 観点(surface / lens): 実装 / 信頼性
- 現状(as-is): `packages/server/src/scheduler/scheduler.ts:73-114` のguardはprocess-localで2 instanceが重複run。
- 精査で判明した欠陥: poll/renew/delivery/health side effect重複。
- 改善(to-be): task名hashのPostgreSQL advisory leaseを各run前に取得しwinnerだけ実行。healthはreplica-local probe + leader durable transitionに分離。
- 許可ファイル/スコープ: `packages/server/src/scheduler/`, `packages/server/src/db/`, `packages/server/tests/integration/`
- 禁止事項: 共通Executor Contractに加え、single replica前提、global process flag、lock保持中長時間transaction。
- 前提/停止条件: TASK-PRG001 DB availability必須。
- 完了条件(DoD、チェックボックス):
  - [ ] 2 schedulerでside effect1回
  - [ ] lease loss/crash/reacquire tests
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: PG16 two-client integration → pass。
  - requires-real-env: staging2 replica rolling deployでduplicateなしをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-041/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG001, TASK-PRG017, TASK-SPC022
- 仕様トレース: scheduler concurrency AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG042: holiday calendar horizonをfail closedにする
- 対応所見: PRG-042
- 観点(surface / lens): 実装 / 信頼性
- 現状(as-is): `packages/shared/src/calendar/jp_holidays.yaml:15-125` は2026-27だけ、`businessCalendar.ts:76-84` はverified無視/range外を平日扱い。
- 精査で判明した欠陥: holidayにschedule/risk計算を実行。
- 改善(to-be): covered years/reviewedAt/allVerified metadataをparseし、range外/未verifiedをstartup/schedule error。90日前alert。
- 許可ファイル/スコープ: `packages/shared/src/calendar/`, `packages/shared/tests/`, `packages/server/src/`, `runbooks/`
- 禁止事項: 共通Executor Contractに加え、missing date=weekday、verified無視、hardcoded延長。
- 前提/停止条件: official annual review owner未設定ならfuture yearをBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] 2028-01-10/未verified/range外がfailure
  - [ ] valid covered dates regression pass
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: shared calendar + server startup tests → pass。
  - requires-real-env: annual source review evidenceをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-042/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG025, TASK-SPC023
- 仕様トレース: SPEC-INT-054 / SPEC-INT-033。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG043: PII correction・erasure・legal holdを定義実装する
- 対応所見: PRG-043
- 観点(surface / lens): 文書 / セキュリティ
- 現状(as-is): `packages/server/src/db/channelMessagesRepo.ts:45-59` はsource deletion後もbody保持、`runbooks/channel-messages-purge.md:17-35` はproject close+13月purgeのみ。
- 精査で判明した欠陥: subject request/employee lifecycleへ応答不能。
- 改善(to-be): field inventory/lawful basis/subject lookup、body redaction、identity pseudonymization、legal hold、audit-only tombstoneをpolicy+operator command化。
- 許可ファイル/スコープ: `docs/spec/`, `runbooks/`, `packages/server/src/db/`, `packages/server/src/cli/`, `packages/server/tests/`
- 禁止事項: 共通Executor Contractに加え、audit log物理改変、無承認mass delete、display nameでsubject同定。
- 前提/停止条件: legal/privacy owner承認なしはimplementation BLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] subject lookup/correct/erase/hold tests
  - [ ] deleted body非表示かapproved hold
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: ephemeral PG lifecycle tests → pass。
  - requires-real-env: staging subject request drillをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-043/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG023, TASK-PRG025
- 仕様トレース: privacy REQ/SPEC/AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG044: standard reportにtenant/project provenanceを必須化する
- 対応所見: PRG-044
- 観点(surface / lens): 実装 / セキュリティ
- 現状(as-is): `packages/shared/src/reporting/reportSchema.ts:25-35` はscopeなし、`packages/server/src/scheduler/tasks/reportDeliveryTask.ts:100-116` がrecipient projectを捏造。
- 精査で判明した欠陥: project A detailをproject B recipientへ送信可能。
- 改善(to-be): report/slotにdomain+tenant+projectIdsを必須化しsource provenanceでfilter。unscoped detail reject、aggregateはexplicit global classification。
- 許可ファイル/スコープ: `packages/shared/src/reporting/`, `packages/server/src/scheduler/tasks/`, `packages/server/src/db/`, `packages/*/tests/`
- 禁止事項: 共通Executor Contractに加え、recipient scope後付け、文字maskだけ、legacy unscoped fallback。
- 前提/停止条件: TASK-PRG023 canonical ownership semantics必須。
- 完了条件(DoD、チェックボックス):
  - [ ] cross-project probeがmasked/rejected
  - [ ] valid scoped/global reports pass
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: shared schema + server negative delivery tests → pass。
  - requires-real-env: staging2 project/2 recipientでleakなしをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-044/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG004, TASK-PRG005, TASK-PRG023, TASK-SPC024
- 仕様トレース: AC-042-1 / SPEC-INT-069; scope AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG045: 全workflow actionをimmutable SHAへpinする
- 対応所見: PRG-045
- 観点(surface / lens): 実装 / セキュリティ
- 現状(as-is): `packages/devops/src/workflows/on-workflow-failure-triage.yml:14-15` 等はcheckout@v4/mise@v2。
- 精査で判明した欠陥: review外のmutable upstream codeを実行。
- 改善(to-be): full SHA+version commentへ統一しrepository-wide pin validatorとcontrolled update PRを追加。
- 許可ファイル/スコープ: `.github/`, `packages/devops/src/workflows/`, `scripts/`, `tests/`
- 禁止事項: 共通Executor Contractに加え、major tag、branch ref、validator対象外template。
- 前提/停止条件: SHA provenance不明ならactionを無効化しBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] all uses external refが40hex SHA
  - [ ] bad fixtureでvalidator red
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: workflow pin/local ref validator → pass。
  - requires-real-env: 不要。CI evidenceをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-045/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG003
- 仕様トレース: DevOps REQ-032 / supply-chain AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG046: operational store retentionをboundedにする
- 対応所見: PRG-046
- 観点(surface / lens): 実装 / 運用性
- 現状(as-is): `packages/devops/src/db/schema.sql:13-69,155-165,276-307` のevents/pm_events/snapshots/reports/usage/tasksにpurge policyなし。
- 精査で判明した欠陥: DB/index/backup/cost/PIIが無期限増加。
- 改善(to-be): TASK-PRG025/043に基づくper-table retention/holdを定義し、high-volume partition+batch purge、size/age metricsを実装。
- 許可ファイル/スコープ: `packages/devops/src/db/`, `packages/server/src/scheduler/`, `packages/server/src/observability/`, `runbooks/`, `packages/server/tests/integration/`
- 禁止事項: 共通Executor Contractに加え、一律retention、hold無視、大transaction delete。
- 前提/停止条件: legal/data ownerが期間承認しなければpurge実行をBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] 全6 tableにpolicy/owner/metric
  - [ ] batch purge/hold/idempotency tests
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: PG16 time-shift/purge tests → pass。
  - requires-real-env: staging volume dry-run/backup impactをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-046/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG016, TASK-PRG025, TASK-PRG036, TASK-PRG043
- 仕様トレース: retention REQ/AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG047: deliveryをatomic claim-before-sendにする
- 対応所見: PRG-047
- 観点(surface / lens): 実装 / 信頼性
- 現状(as-is): `packages/prjops/src/lib/idempotentDelivery.ts:52-77` と `AGT05_distributor.ts:47-65` はread→nonexclusive UPSERT→sendで2 concurrent callが2 mail。
- 精査で判明した欠陥: AC-018-2 duplicate保証破れ。
- 改善(to-be): `INSERT ... ON CONFLICT DO NOTHING RETURNING` claim ownership、winnerのみsend。pending lease/attempt/last_errorを持ちcrash recoveryは明示再送。
- 許可ファイル/スコープ: `packages/prjops/src/lib/idempotentDelivery.ts`, `packages/prjops/src/agents/`, `packages/server/src/db/reportDeliveryLogRepo.ts`, `packages/*/tests/`, `packages/devops/src/db/`
- 禁止事項: 共通Executor Contractに加え、check-then-act、UPSERTをclaim扱い、send後claim。
- 前提/停止条件: Graph idempotency key非対応を前提。schema migrationはTASK-PRG001方式。
- 完了条件(DoD、チェックボックス):
  - [ ] 50 concurrent callでmail=1
  - [ ] crash/lease expiry/retry tests pass
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: PG16 concurrent delivery repo + agent tests → pass。
  - requires-real-env: staging2 replica同時cycleで1通をPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-047/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG001, TASK-PRG009, TASK-PRG041, TASK-SPC025
- 仕様トレース: REQ-018 / SPEC-INT-052 / SPEC-EXT-023 / AC-018-2。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG048: Teams監査actorへimmutable user IDを伝播する
- 対応所見: PRG-048
- 観点(surface / lens): 実装 / セキュリティ
- 現状(as-is): `packages/server/src/agents/teamsConversationAgent.ts:208-235,292-300,426-435` はauthorAadId取得後もactor/requestedByがUSER:personaのみ。
- 精査で判明した欠陥: 自律操作を個人へ遡れない。
- 改善(to-be): author AAD object IDをexecution contextへ渡し`USER:${authorAadId}`をactor/requested_by、personaをdetail/auth contextへ分離。display nameはactorに使わない。
- 許可ファイル/スコープ: `packages/server/src/agents/teamsConversationAgent.ts`, `packages/server/src/db/codingTasksRepo.ts`, `packages/server/tests/`, `packages/devops/src/db/`
- 禁止事項: 共通Executor Contractに加え、personaをidentity扱い、display name/email actor、既存audit改変。
- 前提/停止条件: `raw.authorAadId` は現行受信境界ですでに取得済みであり、TASK-SPC026のidentity contractとTASK-PRG043のAAD object ID retentionが承認済みであること。stakeholder providerを実装するTASK-PRG005の成果物は不要。
- 完了条件(DoD、チェックボックス):
  - [ ] 2同persona userが別actor/requestedBy
  - [ ] no AADはfail closed/audit rejected
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: Teams agent/coding repo tests → pass。
  - requires-real-env: staging2 user actionsをaudit traceで識別しPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-048/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG023, TASK-PRG043, TASK-SPC026
- 仕様トレース: ADR-0005/0006; audit attribution AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG049: runtime imageを最小non-root化する
- 対応所見: PRG-049
- 観点(surface / lens): 実装 / セキュリティ
- 現状(as-is): `packages/server/Dockerfile:20-31` は/repo全copy、dev deps/source/tests同梱、USERなし。
- 精査で判明した欠陥: root+large attack surface。
- 改善(to-be): build outputとproduction node_modulesだけcopyしfixed UID/GID `node`で実行、read-only rootfs/tmp writable前提、SBOMを生成。
- 許可ファイル/スコープ: `packages/server/Dockerfile`, `packages/server/scripts/`, `.dockerignore`, `.github/workflows/`, `verification/security/`
- 禁止事項: 共通Executor Contractに加え、full repo copy、root、build tool runtime残置、Web build mask。
- 前提/停止条件: TASK-PRG027 Docker CI利用可能。
- 完了条件(DoD、チェックボックス):
  - [ ] container user nonzero
  - [ ] source/tests/dev tooling absent、startup/health pass
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: Docker build + image content/user assertions → pass。
  - requires-real-env: staging read-only rootfsでstartup/shutdownをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-049/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG003, TASK-PRG017, TASK-PRG027
- 仕様トレース: ADR-0003/0005; container hardening AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-PRG050: progress request email HTMLをescapeする
- 対応所見: PRG-050
- 観点(surface / lens): 実装 / セキュリティ
- 現状(as-is): `AGT05_distributor.ts:178-192` がpreviousSummary3Linesをraw htmlBodyへ挿入。
- 精査で判明した欠陥: 結線時にexternal summaryがmarkup injection。
- 改善(to-be): shared final-sink `escapeHtml`を再利用可能moduleへ置き、subject/plain textとHTML全fieldをescape。全Graph htmlBody callerを同sink review。
- 許可ファイル/スコープ: `packages/shared/src/`, `packages/prjops/src/agents/AGT05_distributor.ts`, `packages/prjops/tests/`, `packages/server/src/scheduler/tasks/`
- 禁止事項: 共通Executor Contractに加え、regex tag strip、callerだけsanitize、HTML escapingとsecret sanitation混同。
- 前提/停止条件: function未結線でもregression test必須。
- 完了条件(DoD、チェックボックス):
  - [ ] malicious img/link/script charsがentity化
  - [ ] standard report renderer regression pass
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: prjops distributor + server report HTML tests → pass。
  - requires-real-env: 結線後staging mail client renderingをPRG-031へ記録。
  - 偽装禁止: real-env未実施をmock/dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/PRG-050/`（`integration.md`, `real-env.md`, redacted logs）
- 依存(blocked-by): TASK-PRG004, TASK-PRG023
- 仕様トレース: REQ-003 / SPEC-EXT-010/030; HTML safety AC新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

## Plan quality self-audit

- [ ] Coverage validator confirms exactly PRG-001..050 and TASK-PRG001..050 with no gaps/duplicates.
- [ ] Every task contains all schema fields, at least three DoD checks, both verification classes, an evidence path, dependencies, trace IDs, and a STOP condition.
- [ ] `rg -n 'T[B]D|workerが適切に判[D]断|ワーカーが適切に判[D]断' .orchestration/plan/remediation_workplan.md` returns no matches.
- [ ] Phase membership in `remediation_phases.md` covers every TASK-ID exactly once.


## SPC Tasks

### TASK-SPC001: orphan DevOps REQ-032をnamespace付きで隔離・決裁する
- 対応所見: SPC-001
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `docs/spec/spec-id-catalog.md:39` はDevOps REQ-032を定義するが `packages/traceability/spec-ids/devops.json:3-28` にIDがなく、PrjOps indexには同番号が未定義で存在する。
- 精査で判明した欠陥: catalog行をID文字列だけでjoinするとDevOps定義をPrjOpsへ誤接続し、定義数も1件過大になる。
- 改善(to-be): 選択肢はDevOps index追加、PrjOpsへ移管、orphan廃止。原本不在では意味を推測せず、推奨は `(DevOps,REQ-032)` をstatus=orphanで隔離して全semantic edgeをfailし、Specification Ownerの署名決裁後だけ追加・移管・廃止する。
- 許可ファイル/スコープ: `docs/spec/`, `packages/traceability/spec-ids/`, `packages/traceability/src/`, `packages/traceability/tests/`
- 禁止事項: 共通Executor Contractに加え、ID文字列だけのjoin、PrjOps REQ-032への自動移管、owner証跡なしの削除。
- 前提/停止条件: T32受入済みとSpecification Owner指名が必須。原本またはowner決裁が無ければorphanのままBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] orphanが `(system,id)` で1件に特定され、他systemへjoinされない
  - [ ] owner未決裁fixtureでtraceability gateがfailし、決裁3分岐の証跡schemaが検証される
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: traceability namespace/orphan fixtures + `mise run traceability` → pass。
  - requires-real-env: Specification Ownerがsource evidenceを確認し追加・移管・廃止のいずれかへ署名。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-001/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): T32（受入済）
- 仕様トレース: PRG-023 / PRG-024。仕様管理meta-spec IDはowner採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC002: 外部原本不在をcanonical recovery ledgerで閉じる
- 対応所見: SPC-002
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `README.md:6-8` と `verification/VERIFICATION_REPORT.md:9` がZIP/PPTXと `/mnt/user-data/uploads` を正本として参照するが現物がない。
- 精査で判明した欠陥: 旧IDの原文・例外・優先順位を監査できず、実装コメントを要求として追認しやすい。
- 改善(to-be): 推奨順はlicensed original取得、取得不能時はT32復元+owner新規normative text、復元不能はBLOCKED。source locatorだけを完了経路にせず、295 keyのsource/status/owner/version ledgerをTASK-PRG023の単一corpusへ取り込む。
- 許可ファイル/スコープ: `docs/spec/`, `packages/traceability/spec-ids/`, `packages/traceability/src/`
- 禁止事項: 共通Executor Contractに加え、存在しないlocatorで完了、実装追認、権利不明原本commit、別corpusの新設。
- 前提/停止条件: T32受入済み、legal/source owner、Specification Ownerが必須。不在なら取得・復元statusだけ記録してBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] 295 keyすべてにoriginal/reconstruction/new normative/unrecoverableの排他的statusとownerがある
  - [ ] 64復元不能keyはnormative textなしでpassせずTASK-PRG023をblockする
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: corpus source-status schema/coverage fixtures + `mise run traceability` → pass。
  - requires-real-env: legal ownerが原本利用可否、Specification Ownerが復元採否へ署名。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-002/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): T32（受入済）
- 仕様トレース: PRG-023。仕様管理meta-spec IDはowner採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC003: 全category欠番を予約状態付きregistryへ記録する
- 対応所見: SPC-003
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `prjops.json:23-31` はREQ-022..029、`devops.json:3-28` はREQ-004..009/013/014/032..040を欠き、他categoryにも数値穴がある。
- 精査で判明した欠陥: 削除・予約・未移植の区別がなく、再採番で外部正本と衝突する。
- 改善(to-be): 各numeric gapをreserved/deleted/not-applicable/missing-sourceの4状態でregistry管理する。推奨defaultはmissing-sourceで、owner evidenceなしにreserved/deletedへ変えない。
- 許可ファイル/スコープ: `docs/spec/`, `packages/traceability/spec-ids/`, `packages/traceability/src/`, `packages/traceability/tests/`
- 禁止事項: 共通Executor Contractに加え、欠番再利用、連番圧縮、履歴根拠なしのdeleted化。
- 前提/停止条件: TASK-SPC001受入とSpecification Owner指名が必要。1件でもdisposition不能ならmissing-source/BLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] REQ欠番25件と全category gapがnamespaced status/evidence付きで全数一致
  - [ ] 欠番IDの新規採番fixtureがgate failureし、owner-approved reservationだけ通る
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: gap registry全数fixture + T32 analyzer parity + `mise run traceability` → pass。
  - requires-real-env: 両system ownerがgap disposition一覧へ署名。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-003/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): TASK-SPC001
- 仕様トレース: PRG-023。ID allocation meta-specはowner採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC004: AGENTS ADR一覧をdirectory正本と同期する
- 対応所見: SPC-004
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `AGENTS.md:77-81` の主要ADR一覧は0013で止まり、Acceptedな `docs/adr/0014-integration-delivery.md` を欠く。
- 精査で判明した欠陥: workerが現行delivery決定を見落とし、旧runtimeだけを正とし得る。
- 改善(to-be): 選択肢は手編集一覧維持またはdirectory-derived check。推奨は一覧を維持しつつ `docs/adr/[0-9]{4}-*.md` のAccepted全件を照合するstdlib scriptをCIへ追加する。
- 許可ファイル/スコープ: `AGENTS.md`, `docs/adr/`, `scripts/`, `package.json`
- 禁止事項: 共通Executor Contractに加え、ADR-0014本文改変、Accepted ADRの選別除外、一覧だけ直して再発防止check省略。
- 前提/停止条件: T32受入済み。ADR status parse規則がowner承認されない場合はcheck導入をBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] AGENTS一覧がADR-0001..0014を含みdirectoryとの差分0
  - [ ] Accepted ADRをfixtureで1件落とすとcheckがnon-zero
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: ADR index completeness test + `mise run ci` → pass。
  - requires-real-env: documentation ownerが現行runtime導線をwalkthroughしADR-0014参照を承認。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-004/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): T32（受入済）
- 仕様トレース: ADR-0014 / PRG-038。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC005: traceabilityをexact namespaced token edgeへ変更する
- 対応所見: SPC-005
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `verifyTraceability.ts:84-98` は `String.includes` を使い、DevOps ISS-01がPrjOps ISS-010で誤matchする。
- 精査で判明した欠陥: system境界とtoken境界を失い、存在しない実装/test edgeを生成する。
- 改善(to-be): 選択肢はregex境界または明示mapping。推奨は `(system,id)` explicit mappingを正とし、exact-token parserはmigration診断だけに使う。lexical fallbackはpass条件にしない。
- 許可ファイル/スコープ: `packages/traceability/src/`, `packages/traceability/spec-ids/`, `packages/traceability/tests/`
- 禁止事項: 共通Executor Contractに加え、String.includes維持、短縮ID正規化、shared参照の片systemだけ計上、missingをwarning化。
- 前提/停止条件: TASK-SPC001のorphan policy確定が必要。mapping schema未承認なら実装せずBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] ISS-01/ISS-010と56 cross-system collision fixturesが誤join 0
  - [ ] comment-only、wrong-system、partial-token mappingが全てgate failure
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: traceability adversarial fixtures + `mise run traceability` → pass。
  - requires-real-env: operational evidence edgeを両system ownerがsample review。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-005/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): TASK-SPC001
- 仕様トレース: PRG-024。traceability meta-spec IDはowner採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC006: 未索引AC-016-1をowner決裁で正規化する
- 対応所見: SPC-006
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `packages/prjops/src/templates/index.ts:3-5` と `tests/reportTemplates.test.ts:177-187` がAC-016-1を参照するが両indexにない。
- 精査で判明した欠陥: 実装・testが主張する受入条件がtraceability母集団外にある。
- 改善(to-be): 選択肢はPrjOps ACとして採番、既存ACへ訂正、参照撤去。推奨はcandidateとしてquarantineし、原本/ownerがREQ-016との対応を確認後のみPrjOps AC-016-1へ登録する。
- 許可ファイル/スコープ: `packages/traceability/spec-ids/`, `docs/spec/`, `packages/prjops/src/templates/`, `packages/prjops/tests/`
- 禁止事項: 共通Executor Contractに加え、名前から意味を推定して即登録、DevOpsへ登録、test参照だけ削除。
- 前提/停止条件: TASK-SPC001受入とPrjOps Specification Owner決裁が必要。未決裁はcandidate/BLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] AC-016-1がregistered/corrected/retiredの1状態と根拠を持つ
  - [ ] 未索引real IDはfailし、REQ-999 synthetic fixtureは明示fixtureとして除外される
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: unindexed-ID scanner fixtures + `mise run traceability` → pass。
  - requires-real-env: PrjOps ownerが多言語受入条件のnormative textへ署名。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-006/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): TASK-SPC001
- 仕様トレース: PrjOps REQ-016 / candidate AC-016-1 / PRG-024。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC007: dead 64 IDをcanonical corpus内でdispositionする
- 対応所見: SPC-007
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `.orchestration/validation/T32-id-inventory.md` はsource/test exact参照0のnamespaced IDを64件列挙する。
- 精査で判明した欠陥: dead、未実装、document-only、仕様喪失を区別できず100% trace claimが成立しない。
- 改善(to-be): TASK-PRG023 corpusへimplemented/document-only/retired/lost-specの排他的dispositionを追加する。推奨defaultはlost-specで、retiredはreplacement+owner evidence必須。別台帳は作らない。
- 許可ファイル/スコープ: `docs/spec/`, `packages/traceability/spec-ids/`, `packages/traceability/src/`, `packages/traceability/tests/`
- 禁止事項: 共通Executor Contractに加え、64件一括retired、doc参照をimplementation扱い、別dead-ID台帳の二重管理。
- 前提/停止条件: TASK-SPC001/002/005受入が必要。owner evidenceなしはlost-spec/BLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] 64/64 keyが排他的dispositionとowner/evidence/replacementを持つ
  - [ ] lost-spec/retired-without-replacementがimplementation completeを通過しない
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: T32 analyzer parity + disposition schema fixtures + `mise run traceability` → pass。
  - requires-real-env: 両system ownerが64件全件のdispositionへ署名。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-007/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): TASK-SPC001, TASK-SPC002, TASK-SPC005
- 仕様トレース: PRG-023 / PRG-024。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC008: testless AC 36件へtyped verification edgeを付ける
- 対応所見: SPC-008
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): T32集計でPrjOps 11、DevOps 25の計36 ACにexact test参照がない。
- 精査で判明した欠陥: AC達成を証明できず、source commentだけでgreenになり得る。
- 改善(to-be): testable ACはtest case、operational ACはreal-env evidence schemaへtyped edgeを必須化する。推奨はexceptionではなくtype分類をowner承認し、未分類はfailする。
- 許可ファイル/スコープ: `packages/traceability/src/`, `packages/traceability/spec-ids/`, `packages/traceability/tests/`, `docs/spec/`
- 禁止事項: 共通Executor Contractに加え、全ACをoperational扱い、comment-only test、未分類warning化。
- 前提/停止条件: TASK-SPC005/007受入が必要。AC normative text不明なら分類せずBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] 36/36 ACがtest/evidence edgeまたはowner-approved non-applicabilityを持つ
  - [ ] missing/wrong-system/comment-only edge fixturesがgate failure
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: AC edge fixtures + package tests + `mise run traceability` → pass。
  - requires-real-env: operational ACのevidence owner/environment/dateをPRG-031台帳でreview。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-008/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): TASK-SPC005, TASK-SPC007
- 仕様トレース: PRG-024。verification meta-spec IDはowner採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC009: seven_keys_snapshots data modelをschema正本へ同期する
- 対応所見: SPC-009
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `docs/spec/data-model.md:25` はname/keys/trace_idを記すが `schema.sql:71-83` はsnapshot_id/keys_rag/next_actionsでtrace_idがない。
- 精査で判明した欠陥: consumerが存在しない列へ依存し、traceability有無も誤認する。
- 改善(to-be): 選択肢はdocをschemaへ同期またはmigrationで列追加。data-model自身がschemaを正本と宣言するため、推奨はdocを現schemaへ同期し、trace_idが要求なら別owner-approved migration taskに分離する。
- 許可ファイル/スコープ: `docs/spec/data-model.md`, `packages/devops/src/db/schema.sql`, `packages/server/src/db/`, `packages/server/tests/`
- 禁止事項: 共通Executor Contractに加え、docsとschemaの同時無根拠変更、trace_idを暗黙追加、主要列の手選別check。
- 前提/停止条件: T32受入済み。trace_id requirementがowner決裁されていなければdoc同期のみ行い追加はBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] documented columns/invariantsがschema introspectionと一致
  - [ ] 存在しないname/keys/trace_idをfixtureへ戻すとdoc-schema checkがfail
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: data-model/schema parity test + `mise run ci` → pass。
  - requires-real-env: DB ownerがstaging schema introspection結果を承認。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-009/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): T32（受入済）
- 仕様トレース: ADR-0010 / AC-038-1。trace column要求は新規採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC010: events dead状態をqueue仕様へ追加する
- 対応所見: SPC-010
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `docs/spec/data-model.md:9` は4状態、`schema.sql:13-23` はdeadを含む5状態。
- 精査で判明した欠陥: DLQ終端、遷移、replay責任が仕様から欠落する。
- 改善(to-be): schemaの5状態を採用し、queued→dispatched→delayed/dead/doneの許可遷移、attempt上限、replayをnormative state machineとして定義する。dead削除案は信頼性要件を失うため禁止する。
- 許可ファイル/スコープ: `docs/spec/`, `docs/adr/`, `packages/server/src/db/`, `packages/server/tests/`
- 禁止事項: 共通Executor Contractに加え、dead削除、状態追加だけで遷移未定義、replayで監査/attemptを消す。
- 前提/停止条件: T32受入済みとqueue owner承認が必要。attempt/replay policy未決はBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] 5状態と全許可/禁止遷移、owner、replay条件がmachine-readable
  - [ ] 不正遷移とdead直接doneがtest failure
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: events state-machine/repository tests + `mise run ci` → pass。
  - requires-real-env: staging poison eventのdead/replay drillをPRG-031へ記録。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-010/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): T32（受入済）
- 仕様トレース: PRG-015。DLQ lifecycle SPEC/ACはowner採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC011: schema_migrationsとevents retry/claim invariantsを文書化する
- 対応所見: SPC-011
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `data-model.md:5-27` はschema_migrationsとeventsのattempts/next_attempt_at/claimed_at/dedupe_keyを欠く。
- 精査で判明した欠陥: migration ordering、retry、claim recovery、dedupe ownershipを監査できない。
- 改善(to-be): 手書き全column表ではなくstateful tablesのschema-derived invariant manifestを採用し、schema_migrations順序とevents retry/claim/dedupeを必須項目にする。
- 許可ファイル/スコープ: `docs/spec/data-model.md`, `packages/devops/src/db/`, `packages/server/src/db/`, `packages/server/tests/`
- 禁止事項: 共通Executor Contractに加え、column一覧だけの同期、claim TTL未定義、dedupe conflictを成功扱い。
- 前提/停止条件: TASK-SPC010のqueue state受入が必要。claim timeout owner未決ならBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] schema_migrationsと4 retry/claim列の型・意味・invariantがschemaと一致
  - [ ] 列/constraintをfixtureで欠落・変更するとparity testがfail
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: schema manifest parity + events repository tests + `mise run ci` → pass。
  - requires-real-env: staging migration/retry/claim recovery結果をPRG-031へ記録。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-011/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): TASK-SPC010
- 仕様トレース: PRG-014 / PRG-015。event lifecycle ACはowner採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC012: migration responsibilityをrepository runnerへ同期する
- 対応所見: SPC-012
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `data-model.md:41` はrolloutがrepository外と記すが `migrate.ts:33-78` と7 migrationがrepository内にある。
- 精査で判明した欠陥: fresh schema、repo runner、infra operatorの責任境界が矛盾する。
- 改善(to-be): 推奨はrepo `migrate.ts` をordered migration正本、infraをcredential/実行主体、schema.sqlをfresh DB正本と明記し、二重runnerを禁止する。
- 許可ファイル/スコープ: `docs/spec/data-model.md`, `packages/devops/src/db/`, `packages/devops/tests/`, `runbooks/`
- 禁止事項: 共通Executor Contractに加え、外部runner新設、migration bypass、schema.sqlをupgrade script扱い。
- 前提/停止条件: T32受入済み。production operator/rollback owner未指名ならrunbook受入をBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] fresh/upgrade/operator/rollback責任が一意で7 migrationsと一致
  - [ ] 順序逆転・重複version・未記録migrationがtest failure
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: migrate unit tests + migration inventory check + `mise run ci` → pass。
  - requires-real-env: stagingでrepo runnerのfresh/upgrade/rollback drillをPRG-031へ記録。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-012/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): T32（受入済）
- 仕様トレース: PRG-001 / PRG-026。migration governance ACはowner採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC013: 監査保持を実装可能なsystem別lifecycle仕様へ変更する
- 対応所見: SPC-013
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `ADR-0001:26-31` はPrjOps5年/DevOps1年を実装すると記すが、`auditLog.ts:5-15` とschema commentにlifecycle機構がない。
- 精査で判明した欠陥: 保持・legal hold・purge証拠を実行できず、ADRが実装済みを誤表示する。
- 改善(to-be): 推奨はADR statusをrequired/not-implementedへ訂正し、PrjOps5年とDevOps12か月のpartition/purge/hold/evidence contractをTASK-PRG023 corpusへ定義する。実装はPRG-001/036へ一元化する。
- 許可ファイル/スコープ: `docs/adr/`, `docs/spec/`, `runbooks/`, `packages/traceability/spec-ids/`
- 禁止事項: 共通Executor Contractに加え、実装済み表記維持、holdなしpurge、SPC専用の別retention実装。
- 前提/停止条件: TASK-SPC002受入とlegal/data owner決裁が必要。期間・hold未承認はBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] 両systemにduration/start-event/boundary/hold/purge owner/evidenceがある
  - [ ] lifecycle実装証跡なしでADR status=implementedにするとgate failure
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: retention spec schema/link tests + `mise run ci` → pass。
  - requires-real-env: legal/data ownerが期間とhold、DB ownerが実行可能性へ署名。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-013/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): TASK-SPC002
- 仕様トレース: PrjOps REQ-020/021, SPEC-INT-053; DevOps REQ-028, SPEC-INT-056; PRG-036。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC014: 12か月auditと13か月channel保持を別契約にする
- 対応所見: SPC-014
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `schema.sql:213-216` と `ADR-0005:39-42` は13か月と1年を整合扱いする。
- 精査で判明した欠陥: 12/13か月、暦境界、データ種別のどれがnormativeか不明。
- 改善(to-be): 推奨はDevOps auditを12 calendar months、channel messagesをclosed_at後13 calendar monthsの別policyとして明記し、同値表現を削除する。変更する場合はlegal ownerの単一decisionが必要。
- 許可ファイル/スコープ: `docs/adr/`, `docs/spec/`, `runbooks/`, `packages/traceability/spec-ids/`
- 禁止事項: 共通Executor Contractに加え、1年=13か月表記、データ種別共用purge、timezone/boundary省略。
- 前提/停止条件: TASK-SPC013受入とlegal owner決裁が必要。拒否時は代替期間署名までBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] audit/channel各policyの期間・起点・inclusive boundary・JST・holdが一意
  - [ ] 12/13を同一policyへ割り当てるfixtureがvalidation failure
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: retention policy schema/adversarial fixtures + `mise run ci` → pass。
  - requires-real-env: legal ownerとDB ownerが代表日付のpurge計算をwalkthrough。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-014/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): TASK-SPC013
- 仕様トレース: DevOps REQ-028 / ADR-0005 / PRG-036 / PRG-046。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC015: Seven Keys閾値をversioned calibration仕様へ固定する
- 対応所見: SPC-015
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): catalog `SPEC-INT-065` はdeterministicだが `ADR-0010:24-30` は70%/2-of-5/48-72hを非正典の初期値とする。
- 精査で判明した欠陥: 同一入力が無版の閾値変更で別RAGになり、過去比較を再現できない。
- 改善(to-be): 推奨は現値をcalibration-v1として固定し、effective_at/owner/rationale/backfill policy付きregistryへ移す。code constantだけの変更は禁止する。
- 許可ファイル/スコープ: `docs/spec/`, `docs/adr/`, `packages/prjops/src/lib/`, `packages/prjops/tests/`
- 禁止事項: 共通Executor Contractに加え、無版閾値変更、過去snapshot無断再計算、LLM判定。
- 前提/停止条件: TASK-SPC002受入とportfolio owner承認が必要。現値を拒否する場合は代替version署名までBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] 全Seven Keys thresholdにversion/effective date/owner/boundary/backfillがある
  - [ ] versionなし変更と境界直前/直後の期待値ずれがtest failure
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: executiveSevenKeys boundary/version tests + `mise run ci` → pass。
  - requires-real-env: portfolio ownerがrepresentative projectsでv1 calibrationを承認。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-015/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): TASK-SPC002
- 仕様トレース: PrjOps SPEC-INT-065 / AC-038-1 / ADR-0010。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC016: scheduler粒度とproduct deadlineを別NFRで定義する
- 対応所見: SPC-016
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `ADR-0003:14,39` はGitHub Actions最短間隔を概ね/程度5分とする。
- 精査で判明した欠陥: runtime選定とSLO比較に使う上限が測定不能。
- 改善(to-be): 推奨はconfigured cron granularity=5分、platform scheduling delayは非保証、30秒/1分deadline taskはresident serverと明記し、product deadlineを別NFRで定義する。
- 許可ファイル/スコープ: `docs/adr/`, `docs/spec/`, `runbooks/production-gates.md`
- 禁止事項: 共通Executor Contractに加え、概ね/程度の維持、observed delayをplatform保証扱い、deadline未達をcron drift扱い。
- 前提/停止条件: TASK-SPC002受入とplatform/SRE owner承認が必要。SLO未承認はBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] granularity/observed latency/product deadline/measurement pointが分離される
  - [ ] 5分超を許すtaskと1分deadline taskの矛盾がNFR validatorでfail
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: NFR schema/link fixtures + `mise run ci` → pass。
  - requires-real-env: hosted scheduleとresident schedulerの遅延測定をPRG-031へ記録。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-016/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): TASK-SPC002
- 仕様トレース: ADR-0003 / PRG-025。scheduler NFR IDはowner採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC017: extended-thinking budget defaultを仕様化する
- 対応所見: SPC-017
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `ADR-0013:19` は既定値とだけ記し、実装は `chatHandler.ts:35-37` で12000、configは1024..64000。
- 精査で判明した欠陥: cost/latency defaultを仕様違反なしに変更できる。
- 改善(to-be): 推奨はdefault=12000、min=1024、max=64000、対象model/manual thinking、変更ownerとversionをSPEC-INT-068へ固定する。adaptive移行は別decisionとする。
- 許可ファイル/スコープ: `docs/adr/`, `docs/spec/`, `packages/web/src/server/`, `packages/web/tests/chat/`
- 禁止事項: 共通Executor Contractに加え、実装defaultだけ変更、model互換性未確認、temperature併用。
- 前提/停止条件: TASK-SPC002受入とAI/cost owner承認が必要。model policy未決はBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] default/min/max/model/version/ownerがspecとconfigで一致
  - [ ] 未指定・境界外・非対応model fixturesが決定どおりfail/resolve
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: chat config/route tests + `mise run ci` → pass。
  - requires-real-env: cost ownerがrepresentative token usageとlatencyを承認。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-017/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): TASK-SPC002
- 仕様トレース: PrjOps/DevOps SPEC-INT-068 / ADR-0013。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC018: Graph notification latencyを測定可能な移行条件へする
- 対応所見: SPC-018
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `ADR-0005:30-33` はnotificationを通常数秒、polling最大5分とする。
- 精査で判明した欠陥: Phase2 bot移行条件をpercentile/window/error budgetで判定できない。
- 改善(to-be): 推奨初期NFRはnotification receive p95<=30秒/30日、polling recovery<=5分、月間breach>1%でPhase2 review。owner承認でのみ変更する。
- 許可ファイル/スコープ: `docs/adr/`, `docs/spec/`, `runbooks/production-gates.md`
- 禁止事項: 共通Executor Contractに加え、通常数秒表現だけ維持、平均値のみ、測定開始/終了点省略。
- 前提/停止条件: TASK-SPC002受入とproduct/SRE owner承認が必要。閾値拒否は代替署名までBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] latency metric/percentile/window/source/threshold/owner/actionが揃う
  - [ ] p95 breach fixtureがPhase2 reviewをopenし、平均だけではpassしない
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: NFR schema/decision fixtures + `mise run ci` → pass。
  - requires-real-env: staging Graph notification/polling latencyを30日台帳形式でPRG-031へ記録。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-018/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): TASK-SPC002
- 仕様トレース: ADR-0005 / PRG-025。notification NFR IDはowner採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC019: 50/100 project・company上限をload acceptanceへ変換する
- 対応所見: SPC-019
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `README.md:8` は50件、設計上限100件/100社を掲げるがREQ/NFR/AC・DB制約・workloadがない。
- 精査で判明した欠陥: 規模主張がlatency/concurrency/storage/costと結び付かず反証不能。
- 改善(to-be): 推奨は50-project steadyと100-project/100-company design workloadをTASK-PRG025 NFR、TASK-PRG029 load planへ一元化し、duration/data shape/SLO/costを固定する。
- 許可ファイル/スコープ: `docs/spec/`, `docs/adr/`, `runbooks/production-gates.md`, `verification/`
- 禁止事項: 共通Executor Contractに加え、README数値だけ削除、件数だけのsmoke、mockでscale合格。
- 前提/停止条件: TASK-SPC002受入とbusiness/SRE owner承認が必要。代表data shapeがowner承認されていなければBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] 50 steady/100 design workloadにduration/concurrency/data/SLO/cost/evidenceがある
  - [ ] 件数だけ満たしlatency/error/cost超過するfixtureがfail
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: NFR/workload schema/link tests + `mise run ci` → pass。
  - requires-real-env: TASK-PRG029 staging loadを実行しPRG-031でowner承認。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-019/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): TASK-SPC002
- 仕様トレース: PRG-025 / PRG-029。capacity NFR/ACはowner採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC020: LLM cost reservationのexpiry・reconcile契約を定義する
- 対応所見: SPC-020
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `data-model.md:33` と `pgCostGuard.ts:97-173` は成功reconcileだけを定義し、失敗/放棄予約の処理がない。
- 精査で判明した欠陥: estimated rowが日次上限を恒久消費し、actual/staleを識別できない。
- 改善(to-be): 選択肢はdelete、stateful reservation、append adjustment。監査性のためstateful reservationを推奨し、reserved/actual/expired、30分TTL、idempotent reconcile、expiry adjustmentを定義する。
- 許可ファイル/スコープ: `docs/spec/`, `docs/adr/`, `packages/shared/src/clients/`, `packages/shared/tests/`, `packages/devops/src/db/`
- 禁止事項: 共通Executor Contractに加え、失敗予約の無監査delete、actual二重計上、TTLなしreserved。
- 前提/停止条件: TASK-SPC002受入とcost/data owner承認が必要。30分TTL拒否は代替値署名までBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] reservation state/TTL/reconcile idempotency/crash recovery/accountingが一意
  - [ ] reconcile失敗・二重reconcile・TTL expiryの境界testsが期待costを維持
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: PgCostGuard state/expiry tests + schema tests + `mise run ci` → pass。
  - requires-real-env: stagingでstream abort/reconcile failure/expiry recoveryをPRG-031へ記録。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-020/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): TASK-SPC002
- 仕様トレース: SPEC-INT-060 / PRG-025。cost reservation ACはowner採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC021: report metricsをtyped provenance artifactへ固定する
- 対応所見: SPC-021
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `calculateReportMetrics.ts:7-16` と `finalizeReportJson.ts:26-31` はmetric/evidence/periodをenvから受けるが生成元契約がない。
- 精査で判明した欠陥: 任意CI env値がvalidated metricとしてreportへ入る。原則1/7の字義違反ではなくprovenance仕様欠落である。
- 改善(to-be): 推奨はenvをtransportだけにし、typed metrics artifactへsource query/run ID、commit、period、generated_at、schema versionを必須化する。CLIはartifactを検証してからreportへ注入する。
- 許可ファイル/スコープ: `docs/spec/`, `packages/shared/src/reporting/`, `packages/shared/tests/`, `.github/workflows/`
- 禁止事項: 共通Executor Contractに加え、env値直採用、原則1/7違反としてsrc/libへ移動、provenanceなしfallback。
- 前提/停止条件: TASK-SPC002受入とreport/data owner承認が必要。metric sourceがowner承認されていなければBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] 全metricにsource/run/commit/period/schemaがありreport periodと一致
  - [ ] 改竄env、period mismatch、missing provenance artifactがE-RPT failure
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: reporting provenance fixtures + workflow static test + `mise run ci` → pass。
  - requires-real-env: hosted CI artifactとsource query/runをsample突合しPRG-031へ記録。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-021/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): TASK-SPC002
- 仕様トレース: PrjOps REQ-040/SPEC-INT-067; DevOps SPEC-INT-082; PRG-007/022。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC022: multi-replica scheduler ownershipを仕様化する
- 対応所見: SPC-022
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `ADR-0005:17-23` はprocess-local多重実行guardだけを決め、leader/lease/fencingを定義しない。
- 精査で判明した欠陥: 各replicaが同じexternal side effectを実行してもwritten spec違反にならない。
- 改善(to-be): 選択肢はsingle replica固定、leader election、per-task PG lease。可用性と粒度のためper-task PostgreSQL advisory lease + fencing/expiry/idempotencyを推奨する。
- 許可ファイル/スコープ: `docs/spec/`, `docs/adr/`, `packages/server/src/scheduler/`, `packages/server/tests/`, `packages/devops/src/db/`
- 禁止事項: 共通Executor Contractに加え、process-local flagだけ、replica=1前提の黙示、leaseなしexternal call。
- 前提/停止条件: TASK-SPC002受入とSRE/DB owner承認が必要。lease key/timeout未決はTASK-PRG041をBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] task ownership/lease key/fencing/expiry/failover/idempotencyがnormative
  - [ ] two-replica fixtureでside effect ownerが1つ、stale holderが拒否される
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: two-replica scheduler + ephemeral PG lease tests + `mise run ci` → pass。
  - requires-real-env: staging2 replicasでfailover/rolling deploy drillをPRG-031へ記録。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-022/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): TASK-SPC002
- 仕様トレース: PRG-041。scheduler concurrency SPEC/ACはowner採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC023: holiday calendarのverified horizonをfail-closed仕様にする
- 対応所見: SPC-023
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `jp_holidays.yaml:3-17` は年次更新を記すがSPEC-INT-054/033にcovered year、provisional、範囲外停止がない。
- 精査で判明した欠陥: 範囲外日付を平日扱いしてもwritten spec違反にならない。
- 改善(to-be): 推奨はcovered_from/toとverified_untilを必須化し、範囲外または未承認provisional yearではscheduler startup/taskをfail closed、90日前alertと年次owner更新を定義する。
- 許可ファイル/スコープ: `docs/spec/`, `docs/adr/`, `packages/shared/src/calendar/`, `packages/shared/tests/`, `runbooks/`
- 禁止事項: 共通Executor Contractに加え、未知日を平日扱い、verified flag無視、alertだけで継続。
- 前提/停止条件: TASK-SPC002受入とcalendar owner承認が必要。coverage metadata未設定ならTASK-PRG042をBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] coverage/verified/provisional/alert/update/fail-closed規則が一意
  - [ ] 2028範囲外とverified=false未承認fixtureがbusiness dayを返さずfailure
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: businessCalendar horizon/boundary tests + `mise run ci` → pass。
  - requires-real-env: 次年度一次情報reviewとstartup horizon checkをPRG-031へ記録。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-023/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): TASK-SPC002
- 仕様トレース: PrjOps SPEC-INT-054; DevOps SPEC-INT-033; PRG-042。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC024: standard reportへsource provenance境界を追加する
- 対応所見: SPC-024
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `reportSchema.ts:25-35` はtenant/project/sourceを持たず、catalogはrecipient filterだけを定義する。
- 精査で判明した欠陥: unscoped内容をrecipient側projectへ付け替えてもschema validとなりcross-project漏えいを防げない。
- 改善(to-be): 選択肢はreport-level scopeまたはslot-level provenance。mixed reportsを安全に扱うためslot-level `system,tenantId,projectId,sourceRunId,classification` を必須、summaryだけはowner-approved global classificationを許可する。
- 許可ファイル/スコープ: `docs/spec/`, `docs/adr/`, `packages/shared/src/reporting/`, `packages/server/src/scheduler/tasks/`, `packages/shared/tests/`, `packages/server/tests/`
- 禁止事項: 共通Executor Contractに加え、recipient値からsource scope合成、unscoped detail fallback、表示後maskだけ。
- 前提/停止条件: TASK-SPC002受入とsecurity/data owner承認が必要。provenance schema未確定ならTASK-PRG044をBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] 全slotがimmutable source provenance/classificationを持ちunscoped detailをreject
  - [ ] PROJECT-A slotをPROJECT-B recipientへ送るnegative testが送信前fail
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: report schema/provenance + cross-project delivery tests + `mise run ci` → pass。
  - requires-real-env: staging tenant/project negative deliveryをPRG-031へ記録。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-024/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): TASK-SPC002
- 仕様トレース: REQ-040/042, SPEC-INT-067/069/082/083, AC-040-1/042-1; PRG-044。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC025: delivery claim・lease・crash recoveryをacceptance化する
- 対応所見: SPC-025
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `idempotentDelivery.ts:4-7` は重複なしを約束するがconcurrent claim/lease/crash semanticsがない。
- 精査で判明した欠陥: 非排他read/write実装でも結果文だけを満たすと主張でき、external send重複が再発する。
- 改善(to-be): 推奨は `INSERT ... ON CONFLICT DO NOTHING RETURNING` のatomic claim、claimant token、15分lease、sent/failed/retry state、crash reconciliationをnormative ACにする。
- 許可ファイル/スコープ: `docs/spec/`, `docs/adr/`, `packages/prjops/src/lib/`, `packages/server/src/db/`, `packages/prjops/tests/`, `packages/server/tests/`
- 禁止事項: 共通Executor Contractに加え、read-then-write claim、無期限pending、明示なし再送、DB rowだけdedupeしてsend重複容認。
- 前提/停止条件: TASK-SPC002受入とdelivery/SRE owner承認が必要。lease/retry policy未決ならTASK-PRG047をBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] claim ownership/TTL/state/retry/crash recoveryがmachine-readable AC
  - [ ] 50 concurrent callersでsend=1、stale claimant/recovery境界が期待どおり
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: delivery concurrency + ephemeral PG claim tests + `mise run ci` → pass。
  - requires-real-env: staging Graph send前後のcrash injectionをPRG-031へ記録。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-025/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): TASK-SPC002
- 仕様トレース: REQ-018, SPEC-INT-052/069, SPEC-EXT-023, AC-018-2/042-1; PRG-047。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済

### TASK-SPC026: Teams actionへimmutable actor identityを要求する
- 対応所見: SPC-026
- 観点(surface / lens): 仕様 / 仕様完全性
- 現状(as-is): `teamsConversationAgent.ts:292-300,426-447,485-491` はpersonaをactor/requestedByに使い、AAD object IDをactionへ伝播しない。
- 精査で判明した欠陥: append-only要件だけでは個人を特定できないpersona actorでも準拠となる。
- 改善(to-be): 推奨identityは `(tenantId,aadObjectId)`、persona/profileはauthorization context、display nameは任意PIIとして分離する。command、code task、dashboard、external actionの全境界へimmutable subjectを伝播する。
- 許可ファイル/スコープ: `docs/spec/`, `docs/adr/`, `packages/server/src/agents/`, `packages/server/src/db/`, `packages/server/tests/`
- 禁止事項: 共通Executor Contractに加え、display name/emailをidentity正本、personaだけのactor、不要PII増加、既存audit改変。
- 前提/停止条件: TASK-SPC002受入とidentity/privacy owner承認が必要。retention/minimization未決ならTASK-PRG048をBLOCKED。
- 完了条件(DoD、チェックボックス):
  - [ ] 全Teams actionがtenant+AAD object IDと別persona contextをaudit/taskへ保持
  - [ ] 同persona別AAD usersが別actorとなり、missing immutable IDはaction拒否
  - [ ] `mise run ci` exits 0
- 検証手順:
  - verified-integration: teamsConversationAgent attribution/PII tests + `mise run ci` → pass。
  - requires-real-env: staging2 users同personaでaudit attributionをPRG-031へ記録。
  - 偽装禁止: owner署名・実環境未実施をmock、実装コメント、dev modeで完了扱いしない。
- 証跡の置き場: `.orchestration/evidence/SPC-026/`（`integration.md`, `real-env.md`, redacted logs, owner decision）
- 依存(blocked-by): TASK-SPC002
- 仕様トレース: DevOps AC-026a / ADR-0005/0006 / PRG-048。actor attribution ACはowner採番。
- ステータス: [ ] 未着手 / [ ] 実装中 / [ ] 検証中 / [ ] 受入済
