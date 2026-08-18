# P8-T04-ORCHESTRATOR-REVIEW — approve at `be9b4d1`

- task_id: P8-T04（option A 裁定 = action-only、narrow claim）
- reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-18
- head_sha: be9b4d1e9ac48cf28ee94c3cff1b5d97f233598d
- verdict: **approve**

## 独立再検証

- contracts claude-profile test 6/6 再実行、actionlint green、
  fresh-DB `mise run ci` exit 0
- **CLI flag 実在プローブ（reviewer 独自）**: 同 version 2.1.222 の
  darwin-arm64 artifact を取得し実行検証 — help 記載 12 flag すべて OK、
  help 非表示の `--task-budget` / `--max-turns` も **parse・値検証される
  実 flag であることを実挙動で確認**（invalid 値でエラー、bogus flag は
  unknown option 拒否 = プローブ有効性も確認）。`--task-budget` は API 側
  最小 1024 — action の上限 200000/既定値は適合
- scope 機械照合: action.yml + 07_agent_execution docs + contracts/
  agent-execution（新規）+ contracts/package.json（test 登録 1 行）のみ。
  coding-task.yml 非接触（option A 裁定遵守）

## 検分（acceptance 3 点 + deliverables）

- **pinned CLI**: package manager / postinstall を排し、native artifact を
  exact URL + SHA-256 検証 + version string 照合で導入（gitleaks 導入と
  同水準）。platform guard あり。virtual key は導入 step へ渡らない（既存
  防御維持）
- **PR-only**: agent/* branch 必須（detached/main で明示失敗）+
  tool policy で `git push/commit/tag/merge/rebase/reset`・`gh` を deny —
  runner 内から書き込み経路なし（push/PR は P8-T03 の資格分離 step のみ）
- **no direct provider key**: env は LiteLLM base URL + virtual key のみ。
  validator が provider/master key 混入を負検査
- **permissions/tool policy**: dontAsk + 明示 allow（read/edit/検索/test 実行
  系のみ）+ deny（network: WebFetch/WebSearch/curl/wget/ssh、deploy:
  aws/kubectl/terraform/helm/docker、依存変更: pnpm add/install/npm/npx）。
  MCP は strict + 空 config
- **ceilings**: runtime（timeout ≤1800s = P8-T03 lease 整合）/ cost ≤25 /
  tokens ≤200k / turns ≤500 — 入力検証つき、profile label は固定値必須
- **evidence callback**: `--json-schema`（additionalProperties:false、
  P8-T01 callback 8 field）で構造化出力を強制し、profile 一致を jq 検証
  して action output へ。既存 caller の callback step が消費可能
- narrow claim 遵守: 動的 manifest/guard/budget 結線は P8-T08/T09 系へ
  defer と report/validation に明記。staging E2E 未実施を明記（COD-003 の
  live 面は環境 gate 後）

## 妥当性判断

option A の範囲を過不足なく実装。deny-by-default tool policy と
schema 強制 evidence は要求水準どおりで、flag 実在も reviewer 実証済み。
