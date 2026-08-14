# P4-T04 Sandbox Record

- Source/tests: repository workspace only。OPA, approval workflow, ledgers, executor はすべて DI mock。
- Database: local disposable PostgreSQL 16 only。`aiops_test`, `aiops_load_test`, `aiops_p001` を fresh recreate して CI を実行。
- Network: real gateway、OPA、Temporal、GitHub/MCP target への request なし。
- Runtime: library を production caller に配線せず、既存 default-disabled posture を維持。
- Secrets: none read, injected, logged, or committed。DB evidence payload は保存前 sanitizer を通す。
- Cleanup: CI が disposable schemas を管理。production resource は作成・変更していない。
