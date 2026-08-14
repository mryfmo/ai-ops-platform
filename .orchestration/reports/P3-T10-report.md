# P3-T10 report — scheduler per-workflow cutover

- writer: claude-deep-dot / PR #224（final head `aab7541`、4 round で merge）
- 実装: resolveTemporalCutover（stage 別 selector、E-CFG07）+
  resolveLegacySchedulerEffective（server 側 legacy-writer 制約、E-CFG08、
  KILL の legacy 復元）+ observedTask(cutover(...)) 実行ガード（登録維持・
  run() 抑止・抑止 tick も metrics 計測）+ runbook（pause 先行 rollback 規範）
- review 経過: findings 001..007。001/006 は「kill が両経路 dead / 両 writer
  alive を生む」二段の adversarial 検証で、最終的に server 側保証への正直化 +
  手順順序の規範化で決着。002/007 は AST guard の wrapper 鍵・合成形固定
