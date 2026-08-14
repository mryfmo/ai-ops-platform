# P4-T10 Learning

## Reusable Findings

1. invocation context は optional にすると omission が depth guard bypass になる。型では required、runtime では missing / malformed を correlated failure として扱う。
2. timeout race だけでは synchronous result processing 中の deadline 超過を見逃し得る。executor return 後にも injected wall clock を比較すると deterministic に閉じられる。
3. timeout 後の Promise を cancel できなくても、race の terminal result と単一 receipt path を固定すれば late success による ledger mutation を防げる。
4. runtime profile と policy obligation の上限は min-wins にすると、policy が execution guard を緩和できない。
5. limit failure を中央の failed ledger + receipt helper に集約すると、partial result を漏らさず trace / actor / tool / resource / result correlation を全 E-code に揃えられる。

## Apply To

- live MCP execution adapter の nested-call context propagation。
- policy obligation の追加上限を runtime guard と合成する task。
- timeout / payload limit の observability and evidence queries。
