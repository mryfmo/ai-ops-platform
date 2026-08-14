# P4-T04 Gateway × OPA × Action Ledger Integration

## 概要

MCP tool call を実行前に OPA decision、既存 action ledger、既存 approvals authority へ必ず通す code-only 統合を追加した。実 gateway / 実 OPA には結線せず、既存 disabled registry/flag posture を維持する。

## Delivered

- registry の `allowed_callers` / `risk` / operation と canonical `system.group.operation` を厳格検証し、OPA `PolicyInput` へ決定的に写像する pure builder。
- `GovernedMcpToolCaller`: decision 永続化 → action plan → approval/claim → tool execution → versioned receipt の順序を DI 境界で固定。
- deny、OPA 障害、malformed/version drift、L2/L3 の approval 不在を fail-closed で遮断。decision なしで executor に到達する経路を持たない。
- `require_approval` は既存 `approvals` 正本と P3-T03 workflow result の一致を確認し、approved の場合だけ実行。reject/expire/mismatch は terminal で auto-approval しない。
- success / failed / blocked receipt は常に `decisionId`、decision、`policyBundleVersion` を保持し、既存 `tool_invocations.policy_decision_id` / `approval_id` にリンクする。
- policy/tool evidence の JSON を既存 secret sanitizer で DB 保存前に sanitize。schema・parallel authority・dependency は追加していない。
- `OpaDecisionClient` は origin root 以外の `baseUrl.pathname` を拒否し、decision endpoint の silent rebind を防止。

## Posture

- code-only library のため runtime caller は追加しておらず、execution は default off のまま。
- live gateway/OPA、資格情報、外部 network、production enablement は対象外。
- L4-L6 は gateway path から拒否し、L2/L3 は linked approval をローカルでも強制する。

## Validation Summary

- focused governed-call tests: 11/11 green。
- integrations coverage: 4 files / 27 tests、statements 83.27%、branches 76.08%、functions 95.34%、lines 91.70%。
- policy tests: 2 files / 12 tests green。
- fresh disposable PostgreSQL DB 3 件を再作成後の `mise run ci`: exit 0。

## Review Focus

- decision record が action claim / executor より前であること。
- approval workflow result と approvals DB authority の不一致を fail-closed にすること。
- gateway operation 名と OPA catalog の fully-qualified tool 名を混同していないこと。
- receipt と policy decision / approval の永続リンク、および DB 保存前 sanitize。
