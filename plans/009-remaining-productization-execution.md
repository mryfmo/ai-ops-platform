# Plan 009: 残存製品化工程を依存ゲート順に完遂し go-live 判定を閉じる

> Planned at commit: `6a6c1aa`
> Planned with working tree: Plan 005 の受入済み未コミット差分を含む
> Executor: Codex `gpt-5.6-sol` reasoning `high` をオーケストレーターとする

## Status

`TODO`

- **Effort**: XL
- **Priority**: P0
- **Risk**: CRITICAL — 認可、外部副作用、production運用を誤ると情報漏えい・誤配信・監査不能・復旧不能になる。
- **Depends on**: Plan 001
- **Category**: security / correctness / integration / operations / go-live
- **Planned at**: commit `6a6c1aa`, 2026-07-11

- Plan 001: `DONE`。
- Plan 005: coreローカル仕様・実装・テスト・独立レビューは受入済み。実sandbox adapterとMicrosoft 365実テナント証跡がないため `BLOCKED`。
- Plan 002: 正本データ契約、Entra backfill、persona優先順位、PII承認が未確定のため `BLOCKED`。
- Plans 003/004/006/007: 依存Planとoperator decisionの完了待ち。
- Plan 008: Plans 001〜007の受入、実環境、運用設計の完了待ち。

## Executor instructions

このPlanは後工程での推測、仕様補完、完了誤認を防ぐための正本である。executorは次を順守する。

- [ ] 本Planを全文読了し、着手する子Plan `plans/002-*`〜`plans/008-*` も全文読了する。
- [ ] `.agents/worklog/codex/learn/learn_index.md` と関連learnを読む。
- [ ] `git status --short --branch` と `git diff --stat 6a6c1aa` を記録し、既存差分を消さない。
- [ ] 未確定値を推測しない。該当する入力ゲートを `BLOCKED` として証跡化する。
- [ ] 各単一タスクを1 task packet、1 worker result、1独立review result、1 acceptance recordで閉じる。
- [ ] workerは許可ファイル以外を変更しない。scope追加は新task packetに分離する。
- [ ] `task_type=code`だけはテストを先に追加し、意図した失敗を確認してから最小実装を行う。他typeは定義済み固有protocolを使う。
- [ ] 外部書込みはsandbox資源、明示opt-in、cleanup、redacted evidenceが揃う場合だけ実行する。
- [ ] human approvalが必要なmerge、production deploy、production writeを自動実行しない。
- [ ] 子Planの全Done criteriaと本Planのacceptance taskを満たすまでREADMEを`DONE`にしない。

### Drift check

着手時に次を実行する。差分が計画前提を壊す場合は実装せず本Planを更新する。

```bash
git rev-parse HEAD
git status --short --branch
git diff --stat 6a6c1aa
git log --oneline --decorate -10
mise run ci
pnpm audit --prod
```

Drift判定:

- [ ] package構成、DB schema、認可境界、子Plan依存関係が変わっていない。
- [ ] Plan 005受入済み差分が欠落・巻戻し・競合していない。
- [ ] `mise run ci` の失敗が既存か新規か、最初の失敗ログで分類されている。
- [ ] driftがあれば `plans/009-*` のCurrent state、依存、task packetを先に更新する。

## Plan quality self-audit

- [x] 現在の完了、ローカル完了、外部未検証、未着手を分離した。
- [x] Plans 002〜008を再実装せず、依存ゲートとacceptanceを束ねた。
- [x] 各単一タスクに作業、完了条件、検証、STOP条件を置き、共通のmodel/precondition/allowlist/evidence規則を継承させた。
- [x] モデル選択、独立review、同一根本原因再発時だけの上位tier移行を定義した。
- [x] sandbox限定、秘密値非保存、human gate、cleanupを安全回帰へ固定した。
- [ ] fresh-context reviewerが本Planを `ACCEPT` している。
- [ ] executor着手時のdrift checkがgreenまたは差分反映済みである。

## Why this matters

ローカルのテスト成功だけでは、実データの認可、Microsoft 365/GitHub/AI CLIの実接続、複数replica、backup/restore、秘密情報ローテーション、運用alertまで成立した製品とはいえない。反対に、未確定の正本データ契約やtenant権限をAIが補完すると、情報漏えい、誤配信、重複副作用、監査不能を招く。本Planは意思決定、実装、外部検証、運用受入を分離し、各工程を証拠付きで閉じる。

## Current state

### 完了済み

- [x] Plan 001: fresh PostgreSQL、migration、監査保持・append-only境界を受入済み。
- [x] Plan 005 coreローカル実装: Graph URL/RSC policy、change単位dedupe、lifecycle/renew/delta、MSAL token provider、retry、sandbox-safe smoke APIを実装済み。
- [x] Plan 005ローカル検証: focused tests、server typecheck、workspace `mise run ci` がgreen。workspace testは1,147件成功。
- [x] Plan 005独立review: P005-T08/T09/T11のacceptance recordが存在する。
- [x] `pnpm audit --prod`: MSAL経路の該当advisoryなし。既存のlow 1件、moderate 3件はPlan 008で処置する。

### 未完了

- [ ] Plan 005残件: 実sandbox adapter、RSC install/consent、Exchange App RBAC、公開HTTPS callback、created/updated/deleted/lifecycle/renew/delta、Outlook送信、DB相関の証跡。
- [ ] Plan 002: authoritative `prjops-data`契約、Entra安定ID、取得側認可、production provider。
- [ ] Plan 003: AGT-01〜07の永続job loop、承認、冪等配信、運用監視。
- [ ] Plan 004: GitHub/monitor eventからDevOps状態台帳とhuman-gated副作用への実配線。
- [ ] Plan 006: Claude Code/Droidの隔離実行、patch検証、draft PR、実metric report。
- [ ] Plan 007: Web/API/ExcelのSQL側認可、共有Pool、入力制限、claim/lease、reconciliation。
- [ ] Plan 008: supported runtime、CI parity、IaC、HA、observability、DR、rotation、実環境E2E、go/no-go。

### 現在確認されている危険な仮実装

- `packages/web/src/app/dashboard/page.tsx:58` は空のstakeholder providerを生成する。
- `packages/web/src/app/api/data/manager-summary/route.ts:39` は空のstakeholder providerを生成する。
- `packages/web/src/app/api/data/investor-summary/route.ts:25` は空providerを生成し、同ファイル30行目は空report providerを渡す。
- `packages/web/src/app/api/data/executive-summary/route.ts:32` は空providerを生成する。
- `packages/web/src/app/api/chat/route.ts:36` は空providerを生成する。
- `packages/web/src/app/api/data/timeseries/route.ts:27` は空providerを生成する。
- `packages/web/src/app/api/data/projects/route.ts:29` は空providerを生成する。
- `packages/web/src/app/api/data/agent-activity/route.ts:27` は空providerを生成する。
- `packages/server/src/index.ts:123` は `SAMPLE_STAKEHOLDERS` を宣言し、`packages/server/src/index.ts:241` はsample由来caller profileをproduction compositionへ渡す。
- Plan 007対象にrequestごとのPool、post-fetch auth、未sanitize raw event、無制限xlsx、claimなしledger、Docker失敗握り潰しが残る。
- `packages/server/src/tools/graphSmoke.ts:235` はallowlisted smoke APIを実装済みだが、`packages/server/src/tools/graphSmoke.ts:318` のCLIは外部adapterとtenant gateがない限り意図的にExternal STOPを返す。これを成功に偽装しない。

## Commands you will need

```bash
mise run install
mise run test
mise run typecheck
mise run lint
mise run format
mise run traceability
mise run ci
pnpm audit --prod
git diff --check
git diff --name-only
git status --short --branch
make require-crit-review
```

外部testのcommandは各子Plan/runbookに記載する。secret値をcommand line、plan、log、artifactへ展開しない。

## Suggested executor toolkit

### モデル割当規則

| 役割               | 既定                                                                          | 使用条件                                                                         |
| ------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Orchestrator       | `gpt-5.6-sol high`                                                            | task分割、依存判定、成果精査、accept/reject、全体gate                            |
| Worker: 機械的変更 | 利用可能な最小の`gpt-5.6-sol` tier                                            | docs、fixture、限定的rename、単純test追加                                        |
| Worker: 高リスク   | `gpt-5.6-sol high`                                                            | auth、DB migration、concurrency、secret、外部副作用、CI/IaC                      |
| Reviewer           | workerと別contextの`gpt-5.6-sol high`                                         | diff、test、脅威、仕様逸脱をread-only review                                     |
| Escalation         | `gpt-5.6-sol` reasoning `xhigh`、または実行面で名称を確認できる次の上位モデル | 明示修正後も同一root-cause keyが再発した場合だけ。どちらも利用・確認不能ならSTOP |

モデル名/tierを実行面で確認できない場合は、確認できた設定だけを記録し、虚偽のモデル名を証跡に書かない。

### task packet必須項目

```text
task_id:
task_type: code | decision | external | review | docs
objective:
source_plan_and_step:
preconditions:
allowed_files:
forbidden_actions:
required_tests_red:
required_tests_green:
acceptance_checks:
evidence_paths:
stop_conditions:
model_and_reasoning:
attempt_number:
root_cause_key:
human_approval_reference:
```

各単一タスクは次を継承する。type別必須fieldが空、または非適用fieldに`not_applicable_reason`がなければ`ASSIGNED`へ進めない。

- Model: 明示がなければ `gpt-5.6-sol high`。機械的read-onlyだけ最小tierへ下げられる。
- Preconditions: 当該Phase開始条件、同Phaseの直前task `ACCEPTED`、依存Planのmain merge SHAが現在HEADのancestorであること。
- Allowed files: 下表のphase allowlistから、割当前に実在する個別file pathへ狭めてtask packetへ列挙する。directory wildcardのまま割り当てない。
- Evidence: `.orchestration/evidence/<task-id>/` のcommand logと `.orchestration/acceptance/<task-id>.json`。両方がなければ未完了。
- Commands: code taskはfocused RED/GREEN test、対象package test/typecheck、`git diff --check`、root `mise run ci`をtask packetに完全なcommandとして書く。
- Scope change: allowlist外fileが必要ならworkerはSTOPし、orchestratorが別taskまたは改訂packetを作る。

task type別protocol:

- `code`: test RED→最小実装→focused GREEN→package gate→root CI→独立diff review。
- `decision`: owner、選択肢、決定、理由、適用日、署名参照が必須。RED testは要求しない。
- `external`: no-write preflight→human opt-in→sandbox operation→相関→cleanup→redacted evidence。RED testはadapter codeだけに要求する。
- `review`: sourceを変更せず、対象SHA、観点、findings、ACCEPT/REVISEを記録する。
- `docs`: source/evidence link checkと事実照合を行う。実装成功の代替にはしない。

packet fieldの必須/nullable規則:

- 全type必須: task ID/type/objective/source/preconditions/allowed files/forbidden actions/acceptance checks/evidence/STOP/model/attempt。
- `code`: RED/GREEN commands必須。human approvalとroot causeは不要なら`not_applicable_reason`を記載する。
- `decision`: human approval必須。RED/GREENは`not_applicable_reason: non-code owner decision`とする。
- `external`: human approval、preflight/operation/cleanup commands必須。adapter変更がなければRED/GREENへ非適用理由を書く。
- `review`: reviewer model、target SHA、review command/観点必須。RED/GREENとhuman approvalは非適用理由を書く。
- `docs`: source/evidence link checks必須。RED/GREENとhuman approvalは非適用理由を書く。
- 初回attemptの`root_cause_key`はnull可。REVISE後のattempt 2以降は前回root-cause key必須。

acceptance JSON必須field:

```json
{
  "schema_version": "1.0",
  "task_id": "P009-Fxx-Txx",
  "task_type": "code|decision|external|review|docs",
  "status": "accepted|blocked",
  "execution_spec_commit": "Plan 009を固定した40 lowercase hex git commit",
  "execution_spec_blob_sha256": "そのcommit内Plan 009 blobの64 lowercase hex",
  "attempt_number": 1,
  "root_cause_key": null,
  "worker_model_verified": "runtimeで確認できた値またはunverified",
  "reviewer_model_verified": "runtimeで確認できた値またはunverified",
  "pr_url": null,
  "merge_sha": null,
  "human_approval_reference": null,
  "commands": [{ "command": "exact command", "exit_code": 0, "log": "relative path" }],
  "artifacts": [{ "path": "relative path", "sha256": "64 lowercase hex" }],
  "review_outcome": "ACCEPT",
  "completed_at": "ISO8601"
}
```

`code`はcommands、review、PR/merge（変更をmergeするtaskの場合）が必須。`decision`はhuman approval、`external`はpreflight/operation/cleanup artifact、`review`はreview outcomeが必須。該当しないfieldだけnullを許可する。

| Phase | task packetへ狭める前の最大allowlist                                                    |
| ----- | --------------------------------------------------------------------------------------- |
| F00   | `plans/`, `.orchestration/`, acceptance validator用`package.json`/`scripts/`/`tests/`   |
| F01   | `docs/contracts/`, `docs/adr/`, `verification/`, `.orchestration/`                      |
| F02   | Plan 002 Scope記載path、DB migration、対応tests/docs                                    |
| F03   | Plan 005 Scope記載path、Graph smoke adapter、対応tests/runbooks                         |
| F04   | `packages/prjops/`, PrjOps用server DB/scheduler、対応tests/runbooks                     |
| F05   | `packages/devops/`, DevOps用server DB/handler、`.github/workflows/`、対応tests/runbooks |
| F06   | coding/report用server route/DB、`.github/workflows/`、対応agent/report tests/docs       |
| F07   | `packages/web/`, Excel/API用server path、container定義、対応tests/docs                  |
| F08   | runtime/lockfile/CI/container/IaC/observability/backup/runbook/verificationの対象path   |
| F09   | `plans/`, `verification/`, `.orchestration/`。product sourceはread-only                 |

### 成果受入state machine

```text
READY -> ASSIGNED -> RED_CONFIRMED -> IMPLEMENTED -> WORKER_VERIFIED
      -> REVIEW_ACCEPTED -> ORCHESTRATOR_VERIFIED -> ACCEPTED
      -> REVIEW_REVISE -> CORRECTION -> REVIEW_ACCEPTED
      -> BLOCKED（入力・権限・外部状態不足）
```

- [ ] `REVIEW_REVISE`ごとに `root_cause_key`、期待修正、再検証を記録する。
- [ ] 同一`root_cause_key`が明示修正後にも再発した場合だけ上位tierへ移す。
- [ ] 別原因の新規指摘は再発回数に数えない。
- [ ] review合格後もorchestrator自身が重要commandとdiffを再検証する。

## Scope

In scope:

- Plans 002〜008の入力確定、実装、外部検証、独立review、受入。
- Plan 005の受入済みローカル差分の保全と実tenant gate。
- product-levelの認可、secret、監査、冪等性、HA、DR、observability、runbook、go/no-go。
- `plans/README.md`の事実に基づく状態更新。

Out of scope:

- 未承認のproduction write/deploy/merge。
- 正本データ、persona、PII、RPO/RTO、SLOのAIによる推測決定。
- child Plan外の新機能、UI刷新、任意のframework置換。
- testを通すための認可緩和、mock-only合格、skip追加、例外握り潰し。

## Git workflow

- [ ] task開始前に対象Plan用 `agent/<plan-number>-<slug>` branchを使用する。
- [ ] 現在のPlan 005差分はreview済み対象だけを意図的にstageし、`.agents/` worklogをcommitしない。
- [ ] commit前に `git diff --cached --check`、秘密混入検査、対象test、`mise run ci`を通す。
- [ ] AI生成PRに`ai-generated` labelを付け、PR templateを埋める。
- [ ] mainへ直接pushせず、自動mergeしない。
- [ ] child Planごとに独立PRとacceptance recordを作る。混在差分を作らない。
- [ ] dependent Planは、依存PlanのPRが人間によりmainへmergeされ、merge commitを含む最新mainからbranchを作成した後に開始する。
- [ ] phase開始時に `git merge-base --is-ancestor <dependency-merge-sha> HEAD` を依存Planごとに実行する。exit 1なら開始しない。
- [ ] 独立reviewのACCEPTだけをmerge済みと解釈しない。acceptance recordへPR URLとmain上のmerge SHAを記録する。

## Steps

### Phase 0: 基準線と受入済み差分を固定する

#### P009-F00-T01 現状snapshotを取得する

- Model: 最小tier、read-only。
- Preconditions: repository root、secretを表示しないshell環境。
- Work:
  - [ ] HEAD、branch、tracked/untracked diff、子Plan状態、acceptance artifactsを一覧化する。
  - [ ] `mise run ci` と `pnpm audit --prod` を実行しexit codeと件数を記録する。
  - [ ] Plan 001/005の完了主張を実ファイルとtest logへ相互参照する。
- Complete when:
  - [ ] 基準commit、dirty diff、CI、audit、既知blockerを1件のbaseline evidenceに保存した。
- Verify:
  - [ ] `git status --short --branch` がevidenceと一致する。
  - [ ] CI green。失敗なら次taskへ進まず原因を分類する。
- Evidence: `.orchestration/acceptance/P009-F00-T01-baseline.md`。
- STOP: 受入済みPlan 005差分の欠落、未知の破壊的diff、CI red。

#### P009-F00-T02 Plan 005ローカル成果をPR単位へ固定する

- Model: `gpt-5.6-sol high` orchestrator。
- Preconditions: T01 green、P005-T08/T09/T11 acceptance確認済み。
- Work:
  - [ ] Plan 005以外の差分が混入していないかpathごとに精査する。
  - [ ] generated file、worklog、secret、raw tenant IDを除外する。
  - [ ] Crit gateが要求された場合は規定どおりCrit dataを読みreceiptを作る。
  - [ ] intentional commit、push、draft PRを人間の実行許可範囲で作る。
- Complete when:
  - [ ] Plan 005ローカル成果のcommit/PR SHAとreview evidenceが一意に固定された。
- Verify:
  - [ ] focused tests、`mise run ci`、`git diff --check`がgreen。
  - [ ] PRがmain直push、自動merge、production writeを行わない。
- Evidence: `.orchestration/acceptance/P009-F00-T02-plan005-local.md`、PR URL。
- STOP: scope外diff、secret検出、review未完、userがcommit/pushを許可していない。

#### P009-F00-T03 Plan状態表を事実へ同期する

- Model: 最小tier。
- Preconditions: T01 evidence。
- Work:
  - [ ] Plan 001を`DONE`のまま維持する。
  - [ ] Plan 005を`BLOCKED: local accepted; tenant evidence pending`にする。
  - [ ] Plans 002〜008を根拠なく`DONE`へ変更しない。
- Complete when: READMEと各Plan Statusが矛盾しない。
- Verify: `rg -n '001|002|003|004|005|006|007|008|009' plans/README.md`を人が照合する。
- Evidence: README diff。
- STOP: acceptance artifactと状態が不一致。

#### P009-F00-T04 repo固有のPlan品質gateを手動受入する

- Model: fresh-context `gpt-5.6-sol high` reviewer、read-only。
- Preconditions: T03完了。本repoに `scripts/validate_plan_quality.py`、対応hook、Make/CI targetがないことを検索済み。
- Work:
  - [ ] 外部canonical validatorを参考実行し、repo非依存checkと外部repo固有checkを分離する。
  - [ ] `early_plan_comparison_available`や存在しない`uv run`/`make verify`を満たすために偽file/commandを追加しない。
  - [ ] fresh-context reviewerが子Planとの依存、原子性、検証可能性、安全性をread-only reviewする。
  - [ ] 指摘修正後、同じreviewerまたは別fresh reviewerから`ACCEPT`を得る。
- Complete when: manual quality receiptにvalidator output、非適用理由、review ACCEPT、plan SHA-256がある。
- Verify: `rg -n 'validate_plan_quality|plan-quality' scripts Makefile .github .claude 2>/dev/null` の実結果とreceiptが一致する。
- Evidence: `.orchestration/acceptance/P009-F00-T04-plan-quality.md`。
- STOP: reviewerがREVISE、必須章欠落、非適用checkをPASSと偽装。

#### P009-F00-T05 acceptance manifest validatorを実装する

- Model: `gpt-5.6-sol high`、code task。
- Preconditions: T04 ACCEPTED、上記acceptance JSON schema固定済み。
- Allowed files: `scripts/validate-acceptance-manifest.mjs`、対応test、`package.json`のscript entryだけ。
- Work: [ ] Plan 009を最初にcommitしたimmutable `execution_spec_commit`と、そのcommit内blob SHA-256をmanifestへ固定する。 [ ] validatorはworking treeでなく `git show <execution_spec_commit>:plans/009-remaining-productization-execution.md` の `^#### (P009-F[0-9]{2}-T[0-9]{2})` をauthoritative ordered task universeとして抽出する。 [ ] `--through <task-id>`は先頭から指定taskまでの完全一致だけを要求し、未来taskを要求しない。 [ ] `--final`は全taskの完全一致を要求する。 [ ] valid/field欠落/重複/壊れたhash/非0 command/未merge dependency/指定prefix欠落/全件欠落fixtureでREDを確認する。 [ ] schema、artifact hash、command log存在、dependency merge SHAを検証する。
- Complete when: incremental/final modeのunit testsがgreenで、plan記載taskの欠落/余分/順序違反/重複、blocked task、frozen blob hash mismatch、broken link/hash、required null、nonzero command、dependency非ancestorのいずれでもexit 1になる。F00-T05自身の実行時に未来taskを要求しない。
- Verify: `node --test tests/validate-acceptance-manifest.test.mjs`。実manifestはT05 acceptance候補作成後に `node scripts/validate-acceptance-manifest.mjs --through P009-F00-T05 verification/acceptance-manifest.json` で検証する。
- Evidence: `.orchestration/acceptance/P009-F00-T05.json`。
- STOP: subjective reviewだけでPASS、schema errorをwarningにする、外部network依存。

### Phase 1: operator decisionと外部入力を確定する

各taskは実装ではなく、署名済みdecision recordまたはsecret store上の設定存在を確認する。秘密値自体は保存しない。

#### P009-F01-T01 PrjOps正本データ契約を確定する

- Model: `gpt-5.6-sol high`、設計・データ境界。
- Work:
  - [ ] repository/branch/path/schema version/checksumを指定する。
  - [ ] project、stakeholder、recipient、report sourceのownerと更新APIを指定する。
  - [ ] stable key、nullable列、削除、競合、履歴、backfill規則を指定する。
- Complete when: product/data owner署名付きcontractがあり、fixtureを機械検証できる。
- Verify: schema parserでvalid/invalid fixtureを検証し、unknown fieldと欠落keyをfailさせる。
- Evidence: `docs/contracts/prjops-data.md`と署名参照。
- STOP: authoritative source、owner、更新方式のいずれかが不明。

#### P009-F01-T02 Entra主体・backfill mappingを確定する

- Work:
  - [ ] tenant ID + object IDを主体の一意keyとするかowner承認を得る。
  - [ ] legacy email主体からのmapping、未解決、重複、退職者処理を決める。
  - [ ] token claim、group/app role、test personasを指定する。
- Complete when: backfill dry-run入力とexpected resultが承認済み。
- Verify: duplicate、unknown tenant、missing oid、email変更ケースをfixtureでfail/pass確認。
- Evidence: `docs/contracts/entra-subject-mapping.md`。
- STOP: tenant/object IDを取得できない、mapping owner不在。

#### P009-F01-T03 persona優先順位とscope semanticsを確定する

- Work:
  - [ ] PRF-01〜05、investor、PRF-M/L/Gの競合時優先順位を決める。
  - [ ] project scopeがglobal/nullの場合の可視性を明示する。
  - [ ] inactive recipient、cross-tenant、multi-roleの扱いを決める。
- Complete when: decision tableが全組合せを一意に決める。
- Verify: allow/deny matrixに曖昧または重複expected outcomeがない。
- Evidence: `docs/contracts/persona-scope-matrix.md`。
- STOP: global/nullを暗黙allow/denyしようとする。

#### P009-F01-T04 PII・保持・residencyを承認する

- Work:
  - [ ] 各fieldのPII分類、保存可否、region、retention、削除、監査例外を決める。
  - [ ] Teams/Outlook/GitHub/LLMへ渡せる最小fieldを決める。
- Complete when: security/privacy/data ownerが署名する。
- Verify: data-flow図の各store/processor/outputに分類とretentionがある。
- Evidence: security decision record。
- STOP: PIIを仮の善意解釈で保存・LLM送信する。

#### P009-F01-T05 Web trust proxyとrate keyを確定する

- Work:
  - [ ] trusted proxy CIDR/header、直接接続拒否、client keyの生成規則を決める。
  - [ ] persona/API別rate、burst、429、distributed counter要否を決める。
- Complete when: deployment architectureと一致する承認済み設定がある。
- Verify: spoofed forwarding headerとproxy bypassのexpected denialを定義する。
- Evidence: ADRまたはsecurity record。
- STOP:任意headerを信頼する設計。

#### P009-F01-T06 Excel制限・競合・reconciliationを確定する

- Work:
  - [ ] max bytes、rows、sheets、cells、archive ratio、timeoutを決める。
  - [ ] dry-run/execute key、claim lease、retry、crash、partial failure規則を決める。
  - [ ] source-of-truthとのconflict/reconciliation APIを決める。
- Complete when: product/data/operations ownerがlimitsと状態遷移を承認する。
- Verify: oversize、zip bomb、double submit、lease expiry、partial commitの期待結果が一意。
- Evidence: Excel import contract。
- STOP: limitまたはreconciliation正本が不明。

#### P009-F01-T07 Microsoft 365 sandbox gateを準備する

- Work:
  - [ ] public HTTPS callback、tenant/client credential、RSC導入team/channelを用意する。
  - [ ] Exchange App RBACでtest mailboxだけを許可する。
  - [ ] test recipient、delegated/UI actor、cleanup権限を用意する。
- Complete when: preflightが値を表示せず全項目の存在・scopeだけをPASSする。
- Verify:非導入teamと非許可mailboxが拒否されるnegative setupがある。
- Evidence: redacted sandbox inventory、consent/RBAC verification。
- STOP: production資源、tenant-wide過剰権限、cleanup不能。

#### P009-F01-T08 GitHub・AI CLI・staging・運用入力を確定する

- Work:
  - [ ] sandbox repo、GitHub App permission、AIOPS_PR_TOKEN発行方式を確定する。
  - [ ] Claude Code/Droid version、provider key、cost/turn/timeout上限を確定する。
  - [ ] staging platform、network、secret store、container registryを確定する。
  - [ ] RPO/RTO、SLO、alert owner、on-call、support windowを承認する。
- Complete when: secret値を除く環境inventoryとhuman owner署名がある。
- Verify: expired/revoked token、budget超過、alert未応答、rollbackの演習条件が定義済み。
- Evidence: `verification/environment-inventory.md`とdecision links。
- STOP: production-only credential、ownerなし、budget上限なし。

### Phase 2: Plan 002 正本データと認可を完成する

Phase開始条件: F01-T01〜T04が全てACCEPTED、Plan 001 DONE。

#### P009-F02-T01 contract fixtureとvalidatorを実装する

- Work: [ ] valid/invalid fixtureを先に追加する。 [ ] schema/version/checksum validatorを純粋関数で実装する。
- Complete when: malformed、unknown version、checksum mismatch、duplicate keyがfail-closed。
- Verify: 対象package test、typecheck、traceability。
- Evidence: test logとcontract fixture digest。
- STOP: contractと実データが不一致。

#### P009-F02-T02 stable identity migrationとrepositoryを実装する

- Work: [ ] migrationを新規作成する。 [ ] tenant+oid、project scope、active recipientをDB取得側で表現する。 [ ] legacy backfill dry-runを作る。
- Complete when: fresh/upgrade/idempotent/backfill rollback testがgreen。
- Verify: disposable PostgreSQLでunique、FK、unknown mapping、UPDATE/DELETE権限を検査。
- Evidence: DB integration log。
- STOP: destructive backfill、未分類legacy row、audit mutation。

#### P009-F02-T03 Entra claimをcaller profileへ伝播する

- Work: [ ] token validation fixtureを先に追加する。 [ ] tenant/oid/rolesをserver/webへ伝播する。 [ ] email主体fallbackを削除する。
- Complete when: missing/foreign tenant、missing oid、expired token、role conflictが拒否される。
- Verify: auth integration tests、sample caller非使用検索。
- Evidence: auth matrix log。
- STOP: emailをauthorization keyに残す。

#### P009-F02-T04 production providerとSQL側scopeを配線する

- Work: [ ] `packages/web/src/server/db.ts`にprocess共有Poolを一度だけ生成する。 [ ] 空providerと`SAMPLE_STAKEHOLDERS`をproduction compositionから除く。 [ ] authoritative source providerを実装する。 [ ] project/persona/activeをquery条件にする。
- Complete when:全production routesが同じPoolと実providerを受け、scope外rowを取得しない。共有Poolの実装所有者はPlan 002だけとする。
- Verify: dashboard等9経路のallow/deny integration test、`rg`でsample/empty provider不使用確認。
- Evidence: route/provider coverage matrix。
- STOP:表示後mask、全件fetch後filter、global/nullの推測。

#### P009-F02-T05 backfill・sandbox認可matrix・受入を閉じる

- Work: [ ] dry-run差分をowner承認後にsandboxへ適用する。 [ ] 全persona/multi-role/inactive/cross-tenantを検証する。 [ ] child Plan 002 criteriaを全確認する。
- Complete when: Plan 002 acceptance record、CI green、README 002 DONE。
- Verify: `mise run ci`、DB queries、HTTP tests、独立security review。
- Evidence: `.orchestration/acceptance/P002-accepted.md`。
- STOP:未解決mapping、scope漏れ、PII違反、review未受入。

### Phase 3: Plan 005 Microsoft 365実tenant受入を閉じる

Phase開始条件: F01-T07 ACCEPTED、Plan 005ローカルPR固定済み。

#### P009-F03-T01 no-write preflightとleast privilegeを検証する

- Work: [ ] callback reachability、credential存在、RSC install、Exchange RBAC、allowlistをread-only確認する。 [ ] 非導入team/非許可mailbox denialを確認する。
- Complete when: opt-in前に全preflightがPASSし、権限がsandboxに限定される。
- Verify: redacted permission inventory、人間が対象IDを照合。
- Evidence: P005 tenant preflight。
- STOP:過剰権限、production資源、公開callback不達。

#### P009-F03-T02 実sandbox adapterをsmoke CLIへ配線する

- Work: [ ] `GraphSmokeOperations`をfetch/replyの相関metadataまで拡張し、各operationを既存Graph client/DB repoへ接続する。 [ ] edit/deleteはapp-only成功を偽装せずdelegated/UI外部taskに残す。 [ ] secret store/envから設定を読み、policyのteam/channel/mailbox/evidence rootと完全一致させる。 [ ] CLI `--sandbox`をexact opt-inとpreflight成功時だけ`runGraphSmoke`へ接続する。
- Complete when: adapter contract testが全operation、DB correlation、cleanupを通り、adapterなし/設定欠落/不一致はE-SMK07相当でfail-closedになる。
- Verify: `pnpm --filter @aiops/server test -- graphSmoke`、server typecheck、CLIのno-opt-in negative test。
- Evidence: `.orchestration/acceptance/P009-F03-T02.md`。
- STOP: raw credentialをargument/logへ出す、production default、DB correlationをstubにする。

#### P009-F03-T03 subscription・Teams・Outlook smokeを実行する

- Work: [ ] 配線済みCLIをexact opt-inで実行し、subscription作成、root/reply、sendMailを行う。 [ ] client-request-idとDB rowを相関する。 [ ] finally cleanupする。
- Complete when: 201/accepted response、通知受信、fetch、reply、DB相関、cleanup結果が証拠化される。
- Verify: `pnpm --filter @aiops/server run graph:smoke -- --sandbox`がexit 0、allowlisted evidence schema、hash化resource refs、raw secret/本文なし。
- Evidence: graph smoke JSON/MDと`.orchestration/acceptance/P009-F03-T03.md`。
- STOP:cleanup不能、相関0件、証跡上書き、非sandbox宛先。

#### P009-F03-T04 change/lifecycle/renew/deltaを検証する

- Work: [ ] delegated/UI actorでedit/deleteを発生させる。 [ ] lifecycleとrenewを発生/模擬し実callbackで確認する。 [ ] missed windowをdelta backfillする。
- Complete when: created→updated→deletedを落とさずexact redeliveryだけskipし、renew/delta DB stateが一致。
- Verify: event identity、subscription ID、message ID、request ID、DB auditを相互照合。
- Evidence: redacted timeline。
- STOP: app-only非対応操作を成功と主張、pollingだけでsubscription成功と主張。

#### P009-F03-T05 Plan 005最終受入

- Work: [ ] child Plan全criteriaと安全回帰を再確認する。 [ ] independent reviewerがtenant evidenceを読む。 [ ] README 005を更新する。
- Complete when: P005 final acceptance、CI green、local+tenant証跡、Plan 005 DONE。
- Verify: `mise run ci`、focused tests、review ACCEPT。
- Evidence: `.orchestration/acceptance/P005-accepted.md`。
- STOP:実tenant項目のskip、mock-only、evidence不一致。

### Phase 4: Plan 003 PrjOps実行loopを完成する

Phase開始条件: Plans 002/005 DONE。

#### P009-F04-T01 永続job state machineとCAS claim

- Work: [ ] RED test。 [ ] analyze→report→verify→approval→deliver、attempt、next_run、traceをmigration/repoへ実装。 [ ] CAS claim/restart/retry/escalateを実装。
- Complete when:並行worker、crash、lease expiry、3回目escalateで二重実行なし。
- Verify: DB integration + fake clock + 2 worker test。
- STOP: process memoryのみ、非atomic claim。

#### P009-F04-T02 Outlook/Teams/GitHub intakeを正規化する

- Work: [ ] channel別contract tests。 [ ] `IncomingReport`へ変換。 [ ] sender/project解決とclarificationを永続化。 [ ] sanitize後のみ正本更新。
- Complete when: 3 channelのvalid/invalid/duplicateが同一状態遷移を通る。
- Verify: secret/PII fixture、unknown sender/project、duplicate delivery。
- STOP:raw text保存、正本外更新。

#### P009-F04-T03 AGT-03/04/07分析・report・verifyを配線する

- Work: [ ] 数値/色/表をpure libで計算。 [ ] sanitized narrativeだけLLMへ送る。 [ ] 全profileを検証後approval待ちへ進める。
- Complete when: source row→metric→report→audit traceが成立し、invalid LLM outputはfail。
- Verify: deterministic snapshot、boundary、prompt sanitization、schema rejection tests。
- STOP: LLM生成数値、根拠なし要約。

#### P009-F04-T04 approval・冪等配信・追跡を配線する

- Work: [ ] request時にrecipient再取得。 [ ] approver/time/reasonを監査。 [ ] recipient+report idempotency。 [ ] reminder/timeout/failure metrics/runbook。
- Complete when: approval前0送信、retry/restart二重送信0、inactive即時除外。
- Verify: concurrency、429/5xx、partial delivery、recipient status change tests。
- STOP: cached recipient、approval bypass。

#### P009-F04-T05 Plan 003実sandbox受入

- Work: [ ] 3 channel intake→master→analysis→approval→delivery E2E。 [ ] trace chainとcleanup。 [ ] independent review。
- Complete when: Plan 003 criteria全PASS、CI green、README 003 DONE。
- Verify: DB/external/audit ID chain、negative scenarios、review ACCEPT。
- Evidence: `.orchestration/acceptance/P003-accepted.md`。
- STOP: mock-only、手動DB改変、証跡欠落。

### Phase 5: Plan 004 DevOps実行loopを完成する

Phase開始条件: Plans 001/005 DONE、GitHub sandbox入力ACCEPTED。

#### P009-F05-T01 event/state repositoriesを実装する

- Work: [ ] normalized GitHub/monitor eventとbuild/deploy/incident/change state migration/repo。 [ ] delivery dedupeとCAS transition。
- Complete when: fresh/upgrade、duplicate、out-of-order、restart testsがgreen。
- Verify: disposable DB integration。
- STOP: audit-onlyで業務stateなし。

#### P009-F05-T02 BLD/DEP workflowを実配線する

- Work: [ ] sandbox workflow run取得。 [ ] build evidence収集。 [ ] deploy plan/approval/rollback state。 [ ] echo/missing scriptをfail-fast。
- Complete when:実runからstateが遷移し、human approvalなしdeploy 0。
- Verify: success/failure/cancel/timeout、unauthorized approval tests。
- STOP:production deploy、未pin action。

#### P009-F05-T03 INC/CHG/RPT/SEC/ORCHを実配線する

- Work: [ ] monitor incident生成とdedupe。 [ ] change human review。 [ ] report/security evidence。 [ ] failsafe state。
- Complete when:各agentにproduction callerとstate/audit outputがある。
- Verify: false positive、duplicate、retry、failsafe、scope denial。
- STOP:自動危険変更、reasonなしoverride。

#### P009-F05-T04 Plan 004 sandbox受入

- Work: [ ] GitHub/monitor end-to-end。 [ ] rollback/manual recovery。 [ ] independent review。
- Complete when: child criteria、CI、README 004 DONE。
- Verify: webhook→state→approval→side effect→audit trace。
- Evidence: `.orchestration/acceptance/P004-accepted.md`。
- STOP: mock-only、main write、cleanup不能。

### Phase 6: Plan 006 Claude Code/Droid/report workflowを完成する

Phase開始条件: Plans 001/002 DONE、F01-T08 ACCEPTED。

#### P009-F06-T01 confirmationとdispatch CASを強化する

- Work: [ ] Entra session/profile/nonce/expiry binding。 [ ] HMACとcallback secret分離。 [ ] queued→running CAS。
- Complete when: replay、expired、cross-user、double dispatchが拒否。
- Verify: auth/concurrency tests。
- STOP: bearer共有、one-timeでない確認。

#### P009-F06-T02 unprivileged agent runnerとartifact boundaryを実装する

- Work: [ ] read-only checkout/no persisted credential。 [ ] provider keyだけ付与。 [ ] patch+manifest+digest出力。 [ ] privileged publish jobで検証。
- Complete when: agent processからpush/PR tokenを読めず、改竄artifactを拒否。
- Verify: secret probe、path traversal、symlink、digest mismatch tests。
- STOP:agentへpush credential、main push。

#### P009-F06-T03 Claude Code/Droidをpinし予算を強制する

- Work: [ ] official action/CLI versionまたはSHA/checksum pin。 [ ] edit tool allowlist。 [ ] max turns/timeout/concurrency/cost。
- Complete when:双方がsandbox patchを作り、limit超過はfail-closed。
- Verify: version output、budget/timeout/tool denial tests。
- STOP:latest浮動参照、無制限実行。

#### P009-F06-T04 report metric extractionとingestを実装する

- Work: [ ] DB/GitHub snapshotからperiod/scope付きJSON。 [ ] missingはnull/NA。 [ ] LLM narrative schema。 [ ] ingest欠落をscheduled failure。
- Complete when:暗黙0なし、artifact digest/run ID監査あり。
- Verify: missing/partial/period mismatch/invalid output tests。
- STOP:LLM数値、silent success。

#### P009-F06-T05 sandbox draft PR/report受入

- Work: [ ] Claude/Droid両方でpatch→validated draft PR。 [ ] report→ingest。 [ ] secret exposure scan。 [ ] independent review。
- Complete when:Plan 006 criteria、actionlint、CI、README 006 DONE。
- Evidence: `.orchestration/acceptance/P006-accepted.md`。
- STOP:自動merge、token漏えい、片方未検証。

### Phase 7: Plan 007 Web/API/Excel境界を完成する

Phase開始条件: Plans 001/002 DONE、F01-T03/T05/T06 ACCEPTED。

#### P009-F07-T01 Plan 002共有Poolの負荷・境界を強化する

- Work: [ ] Plan 002でmerge済みの共有Pool interfaceを変更せず再利用する。 [ ] request scoped transaction/context、max/timeout/observabilityを追加する。 [ ] project/persona/activeのquery強制を負荷下で再検証する。
- Complete when:requestごとのPool 0、scope外row取得0、50 concurrent requestで接続上限内。新しいPool factoryを作らない。
- Verify: connection pressure、50 concurrent request、cross-scope tests。
- STOP:post-fetch filter。

#### P009-F07-T02 HTTP trust boundaryを強化する

- Work: [ ] body/content-type/timeout limits。 [ ] trusted proxy rate key。 [ ] distributed rate。 [ ] security headers。
- Complete when:413/415/429、spoof header、slow body、proxy timeoutが期待どおり。
- Verify: HTTP integration/security tests。
- STOP:任意forwarded header信頼。

#### P009-F07-T03 raw event深層sanitizeを実装する

- Work: [ ] nested object/array/stringの保存前sanitize。 [ ] LLM前/出力前sanitize。 [ ] original secret非保存。
- Complete when:全trust boundaryのnested fixtureがredactされる。
- Verify: property/fuzz tests、DB/log snapshot。
- STOP:top-levelだけ、監査logへraw保存。

#### P009-F07-T04 Excel claim/leaseとlimitsを実装する

- Work: [ ] atomic claim、lease、heartbeat、retry、crash recovery。 [ ] bytes/rows/sheets/cells/archive ratio/timeout。 [ ] dry-run/execute binding。
- Complete when:同一import同時実行1、oversize/zip bomb拒否、crash後安全再開。
- Verify: concurrency/process-kill/adversarial workbook tests。
- STOP:check-then-act、unbounded parse。

#### P009-F07-T05 Excel reconciliationとpersona UXを完成する

- Work: [ ] authoritative sourceとのconflict state/API。 [ ] partial failure/retry表示。 [ ] persona matrix UI。 [ ] accessibility keyboard/name/status。
- Complete when:operatorが安全に差分確認・再実行でき、scope外UI/API 0。
- Verify: reconciliation E2E、persona screenshot/route matrix、a11y smoke。
- STOP:自動上書き、UIだけの認可。

#### P009-F07-T06 container fail-fastとPlan 007受入

- Work: [ ] Docker build失敗握り潰しを除去。 [ ] load/security/Excel/Web E2E。 [ ] independent review。
- Complete when:Plan 007 criteria、Docker、CI、README 007 DONE。
- Verify:100 projects/50 users、Pool max、API negative matrix、container start/probe。
- Evidence: `.orchestration/acceptance/P007-accepted.md`。
- STOP:build failure green、limit未承認、P1 security finding。

### Phase 8: Plan 008 production go-live能力を完成する

Phase開始条件: Plans 001〜007 DONE、全acceptance recordあり。

#### P009-F08-T01 supported runtimeを統一する

- Allowed files: task packetで `.mise.toml`、package engines、container base、Actions runtime参照へ限定する。
- Work: [ ] 実施日の公式scheduleでsupported LTSを決定記録化する。 [ ] runtime参照だけを同一versionへ更新する。
- Complete when: local/container/Actionsのversion matrixが一致しbuild/test green。
- Verify: `mise current`、container `node --version`、Actions run log、`mise run ci`。
- Evidence: `.orchestration/acceptance/P009-F08-T01.json`。
- STOP:未support版、dependency更新を同じpacketへ混ぜる。

#### P009-F08-T02 production dependency advisoryを処置する

- Allowed files: root/package別manifest、`pnpm-lock.yaml`、dependency risk record、移行に必要なtestだけ。
- Work: [ ] low 1/moderate 3を含む全advisoryをapplicability判定する。 [ ] packageを1系統ずつ更新しmigration testする。 [ ]残余riskへowner/期限/回避策を付ける。
- Complete when: high/critical 0、各advisoryにpatched/non-applicable/signed riskの一意な処置がある。
- Verify: `pnpm audit --prod`、対象package test、lockfile diff review。
- Evidence: `.orchestration/acceptance/P009-F08-T02.json`。
- STOP:一括major update、根拠なしignore、runtime変更混在。

#### P009-F08-T03 CI parityとcoverage gateを完成する

- Work: [ ] local `mise run ci`とActionsを共通化。 [ ] web/critical composition coverage。 [ ] actionlint/audit/Docker/fresh+upgrade DB/gitleaks。
- Complete when:required checksがlocal DoDと同一でgreen。
- Verify: clean checkout `mise run ci`とGitHub run URLのcommand一覧・exit code一致。
- Evidence: `.orchestration/acceptance/P009-F08-T03.json`。
- STOP:skip/continue-on-errorでgreen化。

#### P009-F08-T04 staging IaCとimmutable artifactを実装する

- Work: [ ] service/network/TLS/secret refs/resources/probesを宣言。 [ ] immutable digest/SBOM/provenanceを生成する。
- Complete when:空のstagingへplan/applyでき、plaintext secretとmutable-only imageがない。
- Verify:IaC validate/plan、TLS/probe、digest/SBOM/provenance照合。
- Evidence: `.orchestration/acceptance/P009-F08-T04.json`。
- STOP:production apply、platform decision未承認。

#### P009-F08-T05 migration rolloutとrollbackを実装する

- Work: [ ] app rollout前migration job。 [ ] forward/backward compatibility window。 [ ] failed migration/app rollback手順。
- Complete when:stagingでupgrade、app rollback、migration再実行がデータ損失なく成功。
- Verify:fresh/upgrade/idempotency/rollback DB logs。
- Evidence: `.orchestration/acceptance/P009-F08-T05.json`。
- STOP:irreversible migrationにbackup/owner承認なし。

#### P009-F08-T06 HA schedulerとshared failsafeを実装する

- Work: [ ] DB lease/leader election。 [ ] shared failsafe/failure count。 [ ] leader death/clock drift/long task。
- Complete when:3 replicasでtaskのactive実行1、failover後重複副作用0。
- Verify:3-replica fault injection commandとDB/audit trace。
- Evidence: `.orchestration/acceptance/P009-F08-T06.json`。
- STOP:in-memory leader、split brain。

#### P009-F08-T07 observabilityとtraceを配備する

- Work: [ ] metricsをauth/network限定。 [ ] queue/task/delivery/DB/Graph/agent/failsafe metric。 [ ] HTTP→queue→agent→external→audit trace。
- Complete when:authorized scrapeとend-to-end traceが再現し、unauthorized scrapeは拒否。
- Verify:metrics denial/allow test、trace ID相互照合。
- Evidence: `.orchestration/acceptance/P009-F08-T07.json`。
- STOP:public metrics、PII/secret label。

#### P009-F08-T08 SLO alertとon-callを受入する

- Work: [ ] threshold/severity/owner/runbook/pagingをcode化。 [ ] synthetic failureを発生。 [ ] owner ack/escalationを記録。
- Complete when:承認SLO内にalertし、未ack時もescalationする。
- Verify:synthetic alert drill command、notification/ack timestamps。
- Evidence: `.orchestration/acceptance/P009-F08-T08.json`。
- STOP:ownerなし、silent alert、production障害注入。

#### P009-F08-T09 backup/restore/DRを演習する

- Work: [ ] backup/PITR/retention。 [ ] clean instance restore。 [ ] checksumとRPO/RTO計測。
- Complete when:clean restoreが承認RPO/RTO内で一致する。
- Verify:backup/restore exact command、row/artifact checksum。
- Evidence: `.orchestration/acceptance/P009-F08-T09.json`。
- STOP:production destructive drill、復旧不能。

#### P009-F08-T10 Microsoft Graph credentialをrotate/revokeする

- Work: [ ] Graph client secret/certificateを新旧overlap手順でrotate。 [ ] token取得とsandbox Graph call。 [ ]旧credential revoke。
- Complete when:新credential成功、旧credential失敗、subscription継続またはrunbookどおり回復。
- Verify:Graph token/callのredacted positive/negative log。
- Evidence: `.orchestration/acceptance/P009-F08-T10.json`。
- STOP:rollback credentialなし、tenant scope不一致。

#### P009-F08-T11 GitHub App credentialをrotate/revokeする

- Work: [ ] private key/token発行経路をrotate。 [ ] sandbox repo read/draft PR permission。 [ ]旧key revoke。
- Complete when:新key成功、旧key失敗、権限増加なし。
- Verify:installation tokenとsandbox APIのredacted positive/negative log。
- Evidence: `.orchestration/acceptance/P009-F08-T11.json`。
- STOP:agent processへpush tokenを渡す、main write。

#### P009-F08-T12 Anthropic credentialをrotate/revokeする

- Work: [ ] API keyをrotate。 [ ] budget内sanitized test request。 [ ]旧key revoke。
- Complete when:新key成功、旧key失敗、logにprompt/secretなし。
- Verify:provider requestのredacted positive/negative logとusage。
- Evidence: `.orchestration/acceptance/P009-F08-T12.json`。
- STOP:budget/retention承認なし、raw PII送信。

#### P009-F08-T13 Factory/Droid credentialをrotate/revokeする

- Work: [ ] Factory/Droid credentialをrotate。 [ ] sandbox read/edit boundary test。 [ ]旧credential revoke。
- Complete when:新credential成功、旧credential失敗、tool permission増加なし。
- Verify:Droid version/auth/tool denialのredacted log。
- Evidence: `.orchestration/acceptance/P009-F08-T13.json`。
- STOP:unbounded tool permission、production repo。

#### P009-F08-T14 application auth secretをrotate/revokeする

- Work: [ ] Entra/NextAuth/session関連secretを承認手順でrotate。 [ ]新session positive、旧credential/sessionの規定どおりnegativeまたはgrace expiry。
- Complete when:認証継続性が仕様どおりで旧secret使用不能。
- Verify:login/session redacted positive/negative matrix。
- Evidence: `.orchestration/acceptance/P009-F08-T14.json`。
- STOP:全user lockout、grace policy未承認。

#### P009-F08-T15 HMAC/callback secretをrotate/revokeする

- Work: [ ] coding confirmation/webhook callback HMACを個別にrotate。 [ ] dual verification windowが承認済みなら検証。 [ ]旧secret revoke。
- Complete when:新署名成功、旧署名はwindow後失敗、replay拒否。
- Verify:signature/replay redacted positive/negative tests。
- Evidence: `.orchestration/acceptance/P009-F08-T15.json`。
- STOP:無期限dual secret、callback停止のrollbackなし。

#### P009-F08-T16 実環境E2E harnessを実装する

- Allowed files: `verification/run_real_environment_e2e.sh`、scenario adapter、対応contract tests、runbookだけ。
- Work: [ ] 存在しないharnessをred-firstで作る。 [ ] scenario選択、sandbox allowlist、exact opt-in、timeout、redaction、per-scenario artifact、finally cleanupを実装。 [ ] adapter欠落はfail-closed。
- Complete when: `--list`、no-opt-in、invalid resource、adapter failure、cleanup failureのcontract testがgreenで、scenario未実行をPASSにしない。
- Verify: `test -x verification/run_real_environment_e2e.sh`、`verification/run_real_environment_e2e.sh --list`、shell lint、harness contract tests。
- Evidence: `.orchestration/acceptance/P009-F08-T16.json`。
- STOP:production default、secret引数、skipをsuccess扱い。

#### P009-F08-T17 E2E A Database/auditを実行する

- Work: [ ] fresh/upgrade/idempotency、append/select、UPDATE/DELETE拒否、partition/retention、restore checksum。
- Complete when:Plan 008 Test plan Aが全PASS。
- Verify: `verification/run_real_environment_e2e.sh --scenario database-audit --sandbox`。
- Evidence: `.orchestration/acceptance/P009-F08-T17.json`。
- STOP:disposable DBでない、scenario skip。

#### P009-F08-T18 E2E B Microsoft 365を実行する

- Work: [ ] RSC/subscription/lifecycle/renew/delta、Teams change/reply/card、Outlook、全negative、cleanup。
- Complete when:Plan 008 Test plan Bが全PASSしPlan 005 evidenceと相関。
- Verify: `verification/run_real_environment_e2e.sh --scenario microsoft-365 --sandbox`。
- Evidence: `.orchestration/acceptance/P009-F08-T18.json`。
- STOP:production tenant、delegated操作skip、cleanup failure。

#### P009-F08-T19 E2E C GitHub/agentsを実行する

- Work: [ ] App token refresh、webhook dedupe、DevOps agents、failsafe/approval/rollback、Claude/Droid draft PR。
- Complete when:Plan 008 Test plan Cが全PASSしmain write 0。
- Verify: `verification/run_real_environment_e2e.sh --scenario github-agents --sandbox`。
- Evidence: `.orchestration/acceptance/P009-F08-T19.json`。
- STOP:merge/deploy tokenがagentへ見える。

#### P009-F08-T20 E2E D PrjOps/report/Webを実行する

- Work: [ ] 3-channel intake→master→report→approval→delivery、全persona、metric trace、Entra UI/a11y。
- Complete when:Plan 008 Test plan Dが全PASS。
- Verify: `verification/run_real_environment_e2e.sh --scenario prjops-report-web --sandbox`。
- Evidence: `.orchestration/acceptance/P009-F08-T20.json`。
- STOP:mock provider、approval bypass、scope漏れ。

#### P009-F08-T21 E2E E Excel/API/performanceを実行する

- Work: [ ] dry-run/execute/retry/concurrency/crash/oversize/zip bomb、413/415/429、100 projects/50 users、3-replica failover。
- Complete when:Plan 008 Test plan Eが全PASSしlimit内。
- Verify: `verification/run_real_environment_e2e.sh --scenario excel-api-performance --sandbox`。
- Evidence: `.orchestration/acceptance/P009-F08-T21.json`。
- STOP:limit緩和、flaky rerunだけで合格。

#### P009-F08-T22 文書とtraceabilityを実態へ同期する

- Work: [ ] README/verification/config/http/runbooksのcommand・件数・未検証範囲を同期。 [ ] critical requirement→test→evidence linkを更新。
- Complete when:壊れたlink、過去件数、未検証の成功表記が0。
- Verify:`mise run traceability`、document link checker、evidence manifest validator。
- Evidence: `.orchestration/acceptance/P009-F08-T22.json`。
- STOP:evidenceなしの完了主張。

#### P009-F08-T23 security/operations/product独立reviewを受ける

- Work: [ ] 各ownerへ同じimmutable commit/evidence manifestを提示。 [ ] findingをP0/P1/P2分類。 [ ] P0/P1を修正・再review。
- Complete when:3 reviewすべてACCEPT、P0/P1 0、P2にowner/期限/回避策。
- Verify:review対象SHAと最終HEAD一致、review receipts 3件。
- Evidence: `.orchestration/acceptance/P009-F08-T23.json`。
- STOP:review対象drift、自己reviewだけ。

#### P009-F08-T24 human go/no-goとPlan 008受入を閉じる

- Work: [ ] risk/rollback/support/evidenceを人間decision makerへ提示。 [ ] go/no-go署名を取得。 [ ] GOの場合だけREADME 008 DONE。
- Complete when:human GO、Plan 008 acceptance、main merge SHA、P0/P1 0。
- Verify: T24 acceptance候補を作成してから `node scripts/validate-acceptance-manifest.mjs --through P009-F08-T24 verification/acceptance-manifest.json`、最終CI green。
- Evidence: `.orchestration/acceptance/P009-F08-T24.json`、`.orchestration/acceptance/P008-accepted.md`。
- STOP:NO-GO、署名なし、open P0/P1。

### Phase 9: 全計画を閉じる

#### P009-F09-T01 acceptance completenessを照合する

- Work: [ ] Plans 001〜008のacceptance record、PR SHA、CI URL、外部evidenceをmanifest化。 [ ]全checkboxを再走査。
- Complete when:validatorがF00-T01〜F08-T24の全task ID、status accepted、必須field、artifact hash、command log、dependency merge SHAを確認しexit 0。欠落・重複・壊れたlink 0。
- Verify: `node scripts/validate-acceptance-manifest.mjs --through P009-F08-T24 verification/acceptance-manifest.json` と独立reviewの二重照合。
- STOP:子Planの未完を例外承認で隠す。

#### P009-F09-T02 final regressionとadversarial review

- Work: [ ] clean checkout CI。 [ ] audit/actionlint/container/DB/E2E。 [ ] auth/secret/idempotency/HA/DRの否定的review。
- Complete when:全gate green、P0/P1 0、P2はowner/期限/回避策あり。
- Verify:orchestratorがworker logを流用せずcommandを再実行し、T02 acceptance候補作成後に `node scripts/validate-acceptance-manifest.mjs --through P009-F09-T02 verification/acceptance-manifest.json` を通す。
- Evidence: final verification report。
- STOP:flaky rerunだけで合格、test skip、未説明risk。

#### P009-F09-T03 Plan 009をDONEへ更新する

- Work: [ ] README 001〜009を事実へ同期。 [ ] 本Plan Done criteriaを全check。 [ ] human go-live決定を参照。 [ ] T03 acceptance候補を作成しfinal validatorを最後に実行する。validator失敗時はREADME/StatusをDONEにせず候補receiptをblockedへ戻す。
- Complete when:Plan 009 `DONE`、全Plan `DONE`、全70 taskのfinal manifestがgreen、次回運用ownerへhandoff済み。
- Verify:`git diff --check`、`mise run ci`、独立review ACCEPT、`node scripts/validate-acceptance-manifest.mjs --final verification/acceptance-manifest.json`。
- STOP:いずれかのPlanがBLOCKED/TODO、human NO-GO。

## Test plan

### Verify blocks

**Verify** — Positive 1: local deterministic gate

- [ ] clean checkoutで `mise run ci` が1回目からexit 0になる。
- [ ] focused testの期待仕様IDと実変更が一致する。

**Verify** — Adversarial 1: trust boundary

- [ ] 認証なし、foreign tenant、scope外、inactive、nested secret入力を拒否またはsanitizeする。
- [ ] denial前にscope外rowや外部resourceを取得・変更していない。

**Verify** — Positive 2: external sandbox trace

- [ ] sandboxの入力から外部応答、DB state、auditまで同じtrace/request IDで相関する。
- [ ] finally cleanupが成功し、作成resourceが残っていない。

**Verify** — Adversarial 2: retry and concurrency

- [ ] duplicate、out-of-order、429/5xx、partial failure、restart、lease expiryでも副作用が高々1回である。
- [ ] retry枯渇時は監査可能なfailure/escalationになり、silent successにならない。

**Verify** — Positive 3: operation readiness

- [ ] 3 replicas、alert、backup/restore、rotation、rollbackが承認SLO/RPO/RTO内で成功する。
- [ ] runbookだけで別operatorが同じ結果を再現できる。

**Verify** — Adversarial 3: evidence integrity

- [ ] evidenceの欠落、上書き、symlink、digest mismatch、secret混入をfailさせる。
- [ ] workerの自己申告と実logが矛盾する場合は成果をrejectする。

### 各単一タスク共通

- [ ] `task_type=code`は最初に対象testが意図した理由でREDになる。他typeへ形式的REDを要求しない。
- [ ] `task_type=code`は最小実装後にfocused testがGREENになる。
- [ ] `decision/external/review/docs`はtask type別protocolと固有acceptance oracleを満たす。
- [ ] package test/typecheck/lintがGREENになる。
- [ ] `git diff --check`がGREENになる。
- [ ] root `mise run ci`がGREENになる。
- [ ] scope外diff、skip、`continue-on-error`、mock-only成功がない。
- [ ] reviewerとorchestratorの双方が重要testを確認する。

### 否定的観点

- [ ] 認証なし、期限切れ、foreign tenant、scope外、inactive、multi-role競合。
- [ ] secret/PIIのnested入力、log、DB、LLM、artifact、PRへの漏えい。
- [ ] duplicate、out-of-order、retry、429/5xx、partial failure、restart、crash。
- [ ] concurrent workers、lease expiry、leader death、clock drift、split brain。
- [ ] oversize、zip bomb、slow body、spoofed proxy header、path traversal、symlink。
- [ ] LLM invalid schema、根拠なし数値、暗黙0、budget/timeout超過。
- [ ] backup破損、restore失敗、credential revoke、alert owner不応答。

### 外部受入

- [ ] sandbox/stagingだけを使用する。
- [ ] exact opt-inと人間承認を記録する。
- [ ] resource ownershipを確認してからcleanupする。
- [ ] cleanup失敗も失敗証跡として残す。
- [ ] redacted ID、hash、run URL、digest、traceで相関する。
- [ ] secret値、message本文、個人メールをevidenceへ保存しない。

## Done criteria

- [ ] Plans 001〜008がすべて`DONE`で、各acceptance recordがある。
- [ ] Plan 005の実tenant RSC/RBAC/subscription/change/lifecycle/renew/delta/mail証跡がある。
- [ ] production routeにempty provider、sample stakeholder、email authorization fallbackがない。
- [ ] PrjOps/DevOps/Claude/Droid/Excel/Webの実sandbox E2EがPASSする。
- [ ] SQL取得側認可、active recipient再評価、PII/sanitize、append-only auditが維持される。
- [ ] retry/restart/concurrency/failoverで外部副作用の重複がない。
- [ ] supported runtime、dependency risk、CI parity、container、IaC、HA、monitoring、DR、rotationが受入済み。
- [ ] high/critical dependency vulnerability 0。残余riskは人間署名済み。
- [ ] P0/P1 open blocker 0。
- [ ] `mise run ci`、audit、actionlint、Docker、fresh/upgrade DB、E2Eがgreen。
- [ ] independent security/operations/product reviewがACCEPT。
- [ ] human go-live署名があり、自動merge/deployをしていない。
- [ ] `plans/README.md`の001〜009が事実と一致する。

## STOP conditions

- authoritative data/schema/owner/update contractが不明。
- tenant/object backfill、persona優先順位、global/null visibility、PII承認が不明。
- sandbox、public callback、RSC、Exchange RBAC、delegated actor、cleanup権限が不足。
- production-only credential/resourceしかない。
- trusted proxy、Excel limits/reconciliation、RPO/RTO/SLO/ownerが未承認。
- scope外diff、秘密値、raw PII、監査UPDATE/DELETE、取得後maskを発見。
- test skip、mock-only、例外握り潰し、Docker/ingest failureのgreen化を発見。
- CI red、independent review未受入、同一root cause再発の未是正。
- P0/P1 blocker、rollback不能、backup restore不能、cleanup不能。
- human approvalなしのmerge、production deploy、production writeが必要。

STOP時は推測して続行せず、次だけを報告する。

```text
blocked_task_id:
observed_fact:
missing_input_or_permission:
commands_and_exit_codes:
redacted_evidence:
safe_options:
required_human_owner:
```

## Maintenance notes

- 外部API、runtime、Actions、Claude Code/Droid、dependencyは実行時点の公式文書で再確認し、確認日とURLをrecordする。
- 子Planの仕様が変わったら、本Planの依存、task packet、test、STOPも同じPRで更新する。
- acceptanceは実装者の自己申告だけで閉じず、独立reviewとorchestrator再検証を要求する。
- test件数は固定値を文書へ写さず、run logから取得し実行日とcommitを添える。
- resolved riskを削除せず、decision/evidenceへのlinkを残す。

## 安全回帰

- [ ] secret値をrepo、plan、log、fixture、artifact、PRへ保存しない。
- [ ] sandbox以外へtest送信・作成・更新・削除しない。
- [ ] human approvalなしにmerge、deploy、production writeしない。
- [ ] authorizationはtenant/oidと取得側scopeで強制し、emailや表示後maskへ戻さない。
- [ ] active recipientはrequestごとに再取得し、cacheしない。
- [ ] auditはappend-only、reason-required操作を維持する。
- [ ] 外部入力は保存前、LLM前、出力前にsanitizeする。
- [ ] 数値、色、表、thresholdはcode算出し、LLMは文章slotだけを扱う。
- [ ] retry、restart、failoverで副作用を重複させない。
- [ ] agent processへpush/deploy credentialを渡さない。
- [ ] least privilege、allowlist、resource ownership、cleanupを維持する。
- [ ]上位モデル移行は同一根本原因の明示修正後再発時だけとする。
