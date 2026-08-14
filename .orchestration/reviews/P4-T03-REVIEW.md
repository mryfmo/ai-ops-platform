# P4-T03-REVIEW — PR #229 approve at `bd973ed`

- task_id: P4-T03 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-15
- pull_request: https://github.com/mryfmo/ai-ops-platform/pull/229
- head_sha: bd973ed974f127a12a8ec48cb50d2ade677ad43d
- verdict: **approve**（non-blocking note 1 件）

## 独立再検証（reviewer 実行）

- OPA image digest: registry manifest 実測で
  `sha256:2f42ca76…` が `1.19.0-static` の index digest と一致。
  v1.19.0 release は 2026-07-30 公開 → 24h hold 充足
- `mise run policy:rego` 16/16 / `pnpm --filter @aiops/policy run test` 11/11 /
  `build-bundle.sh` revision=0.1.0 / `deploy/opa/smoke.sh` 全 OK
  （unknown tool → default_deny + bundle 0.1.0、masked log に caller input 不出現）
  をすべて reviewer 側で再実行

## 反証プローブ（すべて deny に正規化されることを実測）

1. envelope への未知 key（metrics）混入 → deny E-OPA-MALFORMED
2. bundle version drift（0.2.0）→ deny
3. result.decisionId と envelope decision_id の不一致 → deny
4. reasons への非 string 混入 → deny
5. result 欠落（bundle 未 load 状態の応答）→ deny
6. obligations.allowedProvider の未知値 → deny
7. HTML body（非 JSON）→ deny
8. 正常 require_approval は通過し policyBundleVersion 常在
9. network 全滅時の fetch 呼び出し = maxAttempts ちょうど（bounded）、
   403 は 1 回で即 deny（deterministic 4xx を retry しない）

## 妥当性判断

- fail-closed 境界は宣言どおり: 全異常経路が versioned deny（E-code 付き、
  requireHumanApproval=false の deny は approval 迂回を生まない）
- receipts 結線契約（MCP-002「bundle version in receipts」）: 成功・失敗の
  全経路で policyBundleVersion が返り値に常在することをプローブで確認
- log mask: `data.system.log.mask` が `/input` を erase。smoke で
  caller input の不出現を実測（reviewer 再実行でも確認）
- governance: `enabled: false` の non-enabled preparatory declaration は
  P4-T01 と同じ Owner gate（license register OPEN）配下として一貫。
  PR body / deployment.yaml / report が同旨を開示
- スコープ: `packages/policy/**` + `deploy/opa/**` + 証跡のみ。runtime 結線なし
  （P4-T04 管轄）。依存追加なし・gate 弱体化なし・秘密なし（gitleaks は CI 検証）

## Non-blocking note（P4-T04 で対応）

- `new URL(OPA_DECISION_PATH, baseUrl)` は絶対 path join のため、baseUrl に
  path prefix があると silent に落ちる（`http://host/prefix/` →
  `/v1/data/...` が root に解決）。platform 内 URL は root 前提のため実害は
  ないが、P4-T04 の結線時に `baseUrl.pathname === "/"` の guard 追加を推奨
