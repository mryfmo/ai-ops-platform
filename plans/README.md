# AI Ops Platform 製品化実装計画

2026-07-11の全体監査を基準に作成し、2026-07-13に`main@88b3653`と推奨decisionへ再同期した。後工程のexecutorは、`docs/spec/productization-decisions.md`、Plan 010、着手する子Planの順に全文を読む。Plan 010が明示的に許可するlocal taskは、依存PlanのENV gateが未完でも実行できる。推測で未記載機能を追加せず、STOP条件に該当したら証拠を報告する。

## 実行順序と状態

| Plan | Phase | Title                                                                        | Priority | Effort | Depends on | Status              |
| ---- | ----- | ---------------------------------------------------------------------------- | -------- | ------ | ---------- | ------------------- |
| 001  | 0     | PostgreSQL初期化・監査台帳・migrationを実DBで成立させる                      | P0       | L      | —          | DONE                |
| 002  | 1     | PrjOps正本データとEntra主体による認可を本番配線する                          | P0       | L      | 001        | TODO                |
| 003  | 2     | PrjOps AGT-01〜07の収集・分析・報告・配信ループを稼働させる                  | P0       | L      | 002, 005   | TODO                |
| 004  | 3     | DevOps agentをGitHub/監視イベントと状態台帳へ実配線する                      | P0       | L      | 001, 005   | TODO                |
| 005  | 1     | Microsoft Graph Teams/Outlook購読・送信経路を公式仕様へ適合させる            | P0       | L      | 001        | BLOCKED: ENV        |
| 006  | 2     | Claude Code/Droid codingと標準report workflowを安全に実行可能にする          | P0       | L      | 001, 002   | TODO                |
| 007  | 4     | Web・Excel・APIの認可、接続、入力境界、冪等性を強化する                      | P1       | L      | 001, 002   | TODO                |
| 008  | 5     | supported runtime・CI・HA・監視・実環境E2Eでgo-live判定を閉じる              | P0       | XL     | 001–007    | TODO                |
| 009  | 0–9   | 残存製品化工程を依存ゲート順に完遂しgo-live判定を閉じる                      | P0       | XL     | 001        | BLOCKED: SUPERSEDED |
| 010  | 0–7   | 推奨仕様・推奨環境で残存製品化工程を完了する                                 | P0       | XL     | 001        | BLOCKED: PLAN 011   |
| 011  | 0–3   | 受入証跡の信頼基盤を構築する                                                 | P0       | XL     | —          | BLOCKED: HUMAN/ENV  |
| 012  | 0–7   | 自然言語GitHub操作と議事録同期を承認付きで安全に稼働させる                   | P0       | XL     | 010, 011   | IN PROGRESS         |
| 013  | 0–5   | 内部ページエージェントを全ペルソナで動かしalibaba/page-agent不採用を確定する | P1       | L      | 001        | TODO                |

Status: `TODO | IN PROGRESS | DONE | BLOCKED: <reason> | REJECTED: <reason>`。

Current notes:

- Plan 002: specification fixed; repository-local work is ready; named ENV values remain pending。
- Plan 005: local core accepted; real adapter is TODO; tenant evidence remains pending。
- Plan 009: Plan 010 decision, DAG, and task mapping take precedence; Plan 009 is a detailed source ledger only。
- Plan 011: Plan 010の86 task universeは変更せず、P010-F01-T10の自己発行可能な証跡方式を外部信頼基盤で是正する。Enterprise Cloud Organization、repository移管、別人policy admin 2名、別人reviewerがHUMAN/ENV gate。
- Plan 011: dev-phase の DEV-DEFAULT decision record を docs/decisions/ に確立（操作者指示 2026-07-18）。本番 go-live 前に実値差し替え必須。表の Status は本番基準のため BLOCKED: HUMAN/ENV を維持。
- Plan 012: Plan 010のpicker、read-only Kanban、Graph、coding workflow、承認境界を前提にし、Teams・Outlook議事録・Claude Code・Droidの自然言語操作をtyped proposalへ統一する。新しいtask universeをPlan 010へ追加しない。
- Plan 013: ADR-0018の範囲のみ。projectBoardデータ経路はPlan 010の領分で、公開ゲートの `true` 化はPlan 010成果到達後の作業。

## フェーズゲート

- Phase 0: `plans/001-*`。fresh PostgreSQLへschema+migrationを適用し、監査INSERTまで成功しなければ他planを開始しない。
- Phase 1: `plans/002-*`, `plans/005-*`。実データ、認可、Teams/Outlookのsandbox smokeが通るまでagent配線へ進まない。
- Phase 2: `plans/003-*`, `plans/004-*`, `plans/006-*`。各agent/workflowを実イベントで駆動し、mockだけの合格を受理しない。
- Phase 3: `plans/007-*`。trust boundary、SQL側認可、Pool共有、Excel冪等性を閉じる。
- Phase 4: `plans/008-*`。supported runtime、CI、IaC、backup/restore、HA、監視を整備する。
- Phase 5: `plans/008-*` の実環境受入。GitHub、Microsoft 365、Anthropic、Factory、PostgreSQLを用いた証跡が揃った場合のみgo-liveを許可する。
- Phase 6: `plans/010-*`。確定済みdecisionを適用し、Microsoft 365/Azureの実証と最終go-liveを閉じる。
- Trust bootstrap: `plans/011-*`。P010-F01-T10より先に完了し、requesterがissuer/policy/verifierを同時支配できないことを実証する。
- Conversational operations: `plans/012-*`。Plan 010の依存taskとPlan 011の外部trust gateを満たした後、proposal単位の承認、冪等実行、sandbox E2Eの順に閉じる。

## 横断実行規則

- 各planごとに `agent/<plan-number>-<slug>` ブランチを作る。mainへ直接pushしない。
- 各planはテスト先行。失敗する回帰テストを確認してから最小実装を行う。
- 各plan完了時に `mise run ci`、対象の追加統合テスト、`git diff --check` を通す。
- 実外部サービスへ書込むtestはsandbox tenant/repository/mailboxのみを使う。本番書込みは別途人間承認を得る。
- 秘密値をplan、ログ、fixture、PR本文へ書かない。証跡はsecret名とredacted IDだけを残す。
- git diffが意味のある変更を含む場合はroot `AGENTS.md` のCrit receipt運用に従う。
- plan完了時はこの表だけを更新し、他planの内容をついでに変更しない。

## 実行前にoperatorが設定する入力

値はsecret storeまたは実行環境へ設定し、planやcommitへ値を書かない。

| Name                                                 | Meaning                                                | Required by   |
| ---------------------------------------------------- | ------------------------------------------------------ | ------------- |
| `AIOPS_SANDBOX_REPO`                                 | `owner/repo` 形式の破棄可能なGitHub sandbox repository | 004, 006, 008 |
| `AIOPS_SANDBOX_PROJECT_ID`                           | sandboxの `PJ-nnn`                                     | 002–008       |
| `AIOPS_SANDBOX_PROJECTV2_NODE_ID`                    | 上記PJへ署名済みmappingされたProjectV2 node            | 002, 008      |
| `AIOPS_SANDBOX_PROJECTV2_STATUS_FIELD_ID`            | Kanban列の正本となるStatus field                       | 002, 008      |
| `AIOPS_SANDBOX_TEAM_ID` / `AIOPS_SANDBOX_CHANNEL_ID` | RSC app導入済みTeams sandbox                           | 005, 008      |
| `AIOPS_SANDBOX_MAILBOX` / `AIOPS_SANDBOX_RECIPIENT`  | test専用Outlook mailbox/address                        | 005, 008      |
| `TEST_DATABASE_URL`                                  | disposable PostgreSQLのみを指す接続文字列              | 001–008       |
| `STAGING_BASE_URL`                                   | staging公開URL。production URLは禁止                   | 008           |

値が欠けるplanは該当する実外部Verifyをskipせず `BLOCKED` にする。

Plan 010では、仕様値は[`docs/spec/productization-decisions.md`](../docs/spec/productization-decisions.md)で確定済みとする。上表の実ID/credential/owner署名だけをENV入力として扱い、仕様未確定へ戻さない。

## 依存関係

```text
001 DB baseline
 ├─ 002 PrjOps data/identity ─┬─ 003 PrjOps runtime
 │                            ├─ 006 agent/report workflows
 │                            └─ 007 Web/API hardening
 ├─ 004 DevOps runtime ───────┐
 └─ 005 Microsoft Graph ──────┼─ 008 production/E2E/go-live
      ├─ 003                  │
      └─ 004                  │
006, 007 ─────────────────────┘
```

## 監査指摘との対応

- 001: audit DDL/partition/retention、migration/fresh DB不成立。
- 002: 空のPrjOps provider、sample stakeholder、email主体、persona未完成。
- 003: PrjOps workflow不存在、AGT-01〜07未配線、マルチチャネル収集不足。
- 004: DevOps handlerがaudit-only、deploy/incident/build workflow雛形、状態DB未更新。
- 005: Teams送信URL、Graph dedupe、lifecycle/renew、Outlook/Teams実送信。
- 006: CLI未導入/API key未配線/Droid read-only、runner secret境界、fake zero report。
- 007: requestごとのPool、SQL後段認可、raw event保存、Excel競合/size、rate limit/headers。
- 008: Node 20 EOL、dependency audit、CI差異/coverage、Docker握り潰し、HA/IaC/監視、文書/E2E。

## 今回採用しない指摘

- NextAuth email misdelivery advisory: 現在はNodemailer/email providerを使用せずMicrosoft Entra IDのみのため、直接のexploit pathはない。ただし依存更新はPlan 008に含める。
- PostCSS `</style>` advisory: user-supplied CSSをparse/stringifyしてHTMLへ埋める経路は現状ない。ただしpatched transitive dependencyへの更新をPlan 008で確認する。
- RSC application permissionそのもの: Microsoft公式で `ChannelMessage.Send.Group` はサポートされているため却下。修正対象はURL、team/channel識別、実consent検証。
