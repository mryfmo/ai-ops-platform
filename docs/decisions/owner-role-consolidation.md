<!-- 根拠: FinalArch:GOV-003 / ADR-0027 -->

# Owner 役割兼任の公式記録

- 記録日: 2026-08-10（Owner 裁定、セッション記録「兼任を記録する」）
- 適用範囲: 本リポジトリの **すべての ENV-DEC / owner ゲート**（既存・将来）

## 記録

正典 owner 決定台帳（docs/plans/2026-08-final-architecture/06_implementation/
09_owner_decision_register.md）が要求する承認役割 **Owner / Security / Ops /
Procurement（および Legal / Data Owner 等の派生役割）を、本環境では Owner
（リポジトリ所有者 mryfmo）が公式に兼任する**。

- 各 ENV-DEC は Owner の承認 1 件で全役割の承認として充足する
- 兼任は推定ではなく本記録によって明示される（レビューは本ファイルを参照する）
- 将来、役割を個別の担当者へ分離する場合は本記録を改訂し、以降の ENV-DEC から
  分離後の承認要件を適用する（遡及しない）
- 兼任は承認権限の統合であり、レビュー統制（AI 生成 PR への人間レビュー、
  branch protection、adversarial review）を弱めない
