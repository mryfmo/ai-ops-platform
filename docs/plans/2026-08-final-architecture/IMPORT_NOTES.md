# IMPORT_NOTES — 原本 zip からの意図的差分（2026-08-10）

原本: `references/ai-ops-platform-final-implementation-pack_2026-08-09.zip`（不変・SHA256 記録済み）。
本コピーは Owner 承認済み baseline-delta
（`.orchestration/plan/2026-08-10-pack-adversarial-review/02-baseline-delta.md`）の是正を適用済み（適用範囲は本表が正: PACK-01..08 / DELTA-01..07。旧記述の DELTA-08 は番号誤りで存在しない）。

| 是正ID | 変更ファイル | 内容 |
|---|---|---|
| PACK-01 | 05_contracts/control-api.openapi.yaml | WorkflowSignal から client 供給の actorId を排除（認証主体から導出） |
| PACK-02 | 06_implementation/02_wbs.yaml | P8-T04/T06 の pack 相対パスを repo パスへ正規化 |
| PACK-03 | 06_implementation/02_wbs.yaml | P0-T05 の実在しない `mise run verify:load` を実コマンドへ |
| PACK-04 | 06_implementation/02_wbs.yaml | P0-T03 に traceability 文法/カタログ拡張設計を追加 |
| PACK-05 | 06_implementation/08_feature_flags.yaml | 現行 coding-task 経路の grandfather 規則を明記 |
| PACK-06 | 02_wbs.yaml / 09_owner_decision_register.md | P0-T02 の前提 = ENV-DEC-011（GitHub プラン） |
| PACK-07 | 05_contracts/control-api.openapi.yaml | /health/* と既存 /healthz//readyz の一本化注記 |
| PACK-08 + DELTA-02 | 05_contracts/ledger-migration-design.sql | 既存 approvals/deployments の evolve 方針注記 |
| DELTA-01 | 02_wbs.yaml | P3-T09 の shadow 対象 = 現行 scheduler 15本、P3-T13 新設 |
| DELTA-05 | 02_wbs.yaml | P2-T06 の LLM consumer 一覧を #147 後の現実へ |
| DELTA-03 | 02_wbs.yaml (P1-T05) / ledger-migration-design.sql | 既存 approvals/deployments の authority mapping（並行正本の禁止） |
| DELTA-04 | 02_wbs.yaml (P9-T08) | 既存監視資産（KQL 6ルール・httpMetrics・rolling gauges）の拡張を明記、allowed_paths に ops/azure-monitor-alerts/** |
| DELTA-06 | 02_wbs.yaml (P0-T04) | agt-dep-th001-evidence 契約の保存を受入条件化 |
| PACK-IMPORT-002..005 | docs/adr/0020..0028 / VALIDATION_REPORT / DOCUMENT_INDEX / PACK_MANIFEST / APPLY / Makefile / scripts/validate_pack.py | 独立レビュー是正: repo 側 ADR コピーの prettier 正規化（pack 原本は byte 忠実のまま）、再検証記録（113/64）、再現可能な検証コマンド（uv）、YAML `#` 切詰め防止 assertion |
| DELTA-07 | 02_wbs.yaml / 02_acceptance_test_catalog.yaml / 09_owner_decision_register.md | P6-T11（A054）・P9-T09（A053）新設、ING-001/AIO-006 ゲート追加、D-14/15/16 を ENV-DEC-012..014 として統合 |
| — | BASELINE.md / PACK_MANIFEST.yaml | 承認済み delta の記録、統計更新（113 tasks / 64 gates） |
| — | 10_wbs_task_summary.md / SHA256SUMS | 再生成 |
