# P8-T05-ORCHESTRATOR-REVIEW — approve at `cf5e91d`

- task_id: P8-T05（option A 裁定 = structure parity + 無条件 fail-closed gate）
- reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-18
- head_sha: cf5e91d5bee730f0bfc79e63973ffec93f1f2123（base = P8-T04 be9b4d1、
  同一ファイル依存のため stacked。PR は #267 merge 後に main へ rebase して作成）
- verdict: **approve**

## 独立再検証

- droid-profile tests 7/7、contracts 全体 85/85、actionlint green、
  fresh-DB `mise run ci` exit 0
- **binary pin の独立検証**: Factory 公式 URL から 0.174.0 Linux x64 を
  自分で download し SHA-256 が pin 値
  `e73592e3…a56bbc` と一致することを確認
- scope: action.yml / .factory/** / docs/adr / contracts / 証跡のみ。
  P8-T04 の先行変更（Claude 経路）は無編集（diff で確認）

## 検分（acceptance: same branch/PR/security controls as Claude）

- **pinned CLI**: 公式 direct binary + SHA-256 + version 照合、
  auto-update を導入/実行両 step で無効化
- **無条件 fail-closed gate**: 専用 step の hardcode `DROID_EXECUTION_ENABLED:
  "false"` — 実行 step は到達不能。validator/test が gate の無条件性を検査。
  「動く風に見せない」規範（ADR-0014 系）の維持
- **structure parity**: agent/* branch 必須 / 同一 ceilings 入力検証 /
  temporary HOME（個人設定・hook 排除）/ settings は committed template を
  jq 検証（cloudSessionSync=false、autonomy=low、MCP 無効、blocklist に
  curl/gh/git push/git commit/aws/kubectl/terraform/docker）してから render /
  `--disabled-tools FetchUrl,WebSearch` / 構造化 evidence を Claude と同一
  8-field schema で厳格検証（num_turns 上限は post-run 検査と明記）
- **credential 境界**: FACTORY_API_KEY は不在なら明示失敗（provision せず）、
  LiteLLM virtual key input のみ、provider/master key なし
- **ADR amendment**: 有効化 4 条件（credential gate / P8-T03 契約適合 /
  turn 上限の実行中強制の証明 / 実 E2E）を Owner-reviewed amendment 必須と
  明文化 — active parity を主張しない誠実な narrow claim

## 留意（活性化時に E2E が検証すべき既知事項として記録）

- settings.json の `customModels[0].apiKey` は `${LITELLM_CODING_VIRTUAL_KEY}`
  placeholder のまま render される — Factory 側の env 展開仕様は資格未提供で
  未検証。gate 有効化 E2E（ADR 条件 4）が実挙動で確認する範囲に含まれる

## 妥当性判断

裁定どおりの構造先行。到達不能 step として契約を記録しつつ gate で
fail-closed を保つ形は P8-T03 issuer 構造先行と同型で、claim も誠実。
