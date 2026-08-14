# P3-T08 validation

- state matrix 10 tests（恒等文法・長さ / 三値 ledger / promotion 専用 parser /
  CAS union（矛盾 stale 拒否込み）/ draft receipt provenance）
- fixtures: 9 scenario × 親 + child = 23 history files。replay 16 本 green。
  child history で activity schedule 列・write 数（喪失込み 1 回）・
  maximumAttempts=1 を assert、親は orchestration（3 child 分離・失敗伝播・
  親 activity 0）を assert
- package 221 tests / typecheck / lint green
- full CI: fresh 使い捨て DB（run 毎再作成・same-shell）で `mise run ci` exit 0 × 3
- 途中の失敗と是正: round-1 の 6 findings は「fixture の実行証跡が親に存在しない」
  「mock が正本意味論より甘い」「検証が helper/活動境界の間違った側にある」に
  大別され、child history 記録・CAS 契約化・await/parse 分離で解消
