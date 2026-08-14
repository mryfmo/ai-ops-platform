# P4-T03 Learning

## Reusable Findings

1. OPA bundle を repository root 相対 path から build すると、archive namespace に developer workstation の absolute path が入るのを防げる。`opa inspect` で revision、Rego version、namespace をまとめて gate する。
2. OPA decision log の stdout 運用でも caller input は既定で含まれる。`data.system.log.mask` で `/input` を除去し、runtime smoke で sentinel が log に存在しないことを確認する。
3. Decision client は HTTP success を trust せず、unknown field・decision enum・obligation type・decision ID・bundle revision を boundary で検証する。version drift を malformed と同様に deny へ正規化すると、receipts が意図しない policy epoch を受理しない。
4. Apple container/OPA の listener は workspace sandbox で EPERM になり得る。bundle/config defectとの切り分け後に exact smoke script だけを scoped execution し、container cleanup を trap で保証する。

## Apply To

- 後続 P4-T04 invocation receipt integration。
- OPA bundle promotion/image provenance gate。
- OPA decision-log/OTel integration tests。
