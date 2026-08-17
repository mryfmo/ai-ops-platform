# P10-T03-REVIEW — approve at `481f217`

- task_id: P10-T03 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-17
- head_sha: 481f2173b6747257853c9aa9a5a5085fd359af2a
- verdict: **approve**

## 独立再検証（reviewer 実行）

- `test-identity-secrets.sh` 再実行 → **IDENTITY PASS**（mock-only IAM /
  ECS role 選択 / OIDC / KMS / secret / rotation / fail-closed break-glass
  不在の全検証）
- `validate-modules.sh` STATIC PASS / **guard 負プローブ**
  （AWS_PROFILE=production → 非ゼロ exit）を standalone 実測
- fresh-DB `mise run ci` exit 0（validation 参照）
- worker 側: 独立 self-review が rotation-role 例外の非 rotation secret への
  漏れを検出し regression-first で是正（phase-one 5d1a1c1 → 最終 481f217）

## 検分（REL-001 identity 面）

- **environment separation**: guardrail policy が「環境所有の optional deploy
  policy が過剰許可しても」cross-env secrets/KMS/deploy 資源・role chaining・
  long-lived credential を deny（deny 側の独立レイヤ — over-grant 耐性）。
  `DenyUnexpectedPrincipals` で sibling/cross-env の allow を無効化、
  KMS は `kms:ViaService` で Secrets Manager 経由に限定、
  **KMS 管理者は secret-read を持たない**（管理と利用の分離）
- **OIDC-only**: exact audience/repository/protected-environment subject +
  GitHub Environment の branch 規則で発行前に境界強制。long-lived key 作成は
  role 側でも deny
- **least privilege**: 固定 5 service の専用 execution/task pair、
  Bedrock は LiteLLM のみ・宣言 model ARN 限定、ECR/secret は exact scope。
  **web は alias 禁止の暫定 legacy pair**（secrets 空・ECR web 限定）で
  裁定どおり、専用 boundary 昇格を staging apply 前必須 follow-up として
  report に記録済み
- **break-glass の誠実な非実装**: `aws:PrincipalTag` の static/session tag
  非区別により「federated MFA を trust policy で証明できない」ことを理由に
  **無効のまま**とし、曖昧な信頼を runbook で糊塗しない判断 — 高評価。
  rotation/break-glass runbook は手順と監査要件を文書化
- deploy role の KMS tag 変更 deny（retag による deny 回避の封鎖）まで
  考慮されている

## 妥当性判断

acceptance（environment separation / rotation・break-glass）を、
deny レイヤの独立性・exact principal 束縛・検証可能な mock tests で充足。
「証明できない信頼は実装しない」という break-glass の扱いは
本 platform の fail-closed 原則の模範。
