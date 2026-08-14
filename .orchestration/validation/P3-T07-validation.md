# P3-T07 validation

- state matrix: 7 tests（封筒 16 負ケース / profile 対応両方向拒否 / 三値 ledger）
- recorded fixtures 9 経路 + replay green: complete（PRF-04、sent 既配信 reconciled
  混在）/ approval-free（PRF-02、child 0）/ prf05-no-approval（E-CP-CONTRACT、
  bypass 不能）/ delivery-unresolved（喪失→pending→unresolved、schedule 1 回）/
  pending-no-resend（再実行 schedule 0）/ reconcile-contract（forged receipt →
  E-CP-CONTRACT 終端・wedge なし）/ approval-rejected / validation-failed / shadow
- package: 183 tests / typecheck / lint / coverage 87%+ green
- full CI: fresh 使い捨て DB（run 毎再作成・same-shell）で `mise run ci` exit 0 × 3 回
  （round 毎）
- 途中の失敗と是正: round-1 で「承認必須の一律化」と「fixture の偽台帳モデル」を
  codex が実権威（reportJobStateMachine / DeliveryLogStore / distributeOne）との
  突合と live probe で検出 — writer 側は既存正本の意味論（pending 記録タイミング・
  PRF 分岐）の読み込みが不足していた
