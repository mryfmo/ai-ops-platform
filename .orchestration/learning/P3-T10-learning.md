# P3-T10 learning

## L-P3T10-01: kill switch は「単一 env で安全側」を全構成 matrix で検証する
kill の意味論は他 flag との組合せ（primary+legacy=false 等）で破綻し得る。
安全側復帰は「全永続構成 × kill」の matrix で、boot 可否と writer 数を検証する。

## L-P3T10-02: 制御できない writer への主張はしない
server の flag は Temporal 側 schedule を止められない。「exactly-one-writer」の
ような主張は制御範囲に正直に縮め、越える部分は手順（順序規範）+ 警告 +
冪等台帳の最終防壁として文書化する。

## L-P3T10-03: 合成順（wrapper の入れ子）は AST gate で直接引数レベルに固定する
再帰探索の存在チェックは合成順の regress（metrics 迂回・decoy）を素通しする。
「外側呼び出しが X、その直接引数が Y(literal, task)、出現は exactly one」まで
固定して初めて gate になる。
