# P3-T07 learning

## L-P3T07-01: workflow 化する前に「置換対象の正本の意味論」を全読する
DeliveryLogStore の pending/sent 二段記録や reportJobStateMachine の PRF 分岐の
ように、既存正本には状態機械の要が埋まっている。orchestration 層を書く前に
正本 lib とその tests を読み、fixture の mock は正本と同じ意味論で作る
（「都合の良い mock」は TMP-003 の偽証跡になる）。

## L-P3T07-02: runExternalSideEffect の callback 内 parse は必ず E-CP-CONTRACT 変換
helper の callback（execute/reconcile）内で素の RangeError を投げると workflow
task の決定的 poison になり無限 retry で RUNNING に固着する。activity await と
parse を分離し、parse 失敗のみ ApplicationFailure.nonRetryable へ変換する
（activity エラーの誤分類禁止）。P3-T03-001 と同族の恒久則。
