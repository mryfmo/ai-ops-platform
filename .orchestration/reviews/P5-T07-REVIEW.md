# P5-T07-REVIEW — approve at `5b026b3`（R01 是正後）

- task_id: P5-T07 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-16
- head_sha: 5b026b3fe4be3a7bd03cb31ce06881751a1d884b
- verdict: **approve**

## Findings

- **R01（blocking、resolved）**: `@aiops/shared/secretSanitizer` の import に
  `.js` 拡張子がなく、built dist が素の Node ESM runtime で
  ERR_MODULE_NOT_FOUND（reviewer が dist 直 import で実証。vitest/tsc は
  TS 解決で隠蔽）。1 行修正後、`IMPORT OK` を reviewer 環境で再実証

## 独立再検証

- `mise run policy:rego` **25/25** / policy 13 / control-plane **241** tests 再実行
- 反証プローブ 9 種（修正後 dist、全て仕様どおり）:
  A. restricted + **rogue allow decision** → blocked（rego に依存しない局所停止 =
  二重防壁）/ B. provenance 不完全の escalation（summarized 無 → 遮断、
  cc 相当 obligation 充足時のみ dispatch）/ C. required redactions 欠落 →
  遮断 / D. **nested permissionContext の再帰除去 + 保持値内の secret が
  sanitizeForLlmInput で除去**（dispatch payload を実検分）/ E. obligation
  byte 超過 → SIZE / F. provider 不一致 → 遮断 / G. 未知 classification →
  INPUT / H. actor scope 外 project → INPUT

## 妥当性判断（WIQ-004）

- **restricted never leaves**: rego deny + activity の無条件停止の二重化。
  provider 全候補で dispatch 不能（プローブ A + rego tests）
- **customer route**: bedrock only + summarized 必須 + conversation/permission/
  source metadata の redact + 4KiB 上限。anthropic は explicit policy data
  不在では全 class で deny（policy matrix どおり、rego tests で固定）
- 最小化は requestedFields 選択 + redaction 再帰除去 + LLM 入力前 sanitize
  （原則 4 の 3 層目）+ 空 content 拒否 + 二重 byte bound（obligation ≤ 16KiB 絶対）
- decision なし/deny/approval/malformed/transport 失敗は dispatch へ到達しない。
  bundle 0.2.0 へ semver 更新（client/deployment/smoke parity 維持、
  `posture.enabled: false` 不変）
- スコープは amendment 3 件の範囲内（workspace link 2 + version 文字列のみ）

## Note

- 本実装により P5-T03 P1 の補償統制（出力側 egress 統制）が正本化。
  m365Delegated endpoint から本 checkpoint への実結線は P5-T09（pilot flag）
   系で行われる想定 — 結線漏れがないか T09 の task 要件に含めること
