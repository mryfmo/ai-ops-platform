# P2-T06 report

- Status: review complete — codex **approve**（final head `9d83834`、findings 001..009 + Owner 裁定すべて解消）。Owner merge 待ち
- Branch: `agent/P2-T06-server-llm-gateway`
- Writer: claude-code-fable5-xhigh / Reviewer: codex-gpt56-sol-high（PR 起票後に発注）

## Delivered

- config.ts: `inference.litellm.enabled`（off 以外）で LITELLM_BASE_URL / LITELLM_VIRTUAL_KEY
  必須化・model 既定を logical alias（claude-standard / claude-governed）へ・
  gateway モードで alias 以外を E-CFG01 拒否・kill switch 対応。
  `GATEWAY_MODEL_ALIASES` / `LITELLM_FLAG_NAME` を export
- index.ts: LLM 構築点（唯一）を `createAnthropicTransport()` へ差し替え。
  gateway 既定 / direct は ANTHROPIC_API_KEY + 移行フラグの背後のみ / どちらも無ければ無効。
  transport 構成（mode・gateway host・models）を audit log へ記録（LLM-006 route metadata。
  cost は既存 PgCostGuard の usage 行 model 列に alias が載る）
- 全 7 consumer は DI 済みのため無変更（survey どおり）
- .env.example は permission 上 orchestrator が触れないため worker（P2-T06-ENVEX）へ委譲し
  diff 検分のうえ受け入れ

## escalation model の設計判断（レビュー観点）

- 正典 alias 集合に capability 階梯の明示スロットが無いため、escalation 既定は
  `claude-governed` とした（実体 model は proxy 側 BEDROCK_CLAUDE_GOVERNED_MODEL_ID が
  binding。classification 許容は governed が上位集合）。alias 追加が必要なら
  正典 model-routing 改訂の別タスクとする

## レビュー是正の要点（P2-T06-001..009）

- 001: direct fallback は正典 flag 解決を経由 → 最終的に **server は direct transport を
  一切構成しない fail-closed**（per-call classification/provider-allow 境界が無いため。
  意図は `llm_direct_fallback_unavailable` warn 監査に顕在化。正典の direct 遮断 = WBS P2-T10）
- 002: capability 報告 / disabled reason を実 transport 状態基準へ
- 003: .env.example を両モード boot 可能な形へ（worker ENVEX2、diff 検分受入）+ 空文字未設定同一視
- 004: fitness oracle を raw ban 化（@anthropic-ai/ 全面 + provider host コメント込み）+ 自己検証
- 005: virtual key trim + 空白拒否（起動時 fail-fast）
- 007: **AGT_BLD 修正案生成（provider-native Agent SDK 経路）を server から配線切断**
  （`build_fix_suggestion_disabled` warn 監査 + oracle 到達禁止チェック。gateway 移行は
  ADR-0022 / WBS P8 の専用タスク）
- 008: 適用対象 guard を handler 所有に（dependency/infra で誤 warn しない + 負テスト）
- 009: 生成物 timestamp 混入を diff から除去（正規 9 ファイル）
- Owner 裁定: claude-governed = capability 昇格先（proxy env binding 規約、config.ts 記録）
