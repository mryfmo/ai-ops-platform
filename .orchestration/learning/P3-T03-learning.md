# P3-T03 learning

## L-P3T03-01: workflow bundle は entry 1 ファイルに集約する
workflowsPath は「その file の export だけ」が bundle に載る。workflow を追加したら
entry に export を足す。複数 path の分散は "no such function is exported" を招く。

## L-P3T03-02: time-skipping env で worker の graceful shutdown は drain しないことがある
worker.shutdown()/runUntil 後段の drain が open workflow を抱えたまま hang する
（poll が解けない）。worker 交代の振り付けで restart を再現するのではなく、
maxCachedWorkflows=0 で per-task history 再構築（同一の resume 経路）を記録する。

## L-P3T03-03: 長時間 script は必ずログ file へ書き、進行を timestamp で判定する
grep pipe 越しの buffering で「無出力=停滞」を誤判定しやすい。file へ書いて
tail の timestamp と成果物（fixture）の mtime で進行を判定する。
