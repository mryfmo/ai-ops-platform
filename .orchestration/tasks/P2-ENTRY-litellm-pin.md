# P2-ENTRY LiteLLM exact pin と license 境界の証跡化

- task_id: `P2-ENTRY-litellm-pin`
- 根拠: FinalArch:GOV-003 / baseline gate §3-1（LiteLLM 封鎖境界 = P2 phase entry 前）/ P0-T06 register
- Writer: claude-code-fable5-xhigh / Reviewer: codex-gpt56-sol-high
- 発端: Owner 指示（2026-08-12「P2 の pin 調査タスクから進めて」）。test tenant は Owner 準備中

## 調査結果（2026-08-12、独立検証済み）

- **選定 pin**: LiteLLM **v1.96.2**（GitHub Releases の Latest、2026-08-11。backport 系列が活発に保守）
  - tag commit: `83d6d84bfb7a`
  - container image: `ghcr.io/berriai/litellm:v1.96.2@sha256:154e23bb5f31b1f10e16392a8ef299bd2cde08de3a64a6849002cfcc25ce3c63`
- **license 境界（当該 tag で実測）**:
  - root `LICENSE` blob = `3bfef5bae9b48c334acf426d5b7f21bc1913aab9` — **P0-T06 が review した blob とバイト一致**。
    enterprise/ 配下を除き MIT
  - `enterprise/LICENSE.md` blob = `c8607439adfe19df15cf78a04e5964237a89b9bc` — 同じく P0-T06 記録と一致（商用）
  - root LICENSE の参照名 `enterprise/LICENSE` と実ファイル名 `LICENSE.md` の齟齬は当該 tag でも現存 →
    register の fail-closed 方針を維持（enterprise ツリー全体を商用扱いで除外）
  - enterprise/ 実在確認（cloudformation_stack / dist / enterprise_hooks / enterprise_ui / litellm_enterprise）

## 変更内容

- `docs/security/2026-08-10-license-service-review-register.md` の LiteLLM 3 箇所
  （summary 行 / product table の Unknowns・boundary）へ pin と証跡を記録。
  残項目 = P2-T02 のデプロイ時 config 証明（enterprise module 無効・telemetry off）に限定
- gate §3-1 の LiteLLM 封鎖境界（P2 phase entry 前の exact pin + 境界確認）を充足

## フロー

App token push/PR、ai-generated ラベル、Codex レビュー → Owner approve+merge。
merge をもって P2 entry の条件 1 が閉じる（条件 2 = test tenant は Owner 準備中、
P2-T03 到達までに要る）。
