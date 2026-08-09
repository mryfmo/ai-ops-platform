# Document Index

## Root

| File | Purpose |
|---|---|
| `START_HERE.md` | 利用開始点、読む順序、絶対ルール |
| `PACK_MANIFEST.yaml` | 機械可読メタデータ、採用/除外決定 |
| `BASELINE.md` | 対象repo/commitと調査制約 |
| `SOURCE_REGISTER.md` | 一次情報と実装時再確認先 |
| `APPLY_TO_REPOSITORY.md` | パックをrepoへ導入し、P0を開始する手順 |

## Governance / Current state

- `00_governance/`: 製品意図、不変条件、意思決定権限、SoR、非目標。
- `01_current_state/`: 現行repo評価、gap、変更map。

## Requirements / Architecture

- `02_requirements/`: PRD、機能/NFR、use case、traceability seed。
- `03_architecture/`: target/runtime/security/data/knowledge/routing/resilience。
- `04_component_specs/`: 各componentの実装境界と完了条件。
- `05_contracts/`: OpenAPI、AsyncAPI、DB design、JSON Schema、routing/tool/MCP manifests。

## Implementation / Agent execution

- `06_implementation/02_wbs.yaml`: 113タスク（是正適用後）の機械可読正本。
- `06_implementation/10_wbs_task_summary.md`: 人間向け一覧。
- `07_agent_execution/`: Claude/Codex規約、routing、handoff、prompt、change boundary、task/evidence template。

## Verification / Operations / Decisions

- `08_verification/`: 64 blocking acceptance gates（是正適用後）、security、chaos、compatibility、release gate。
- `09_operations/`: runbook、SLO、incident、backup/restore、upgrade/rollback。
- `10_adrs/`: ADR-0020〜0028候補。
- `11_diagrams/`: Mermaid source。

## Tooling

```bash
python scripts/validate_pack.py
python scripts/render_task_summary.py
make checksums
```
