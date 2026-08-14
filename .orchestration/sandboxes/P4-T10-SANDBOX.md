# P4-T10 Sandbox Record

- Source/tests: repository workspace only。OPA decision、approval workflow、ledger、executor はすべて DI mock。
- Database: `/private/tmp/p4t10-pg.iNbvGc` の local disposable PostgreSQL 16 only。`aiops_test`, `aiops_load_test`, `aiops_p001` を fresh create して CI を実行。
- Network: real gateway、OPA、Temporal、GitHub/MCP target への request なし。
- Timing: Vitest fake timers と injected clock を使用し、実時間 sleep なし。
- Runtime: library を production caller に配線せず、既存 default-disabled posture を維持。
- Secrets: none read, injected, logged, or committed。
- Cleanup: CI 完了後に disposable PostgreSQL cluster を停止・削除。production resource は作成・変更していない。
