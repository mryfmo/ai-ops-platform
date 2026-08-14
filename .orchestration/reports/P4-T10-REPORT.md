# P4-T10 Bounded MCP Invocation Profile

## 概要

`GovernedMcpToolCaller` の実行面に risk level 別の result size、wall-clock timeout、depth / chain / recursion 上限を追加した。上限違反は tool result を返さず fail-closed とし、既存 action ledger と tool invocation receipt に相関付き E-code を記録する。

## Delivered

- 単一の reviewed constant で L0〜L3 の deterministic bounds を定義。高 risk ほど size / time / depth / chain を厳しくした。
- OPA `maxResultBytes` obligation と profile は min-wins で合成し、非正整数は malformed decision として deny。
- root call から派生 context を作る helper と、欠落・不正 depth、chain 超過、同一 `operationId` 再帰の execution 前遮断を追加。
- executor を timeout race で囲み、return 後にも elapsed wall-clock を検査。timeout 後に届く結果は ledger / receipt を success へ変更しない。
- oversized / timeout / depth / recursion は `E-TOOL-*` で failed。partial result は返さず、receipt は trace / actor / tool / resource / result correlation を常に持つ。
- P4-T04 の decision-first、action claim、approval 二重照合、全 terminal path receipt を維持。schema、dependency、policy package、live wiring は変更していない。

## Approved Bounds

| Risk | maxResultBytes | timeoutMs | maxDepth | maxChain |
| --- | ---: | ---: | ---: | ---: |
| L0 | 1,048,576 | 30,000 | 4 | 8 |
| L1 | 524,288 | 20,000 | 3 | 6 |
| L2 | 262,144 | 10,000 | 2 | 4 |
| L3 | 131,072 | 5,000 | 1 | 2 |

## Posture

- code-only library。real gateway / OPA / MCP target / Temporal への接続なし。
- timeout は executor の外部副作用を cancel する契約ではなく、この caller の terminal ledger / receipt を failed に固定する境界。
- profile 変更点は exported constant 1 箇所に限定し、数値変更をレビュー可能にした。

## Validation Summary

- focused governed-call tests: 21/21 green。
- integrations coverage: 4 files / 37 tests、statements 84.61%、branches 77.69%、functions 96.07%、lines 91.97%。
- fresh disposable PostgreSQL 16 DB 3 件で `mise run ci`: exit 0。

## Review Focus

- exact-limit semantics: result bytes は `>`、elapsed time は `>=` で遮断。
- chain は current call を含むため、ancestor 数が `maxChainLength` に達した時点で遮断。
- limit failure の receipt が result payload を持たず、correlation と DB evidence link を保持すること。
