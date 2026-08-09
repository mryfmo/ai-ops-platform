# Migration, Rollout and Rollback Plan

## 1. 共通状態

各新経路は以下の状態を持つ。

```text
disabled -> shadow -> limited -> primary -> old_path_removed
                  \-> rollback
```

- `disabled`: コードは存在しても呼ばない。
- `shadow`: 副作用なしで旧経路と比較する。
- `limited`: allowlisted user/project/repositoryだけ。
- `primary`: 新経路が正。旧経路はread-only fallback。
- `old_path_removed`: 一定期間green後に旧経路を削除。

## 2. コンポーネント別移行

| Component | Shadow comparison | Cutover criterion | Rollback |
|---|---|---|---|
| LiteLLM | direct Anthropicと同じfixture/structured outputを比較 | schema pass 100%、許容品質差、cost/latency SLO | flagでdirect adapter。ただしprovider keyはserver only |
| Temporal | 現行schedulerと同じdue setを副作用なしで算出 | missed/duplicate 0、replay/crash green | old scheduler flagを再有効化 |
| agentgateway/OPA | tool requestをlog-only evaluate | deny/allow一致、negative tests green | direct read-only adapterへ戻す。writeは開通しない |
| Work IQ | existing Graph/search結果とpilot比較 | OBO/permission/source ref green | Work IQ flag off、Graph deterministic path維持 |
| Teams OpenTag-derived | pilot team/channel | thread/HITL/mobile/日本語/SLO | existing Graph+Web deep-link surface |
| Workbench capability model | read-only pilot | no ambient access、workspace isolation | existing page-agent UI |
| Wispr flow | selected meeting class | matching/review/no duplicate publication | Teams transcript/manual review |
| Claude/Droid runner | test repository | branch/PR/CI/human merge/secret negative green | disable agent in task router |
| Incident workflow | shadow RCA only | correlation and human-confirmed quality | existing incident process |

## 3. Rollbackの原則

- DB migrationはexpand/contract。破壊的dropはtwo-release後。
- event schemaはversioned。consumerはN/N-1を読む。
- Temporal workflow codeはrunning historyと互換を保つ。breaking changeはnew workflow type/version。
- model aliasはimmutable revisionを持つ。provider/model変更はalias revisionを更新する。
- MCP tool name/schema変更はregistry versionを上げ、旧versionをgrace period維持。
- OPA bundleは署名・version・last-known-goodを保持。
- secrets rotationはold/new overlapを設け、client切替後にoldを失効。

## 4. Rollback decision matrix

| Severity | Condition | Automatic action | Human action |
|---|---|---|---|
| Critical | unauthorized write, secret leak, cross-project data exposure | kill switch、traffic 0、token revoke | incident commander、legal/security |
| High | duplicate side effect, approval bypass, persistent 5xx | new path off、old path primary | root cause、data reconciliation |
| Medium | SLO breach, quality regression | limited scope縮小 | tune/retest |
| Low | UI defect/documentation | no backend rollback | normal PR |

## 5. Data reconciliation

Rollback後は「処理を戻す」だけでなく、以下を照合する。

- workflow/action ledgerと外部system side effects
- Plane/GitHub/Confluence/SharePoint object mapping
- duplicate/missing events
- approval version and actor
- LiteLLM usage/cost attribution
- OTel trace completeness

補正は新しい追記イベントとして行い、監査履歴を上書きしない。
