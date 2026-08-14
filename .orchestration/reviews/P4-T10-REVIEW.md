# P4-T10-REVIEW — approve at `cc3c4b5`

- task_id: P4-T10 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-15
- head_sha: cc3c4b56b9c01476101a96dd19c78c9d2e30be0e
- verdict: **approve**（non-blocking note 2 件）

## 独立再検証

- `@aiops/integrations` 37/37 を reviewer 側で再実行
- コード読解: `invocationProfile.ts`（64 行、承認済み bounds テーブルと一致・
  単一レビュー境界コメント付き）/ `governedToolCall.ts` 差分 /
  `mcpPolicy.ts`（`invocation: {depth, ancestorOperationIds}` 必須化）

## 反証プローブ（built dist、全 pass）

| probe | 結果 |
| ----- | ---- |
| 自 operationId が ancestors に存在 | failed E-TOOL-RECURSION |
| chain 長 = maxChainLength（L1:6） | failed E-TOOL-DEPTH |
| depth = maxDepth（L1:3）は許可 / +1 は遮断 | succeeded / failed E-TOOL-DEPTH |
| obligation 10MB vs L3 profile 128KiB | min-wins で 128KiB 維持 |
| obligation maxResultBytes = -5 | blocked E-OPA-MALFORMED（decision 段で deny） |
| result = ちょうど limit / +1 byte | succeeded / failed E-TOOL-OVERSIZED（**result 非返却**） |
| wall-clock 超過（fake now） | failed E-TOOL-TIMEOUT（**result 非返却**） |
| invocation context 欠落 | failed E-TOOL-DEPTH（fail-closed） |

## 妥当性判断

- **oversized/slow/recursive calls fail safely**: 部分結果なし（over-limit /
  timeout とも receipt に result を載せない）、timeout→success 遷移なし
  （race 敗北後に result が届いても applied へ遷移する経路なし + wall-clock の
  事後二重判定）、深さ/連鎖/再帰は execute 前に遮断
- **MCP-006 相関**: receipt に `correlation`（traceId/actorId/tool{serverId,
  version,name}/resource{id,projectId}/result{status,errorCode}）を全経路で付与。
  limit 失敗も ledger `failed` + lastErrorClass で記録
- P4-T04 不変条件は不変（decision 先行・全経路 receipt・approvals 二重照合・
  claim）。limit check は L2/L3 局所遮断の後・approval wait の前に配置され、
  doomed call の approval 待ちを短絡
- 承認済み bounds テーブルと実装が完全一致。obligation は isDecision 段の
  型検証（malformed → deny）と resolve 段 throw の二重防御

## Non-blocking notes

1. **timeout 時の外部作用は unknown**: race 敗北後も remote 実行は継続し得るが
   ledger は `failed`。live 結線時（register クローズ後）に P3 の
   single-attempt + reconcile 規範で対応する前提を、onboarding タスクの
   要件に含めること（現状 code-only では実害なし）
2. P4-T04 note 継承: require_approval で limit 失敗した場合の orphan pending
   approval（監査可能、改善余地）
