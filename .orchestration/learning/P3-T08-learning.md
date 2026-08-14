# P3-T08 learning

## L-P3T08-01: 恒等の結合 key は文法で衝突を封じる
複数 field を区切り文字で結合する key は、各 field の文法から区切り文字を
排除し長さも拘束しない限り衝突・上限超過する。「4 要素恒等」は結合文字列では
なく文法拘束された 4 要素として設計する。

## L-P3T08-02: 証跡は「実行が起きる側」の history で取る
親 workflow の history には child の activity が現れない。orchestration の
fixture は親、実行（write 数・retry policy・schedule 列）の fixture は child と
役割を分け、両方を記録・replay する。

## L-P3T08-03: 状態遷移の負条件（stale 等）も receipt で自己整合を検証する
「stale」を返せば write を抑止できる、のような負方向の receipt は偽装・矛盾
（baseline 同値の stale）で正経路を silent に殺せる。負条件 receipt にも
自己整合検査（observedRevision ≠ baseline）を課す。

## L-P3T08-04: TOCTOU は read の反復では閉じない — write authority に条件を運ぶ
直前 re-read は窓を狭めるだけ。stale/CAS 条件は write activity の入力に運び、
authority 側の precondition として実行させ、結果を union receipt で返させる。
