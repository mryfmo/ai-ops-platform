# ADR-0019: Plane CEを高頻度ワークフローの権威ある作業台として採用し、GitHub正本とtyped proposalで接続する

## ステータス

採用 — 2026-07-19

## コンテキスト

本プロジェクトは「人間は判断・承認し、エージェントが実行する」運用を目指す。現行の
DEC-SPEC-008はGitHub Projects v2をKanbanのworkflow正本としたが、次の再考条件が成立している。

- `show_project_board` はデータ経路がなく `E-VIEW02` のままである。
- ProjectV2 item更新は比較対象versionを持つCAS契約がなく、board書込みを安全に開通できない。
- Plan 010 `P010-F02-T11`〜`T14` は未完了で、snapshot reconcileも設定なしでは無効である。
- 人間とエージェントが同じ場所でintake、担当、cycle、議論、日々の進行を扱う運用面がない。

一方、DEC-SPEC-001の`prjops-data`、本体repositoryの文書、PR review、署名済みsnapshot、
不変commit SHAは、正式な報告・監査・意思決定を支える。これを日々のKanban操作ごとに更新すると
作業性が失われ、Planeへ全面移管するとreview、署名、履歴固定、typed approvalが失われる。
必要なのは一方への統一ではなく、統治重量に応じて権威を分ける境界である。

2026-07-19時点のPlane公式一次情報を確認した。

- Community Editionの最新releaseは
  [`v1.3.1`](https://github.com/makeplane/plane/releases/tag/v1.3.1)で、repositoryはAGPL-3.0である。
- REST APIは`X-API-Key`によるpersonal access tokenを使い、keyごとに60 request/minuteである。
  self-hosted instanceは固有base URLを使う。
  [API introduction](https://developers.plane.so/api-reference/introduction)
- webhookは`X-Plane-Delivery`、`X-Plane-Event`、payloadのHMAC-SHA256である
  `X-Plane-Signature`を持ち、Project、Issue（Work Item）、Cycle、Module、Issue Commentを通知する。
  [Webhooks](https://developers.plane.so/dev-tools/intro-webhooks)
- Work Itemモデルは`external_source`と`external_id`を持つ。
  [Issue model](https://github.com/makeplane/plane/blob/preview/apps/api/plane/db/models/issue.py)
- API keyは作成元workspaceに閉じず、そのuserが参加するworkspaceへアクセスする設計である。
  workspace越え読取の報告
  [#5757](https://github.com/makeplane/plane/issues/5757)はOPENのため、専用主体によるnegative probeを
  導入前のSTOP gateにする。
- AGPL-3.0はnetwork越しに利用される改変版について、対応するsourceを利用者へ提供する義務を定める。
  [LICENSE.txt](https://github.com/makeplane/plane/blob/preview/LICENSE.txt)

本ADRでいう用語を次のように固定する。

- **記録級事実**: 正式な報告・監査・意思決定が引用し、review済みcommitへ固定すべき低頻度・高重要度データ。
- **運用流動**: Kanban位置、担当、cycle、議論、日々のtaskなど、高頻度に変わる作業状態。
- **昇格**: 運用流動の一部を記録級事実にするため、typed proposalと承認を経てGit PRへ変換すること。
- **投影**: 一方の権威ある状態を、他方で操作・表示できる派生表現へ写すこと。投影先は正本にならない。

## 決定

### 1. 統治重量で分けた三層モデルを採用する

| 層              | 権威を持つデータ                                                                                                               | 境界                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| GitHub          | `PJ-*`、`ORG-*`、`ST-*` registry、questionnaire、投資家データ、正式な`ISSUE-*`/`ACT-*`台帳、報告書、議事録、監査が引用する記録 | `prjops-data`または本体repositoryのreview済みcommitが正本。変更はPR reviewまたはPlan 012のtyped proposal経由だけ |
| Plane CE        | Work Itemのstate/position、担当、cycle帰属、item上の議論、intake、日々のtask                                                   | 高頻度運用状態の権威。通常操作にGit往復を要求しない。記録級事実にはしない                                        |
| AI Ops Platform | webhook由来の`pm_events`追記履歴、reconcile snapshot、認可、監査、決定的数値、報告、昇格判定                                   | 上流状態を観測・検証・派生する。Plane/Gitの権威フィールドを独自に上書きしない                                    |

同じ意味のフィールドをGitとPlaneの双方で編集可能にしない。正式台帳のtitle、owner、decision、
close根拠など記録級フィールドはGitが勝ち、Planeへ再投影する。state、position、assignee、cycle、
日常コメントはPlaneが勝ち、platform snapshotを更新する。platformの集計値は派生値であり、
どちらの上流も変更しない。

### 2. PJ-*を唯一の認可キーとして維持する

DEC-SPEC-001は変更しない。Plane workspace/project UUID、slug、表示名、列順は認可キーにしない。
各`PJ-*`から`plane_workspace_id`、routing用workspace slug、`plane_project_id`、authorized URLへの
写像を、A020 fixtureと同じprovenance形状を持つ署名済みmapping属性として管理する。
development defaultはgo-live前のowner署名済み実値への置換を必須とする。

Git記録を投影したWork Itemは、`external_source=prjops-data`と
`external_id=ISSUE-*|ACT-*`等のcanonical IDを持つ。Plane-nativeの日々のtaskは記録級IDを
捏造せず、昇格後のGit mergeでcanonical IDが確定してから再投影する。重複した
`(external_source, external_id)`、未署名mapping、別`PJ-*`のPlane UUIDはfail-closedにする。

### 3. 三方向の接続を固定する

1. **Git → Plane**: review済みcommit SHAの記録級事実だけを投影する。既存Work Itemはcanonical
   external IDで照合し、Git管理フィールドだけを更新する。
2. **Plane → Platform**: webhookのraw bytesをHMAC-SHA256でconstant-time検証し、
   検証直後にID、event/action、revisionだけをallowlistする。`X-Plane-Delivery`をdedupe keyとして
   既存`events` queueへ入れ、最小化・sanitizeした運用イベントを既存`pm_events`へ追記する。
   comment body、name、email、avatar、raw payloadは保存せず、定期full reconcileで取りこぼしを補う。
3. **Plane → Git**: 正式close、週次status update、正式なissue/action/decision化など、
   codeで定義した昇格条件だけを構造化する。Plan 012のtyped proposal、別人承認、single-attempt
   publisherを再利用し、`prjops-data`へbranch commitとdraft PRを作る。mainへの直接書込みと
   自動mergeは禁止する。

昇格proposalは基準Git SHAとPlane item revisionを固定する。承認前またはpublisher実行前に
どちらかが変われば`stale`とし、外部writeを行わない。Git側で競合した場合はGitを勝者として
proposalを再作成し、merge済みrecordをPlaneへ再投影する。Planeの運用フィールドはこの再投影で
消さない。

### 4. Planeを人間とエージェントの共用作業台にする

- AGT-02は認証済みintakeを構造化し、対象`PJ-*`のPlane Work Itemを冪等に起票する。
- AGT-03は決定的判定結果とサニタイズ済み理由文を対象itemのcommentとして添付する。
- AGT-06は既存の決定的期限判定を使い、事前通知・督促・escalationを対象item上へ記録する。
- 人間はPlaneのstate、position、assignee、cycle、discussionを直接操作できる。
- Git記録の更新が必要な操作だけがtyped proposalで停止し、承認後もdraft PR作成までとする。

LLMは数値、state、position、認可、昇格可否を決めない。文章の構造化・理由文スロットだけを担い、
trust boundaryごとに既存secret sanitizerを適用する。

### 5. 統合はAPI境界だけに限定する

`packages/shared`へ、既存`FetchLike`、`fetchWithBackoff`、timeout patternを再利用した
`PlaneClient`を置く。`PlaneTokenProvider`、fetch、base URLを注入し、60 request/minuteを超えない
pagination/batchとrate-limit headerを扱う。GETだけをidempotent retryし、POST/PATCH/DELETEを
transport不明時に自動再送しない。

`packages/server`のPlane webhook routeはraw body、署名、delivery UUID、event allowlist、
payload sizeを検証してから202を返す。raw bodyは署名検証中のmemoryだけに置き、承認済みfield allowlist
以外をqueue/DB/logへ書かない。DB保存前、LLM入力前、外部出力前の多層sanitize、
active subject/personaの取得側filter、追記専用監査を既存どおり維持する。

API tokenは専用integration userへ発行し、そのuserを単一のallowlisted workspaceだけへ参加させる。
token作成画面をworkspace scopeの証拠にしない。#5757のnegative probeで非参加workspaceを読める、
またはscopeを証明できないversionでは導入を停止する。

### 6. AGPL境界を固定する

Plane CEのsource、library、image内容を本repositoryへvendor、copy、static/dynamic linkしない。
未改変の公式releaseを別serviceとしてself-hostし、標準HTTP API/webhookだけで接続する。
Planeの改変が必要になった場合は作業を停止し、ownerと法務の確認後、対応sourceを利用者へ提供する
公開forkを先に用意する。公開forkのowner、release、脆弱性対応責任が確定するまで改変版を使わない。

### 7. DEC-SPEC-008の置換は別のowner decisionにする

本ADRの採用だけではboard sourceを切り替えない。Plan 014 Phase Cで、脅威・データ影響review、
Plan 010 `P010-F02-T11`〜`T14`の同一commit更新、owner承認を持つdecision PRを作成する。
それまではPlaneをshadow observationに限定し、ProjectV2 board writeも引き続き禁止する。
project picker、`PJ-*`認可、URL selection、domain data boundaryはDEC-SPEC-008のまま維持する。

### 8. 新規仕様ID

以下6件を本ADRで定義する。catalog/traceability登録はPlan 014で初参照コードと同じPRに含める。

### PrjOps:REQ-045

PrjOpsの人間とエージェントはPlane CEを共用作業台として使い、日々のstate、position、担当、
cycle、議論をGit往復なしで更新できる。正式なproject/issue/action/status記録はGitHub正本へ
typed proposalと承認を経て昇格し、Planeから直接変更できない。

### DevOps:REQ-045

DevOpsの人間とエージェントはPlane CEを共用作業台として使い、運用流動をPlaneで扱える。
platformは全Planeイベントを追記監査し、認可・決定的数値・報告を維持し、GitHub正本または
production変更をPlane操作だけで更新しない。

### PrjOps:SPEC-INT-091

`PJ-*`と署名済みPlane UUID mappingをrequestごとに検証し、Plane webhookをHMACとdelivery IDで
検証・dedupeして`pm_events`へ追記する。Git昇格は基準Git SHA、Plane revision、canonical
external IDを固定したPlan 012 typed proposalだけが作成できる。

### DevOps:SPEC-INT-091

PlaneClientはtoken provider、fetch、base URLを注入し、60 request/minuteのbatch、bounded timeout、
rate-limit backoffを守る。非冪等writeは自動再送せず、webhook/reconcile差分、重複external ID、
foreign workspace、stale mappingをfail-closedにして監査する。

### PrjOps:AC-045-1

二つの認可projectと一つの非認可projectを使い、Git→Plane投影、Plane運用変更、webhook/reconcile、
AGT-02/03/06、typed proposal→draft PR→Git merge→再投影を相関できる。未承認proposal、
stale revision、重複external ID、foreign workspaceではGit writeと情報漏えいが0である。

### DevOps:AC-045-1

署名改変、delivery replay、payload過大、60 request/minute超過、timeout、429/5xx、非冪等response不明、
#5757、Plane停止、reconcile不一致を検証し、secret/PII漏えい0、event欠落の黙殺0、自動再送write 0、
ProjectV2 board mutation 0を示す。

## 根拠

三層モデルは製品ごとではなく統治重量で権威を割り当てる。これによりPlaneの操作性、GitHubの
review可能な記録、platformの認可・監査・決定的自動化を同時に保ち、同じfieldのdual truthを作らない。
現行ProjectV2方式を未完成のまま延長するより、既にWork Item、Cycle、Comment、webhook、APIを持つ
Plane CEへworkflowの弱い脚だけを置き換える方が小さい。

| 却下した代替案                                 | 却下理由                                                                                  | 再検討条件                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 全変更をGit PRへ往復させる                     | position、担当、cycle、日常コメントまでreview待ちとなり、共用作業台の運用性が死ぬ         | 高頻度操作を遅延なく扱えるGit native UXと測定証拠が得られる                   |
| Planeを全データの正本にする                    | 署名commit、PR review、immutable SHA、typed approvalを失い、記録級事実の統治が死ぬ        | Planeが同等の不変性・review・署名・retentionを満たしownerが正本移管を承認する |
| GitHub Projects v2を継続してT11〜T14を完遂する | read-only viewは作れるが、CASなしの安全な共同writeと人間・agent共用discussionを満たさない | ProjectV2がaccepted CAS、監査、accessibility、agent APIを満たす               |
| 自前Kanban DBを作る                            | UI、workflow、discussion、通知を再実装し、運用正本とplatform DBのdual truthを作る         | Plane CEを含む既製品が必須要件を満たさず、運用ownerが製品開発を承認する       |
| Plane Commercialを採用する                     | closed-source機能と契約へ依存し、CEで成立する現在要件に不要                               | CEで満たせない承認済み要件、費用、exit plan、法務承認が揃う                   |

## 影響

- ADR-0019とPlan 014がowner承認されるまでruntime、DEC-SPEC-008、Plan 010、依存、外部環境は変わらない。
- 採用後はPlane CEの可用性、backup/restore、upgrade、脆弱性対応、token rotationを運用対象に加える。
- `pm_events`/`pm_snapshots`はPlaneの派生履歴を保持するが、workflow正本にはならない。
- Planeのcomment/intakeには個人情報が含まれ得るため、Phase Aでfield allowlist、retention、erasure、
  backup purgeを承認・実証する。discussion本文とidentity fieldはplatformへ複製せず、secretはどの層にも保存しない。
- #5757がOPENである間はreleaseごとにworkspace negative probeを行う。passしてもtoken自体を
  workspace-scopedと表現せず、専用integration userのmembershipを最小化する。
- Plan 012のtyped proposal/approval/publisherが未受入ならGit昇格を開通しない。Plane内の運用流動は
  継続できるが、記録級変更はpendingで停止する。
- 実装・移行・検証の正本は`plans/014-plane-integration.md`とする。
