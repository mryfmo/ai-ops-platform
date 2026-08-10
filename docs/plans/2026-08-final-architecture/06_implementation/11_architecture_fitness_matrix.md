<!-- 根拠: FinalArch:INV-001 / FinalArch:INV-002 / FinalArch:INV-003 / FinalArch:INV-004 / FinalArch:INV-005 / FinalArch:INV-006 / FinalArch:INV-007 / FinalArch:INV-008 / FinalArch:INV-009 / FinalArch:INV-010 / FinalArch:INV-011 / FinalArch:INV-012 / FinalArch:INV-013 / FinalArch:INV-014 / FinalArch:INV-015 / FinalArch:INV-016 / FinalArch:INV-017 / FinalArch:INV-018 / FinalArch:INV-019 / FinalArch:INV-020 / FinalArch:GOV-004 / FinalArch:GOV-005 -->

# Architecture fitness matrix

`mise run governance` は、静的に決定できる禁止形を `scripts/check-architecture-fitness.mjs` で fail closed に検出する。組織権限、外部サービス設定、運用上の役割分離など、リポジトリだけでは判定できない項目は、下記の manual gate を phase acceptance 前に人間が確認する。

| Invariant | Gate type | Evidence |
|---|---|---|
| INV-001 | manual | Phase owner が `03_system_of_record_matrix.md` と実環境の Plane/GitHub ownership を照合し、phase acceptance に記録する。 |
| INV-002 | manual | Knowledge/records owner が Confluence/SharePoint の publishing 権限と保存先を照合し、正式発行の証跡を承認する。 |
| INV-003 | manual | Records owner が Teams/Outlook/Wispr/Workbench 出力を正式記録として扱う前に、正本への publish receipt を確認する。 |
| INV-004 | manual | Control-plane owner が Temporal cutover 前に workflow/retry/timer/approval/compensation/cancellation の移行証跡を承認する。 |
| INV-005 | automated | `EGRESS` は SPEC-INT-060 allowlist 外への literal direct `fetch` を拒否し、`GATEWAY_OVERLAP` は LLM/MCP 責務の混線を拒否する。 |
| INV-006 | automated | `GATEWAY_OVERLAP` は `deploy/agentgateway/**` 外の MCP/A2A runtime endpoint を拒否する。 |
| INV-007 | manual | M365/security owner が Work IQ の delegated/OBO と Graph の app-only/background role を conformance evidence で承認する。 |
| INV-008 | manual | Security owner が OPA policy decision と Microsoft 365/GitHub native authorization の双方が有効な証跡を承認する。 |
| INV-009 | automated | `FORBIDDEN_PLATFORM` は Cloudflare Artifacts の依存、設定、URL を拒否する。 |
| INV-010 | manual | Product/control-plane owner が OpenTag を UI/HITL surface に限定し、SoR/control state を保持しないことを設計レビューする。 |
| INV-011 | manual | PR reviewer が task manifest、branch、writer、reviewer の履歴から 1 task = 1 writer と reviewer read-only を確認する。 |
| INV-012 | manual | Repository owner が branch protection、CODEOWNERS、人間 merge/deploy approval の有効性を GitHub 設定証跡で確認する。 |
| INV-013 | automated | `MCP_TOOL` は tool-risk catalog の allowlist 外、または globally forbidden の MCP tool 設定を拒否する。 |
| INV-014 | manual | Policy owner が数値、色、状態、権限、範囲、承認判断の決定コード/OPA test evidence を変更 PR ごとに確認する。 |
| INV-015 | automated | `mise run ci` の sanitizer と外部入出力境界テストが保存前、LLM 入力前、外部出力前の多層防御を検証する。 |
| INV-016 | automated | `mise run ci` の audit-log unit/DB integration checks が追記専用制約と副作用 provenance を検証する。 |
| INV-017 | automated | `mise run ci` と Vitest 4 の直接 file filter を用いる `verify:load*` が、未実行/誤フィルタの green 化を防止する。 |
| INV-018 | manual | Platform owner が Azure control-plane topology と Bedrock の推論用途限定を deployment diff と owner gate で確認する。 |
| INV-019 | automated | `FORBIDDEN_PLATFORM` は Notion client 依存、baseline 設定、API URL を拒否する。 |
| INV-020 | automated | `mise run traceability`、`FLAG_REGISTRY`、`INVARIANT_MATRIX` が仕様 ID、正本 flag、全 20 行の対応を検証する。 |

## Manual gate protocol

Manual 行は phase acceptance の blocking check である。記載した owner は、対象環境の read-back、approval/export URL または署名済み文書、確認日時、判定を completion evidence に残す。証跡が未取得、mock のみ、または設定不足で経路が無効な場合は `ENV-blocked` とし、green や完了として扱わない。

## Automated check scope

- Production source: `packages/*/src/**`
- Runtime configuration: `.github/**`, `config/**`, `deploy/**`, `ops/**`, `packages/*/config/**`
- Canonical contracts: `08_feature_flags.yaml`, `tool-risk-catalog.yaml`
- Generated output、dependency tree、test fixture、orchestration evidence は scan 対象外。反例は `tests/fixtures/architecture-fitness/**` に固定する。
