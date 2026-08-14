# P4-T04 Learning

## Reusable Findings

1. gateway の実 operation 名と OPA catalog の `system.group.operation` は別識別子である。executor/ledger receipt には operation、PolicyInput には fully-qualified binding を使い分ける。
2. code-only integration は既存 repo/workflow を structural DI port として注入すれば package dependency や live wiring を増やさず検証できる。
3. approval workflow の返値だけを authority にしない。既存 approvals DB の同一 approval ID/status と照合し、version・expiry・status mismatch を fail-closed にする。
4. policy decision row を先に永続化し、その ID を tool invocation receipt に外部キーで記録すると、成功・失敗・遮断の全結果を同じ policy epoch に追跡できる。
5. URL constructor は path を上書きし得るため、固定 endpoint client は base URL の `pathname === "/"` を boundary で守る。

## Apply To

- live gateway/OPA wiring task after license/environment gates close。
- MCP execution worker と approval Temporal activity の concrete adapters。
- policy/tool invocation observability and evidence queries。
