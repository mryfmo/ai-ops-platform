# ADR-0030: Jira × GitHubをai-ops-platformの統制下で連携する

- Status: Accepted
- Date: 2026-08-28
- Evidence: `JIRA-GH-GOV-001`
- Supersedes for new execution: ADR-0019のPlane運用経路
- Compatibility: ADR-0019の`plane-sync` Workflow/Task Queue/Replay fixtureは削除しない

## Context

Jira標準のGitHub連携はBranch、Commit、Pull Request、Build、Deploymentの可視化と、限定的なAutomationには適する。一方、AIエージェントの起動、別人承認、重要Status遷移、stale判定、unknown write resultのreconcile、GitHubへの安全な昇格を標準連携だけへ委ねると、`ai-ops-platform`の統制境界を迂回する。

既存Plane設計にはTemporal履歴とv1契約が存在するため、単純な削除・改名はReplay非互換を発生させる。

## Decision

### 1. 正本を三層に分離する

| 情報                                                      | 正本            |
| --------------------------------------------------------- | --------------- |
| Backlog、Status、Assignee、Sprint                         | Jira            |
| Branch、Commit、PR、Review、CI、Release                   | GitHub          |
| `PJ-*`認可、AI実行、承認、Policy、Ledger、監査、reconcile | ai-ops-platform |

Jira標準連携はDevelopment Informationの表示用途に限定する。重要な書込みは`ai-ops-platform`を通す。

### 2. 新規実行は`jira-sync`へ移す

`jira-sync`はinternal-only Temporal Task Queueとする。v1外部契約の`WORKFLOW_KINDS`へ追加せず、`TEMPORAL_TASK_QUEUES`だけへ追加する。これによりv1 enumを後方互換のまま維持する。

既存`plane-sync`、Plane Workflow、Replay fixtureは過去履歴の再生専用互換面として残す。新規Project mappingおよび新規イベントはPlaneへ投入しない。

### 3. Jira変更のstale判定を三要素へ固定する

保護された処理のbaselineは次の完全一致で判定する。

```text
updated + statusId + fieldHash
```

`fieldHash`はAssignee、Sprint、および許可された対象Fieldの正規化値からSHA-256で算出する。Workflowは書込み直前にbaselineを再取得する。Activityのwrite authorityもbaselineを検証し、`created|stale`または`transitioned|stale`のdiscriminated unionを返す。

### 4. Webhookは認証・mapping検証・最小metadata化を必須とする

`POST /webhooks/jira`は認証器が未設定なら503、認証失敗なら401、未知のJira Project mappingなら403、未知イベント・未知Statusなら422で拒否する。キューへ保存するのは次のmetadataだけとする。

- Issue Key
- `PJ-*` Project ID
- Jira Project ID
- Status ID
- opaque Assignee Account ID
- Sprint ID
- `updated`
- `fieldHash`
- mapping version
- 署名対象本文のSHA-256 digest

Summary、Description、Comment本文、Webhook raw bodyは保存しない。

### 5. 非冪等書込みはone-shot/no-retryとする

Jira Status transition、Jira Development Information projection、GitHub Draft PR作成は自動再送しない。通信結果が不明な場合は三値Ledger（`absent|pending|written`）とprovider readbackでreconcileする。`pending`は成功にも不在にも解釈せず、手動またはprovider側照合を要求する。

HTTP 202/204の空本文は成功として扱う。

### 6. GitHubへの昇格はDraft PRまでとする

Jira起点のGitHub作成処理は`draft:true`をreceipt契約で強制する。Approve、Ready for Merge、Merge、mainへの直接書込みをJira adapterやJira Workflowから到達可能にしない。

以下は禁止する。

```text
JiraがDone → GitHub PRを自動Approve
```

PR承認はGitHub上の記名Reviewer、Required Checks、ai-ops-platform Policy Gateの組合せに限定する。

### 7. 保護StatusをSmart Commitから隔離する

少なくとも次の意味を持つStatusはSmart CommitやJira標準Automationだけで遷移させない。

- Approved
- Ready for Merge
- Done
- Production Approved
- Released
- Security Accepted

実際のStatus IDは`jira-environment-mapping`の`protected_status_ids`で環境ごとに固定する。`protected_status_ids`は`allowed_status_ids`の部分集合でなければならない。

### 8. Webhook欠落を完全Snapshotでreconcileする

JQL Snapshotは全ページを取得し、`captureComplete=true`のときだけcommitする。page tokenの循環、Issueの重複、page/Issue上限超過、未知Status、malformed response、transport errorのいずれかがあればSnapshot全体を破棄する。

## Consequences

### Positive

- Jira/GitHub標準連携の可視性を利用しながら、AI実行と重要書込みの統制を維持できる。
- PlaneのTemporal履歴を壊さず段階移行できる。
- Webhook欠落、重複、応答喪失、stale更新に対する明示的な回復経路を持つ。
- Jira本文を監査・イベントDBへ複製しないため、機密情報の拡散を抑制できる。

### Trade-offs

- Jira Status ID、Sprint custom field ID、GitHub repositoryの環境mappingを運用管理する必要がある。
- Jira APIの呼出し回数とreconcile負荷が増える。
- Jira標準Automationだけで完結する構成より実装・監査が複雑になる。

## Rejected alternatives

1. **Jira標準連携だけで双方向同期する**: 承認、CAS、unknown write reconcile、AI権限制御が不足する。
2. **Plane実装をその場でJiraへ改名する**: Temporal history replayとv1契約を破壊する。
3. **Jira本文・コメントをGitHubへ完全同期する**: 競合、機密情報拡散、正本不明確化を招く。
4. **Jira DoneをPR承認に連動する**: Review separationとBranch Protectionを迂回する。
