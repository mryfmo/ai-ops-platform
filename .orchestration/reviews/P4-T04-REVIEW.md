# P4-T04-REVIEW — approve at `f69b771`

- task_id: P4-T04 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-15
- head_sha: f69b77179c7fd77ca7ac031872fa248e103e5374
- verdict: **approve**（non-blocking note 2 件）

## 独立再検証（reviewer 実行）

- `@aiops/integrations` 27/27 / `@aiops/policy` 12/12 / `@aiops/server` 860 pass
  をすべて reviewer 側で再実行
- コード読解: `governedToolCall.ts`（317 行）/ `mcpPolicy.ts`（170 行）/
  `decisionClient.ts` pathname guard / `ledgerEvidenceRepos.ts` sanitize 追加

## 反証プローブ（built dist に対する実測、全 6 種 fail-closed）

| probe | 結果 |
| ----- | ---- |
| A. OPA 誤設定で L2 tool に allow | blocked E-POLICY-APPROVAL-REQUIRED、未実行（局所防衛が効く） |
| B. require_approval だが obligations.requireHumanApproval 欠落 | failed E-POLICY-APPROVAL-OBLIGATION、未実行 |
| C. workflow/authority 双方 approved | succeeded、approvalId link 付き receipt |
| D. workflow approved × authority rejected | failed E-APPROVAL-MISMATCH、未実行（auto-approval 不可） |
| E. 注入 client の bundle version drift | blocked E-OPA-MALFORMED、未実行 |
| F. disabled registry entry | 副作用前に throw |

## 妥当性判断

- **every tool call has policy decision**: `invoke()` は decide → decision 永続化を
  先頭に固定し、executor 到達は claim 成功後のみ。decision なし経路は型上も
  実行上も存在しない（全 receipt に decisionId / policyBundleVersion 常在）
- **L2/L3 linked approval**: OPA が allow と言っても L2/L3 は require_approval
  以外を遮断（defense-in-depth）。approval は既存 approvals 正本 + P3-T03
  workflow の**二重照合**（id/version/status 一致必須、expired+pending は
  blocked、mismatch は failed）。DELTA-03 遵守（並行 authority 新設なし）
- ledger 遷移は P1-T05 の status 集合内で前進のみ、claim による TOCTOU 防止、
  duplicate plan は blocked。evidence JSON は保存前 sanitize（原則 4）
- pathname guard により P4-T03 note 解消。スコープは amendment 含め遵守、
  依存追加なし、live 結線なし（preparatory classification 整合）

## Non-blocking notes

1. E-ACTION-DUPLICATE 経路では作成済み pending approval が orphan になり得る
   （plan 前に approvals.create するため）。監査上は追跡可能。approval 作成を
   plan 成功後へ移すか、duplicate 時に approval を注記する改善余地
2. approval expired（authority pending）時に ledger を `failed`、receipt を
   `blocked` と記録し名称が非対称。意味は明確だが揃える余地
