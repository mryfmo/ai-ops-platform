<!-- 根拠: FinalArch:MCP-001 / FinalArch:MCP-002 / ADR-0023 / WBS P4-T01 / WBS P4-T03 / docs/decisions/P0-baseline-gate.md -->

# Owner 裁定: P4 準備構成の binding 分類（2026-08-15）

- 裁定者: Owner（@mryfmo）
- 日付: 2026-08-15（PR #228 / #229 merge 時、「裁定 2 で継続して」）
- 対象: P4-T01（deploy/agentgateway、PR #228）/ P4-T03（deploy/opa +
  packages/policy decision client、PR #229）
- 関連: codex review finding P4-T01-004（high）/
  docs/security/2026-08-10-license-service-review-register.md（agentgateway・OPA 行）

## 裁定内容（option 2 を採択）

P4-T01 / P4-T03 の成果物を **non-enabled preparatory configuration** として
扱う分類を binding として追認する。すなわち:

1. 両構成（agentgateway gateway config / OPA bundle + decision client）は
   **どの runtime からも参照・起動されない準備構成**である。
   agentgateway は結線なし、OPA は `deploy/opa/deployment.yaml` の
   `posture.enabled: false` を維持する
2. **P4 entry の正式クローズと runtime 有効化は、license register の
   agentgateway / OPA 行（exact release・image/dependency/SBOM license・
   Apache NOTICE 処理・承認 role）のクローズまで引き続き blocked**
3. register クローズ前に `enabled` 化・runtime 結線・public 露出を行う変更は
   本裁定違反であり、レビューで差し戻す（P4-T04 以降の結線タスクは
   register クローズを entry 条件に含める）
4. register のクローズ作業（SBOM/依存 license/NOTICE review）は Owner/Security
   の後続作業として Owner 待ち backlog に残る

## 効果

- PR #228 / #229 の merge をもって P4-T01 / P4-T03 は close
  （technical findings は codex adversarial review で全 resolved 済み）
- P4-T02（registry generator）は同分類の下で着手可能
  （生成対象は準備構成のままであり runtime 有効化を伴わない）
- codex review finding P4-T01-004 は本記録をもって resolved
