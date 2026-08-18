# P8-T03-REVIEW — approve at `062fe49`

- task_id: P8-T03（GOV-003 amended scope、#263 署名発効後に実装）
- reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-17
- head_sha: 062fe49d1172da17ea503857ccf60811c752209a
- verdict: **approve**

## 独立再検証

- control-plane 329/329 再実行、actionlint green、fresh-DB `mise run ci`
  exit 0（ci-exit=0 を明示確認）
- scope 機械照合: allowed_paths 外の変更ゼロ
- `coding-task.yml` から `AIOPS_PR_TOKEN` / `LITELLM_CODING_VIRTUAL_KEY`
  参照が消えたことを grep で確認（残る secrets は callback/PUBLIC_BASE_URL —
  P8-T08 管轄で本タスク対象外）
- route-allowlist `/key` prefix 許可済み（deploy/litellm 無変更の妥当性）を
  実ファイルで確認

## 検分（amended WBS の全 verification 行）

- **OIDC 負テスト**: issuer 不一致 / audience 不一致 / repository 不一致 /
  subject 不一致 / 期限切れ → 一律 IDENTITY 拒否、provider I/O 前に遮断
- **scope 負テスト**: out-of-scope repository / **main branch**（branchName は
  `agent/<taskId>` 完全一致必須）/ 他 model alias / budget 超過 / duration 超過
- **always-revoke**: workflow は LiteLLM key を agent step 直後、GitHub token
  を PR step 直後に `always()` で revoke。revoke 失敗 = step fail（握り潰しなし、
  lease は retryable に残る test あり）。期限切れ発行物は返却前に revoke +
  拒否。有限 expiry（LiteLLM duration ≤ 1800s = job timeout、GitHub 1h）
- **root 非流出**: master key / App private key は注入 provider 内のみ。
  grant JSON に master|private|app-jwt が含まれない test。GitHub token は
  commit 後にのみ発行され **push/PR step だけ**に渡る（agent step は LiteLLM
  virtual key のみ、input 渡しで lifecycle script 非継承 — 既存規範維持）
- **応答スコープ検証**: LiteLLM 応答の models/budget/expiry echo 一致必須、
  GitHub 応答の permissions 完全一致（metadata:read のみ許容）+ 単一 repo
  full_name 一致 — issuer 側 fail-closed
- **fail-closed 構成**: issuer URL/audience/budget 未設定は workflow 冒頭で
  明示失敗（裁定どおり live endpoint まで構造先行）。PAT removal readiness
  達成、secret 最終削除は P10-T10 維持

## 妥当性判断

署名済み amendment の要求を全行実装。lease 間接参照（root credential を
cleanup に使わない）と応答 echo 検証は要求以上の防御で、P3/P4 規範と整合。
