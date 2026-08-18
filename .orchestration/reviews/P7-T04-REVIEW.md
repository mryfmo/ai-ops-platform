# P7-T04-REVIEW — approve at `69c271b`

- task_id: P7-T04 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-17
- head_sha: 69c271b566243d9362d990635c92381d2fb0aa02
- verdict: **approve**

## 独立再検証

- channel-teams 53/53 再実行（snapshot 336 行 + malicious fixtures）+
  fresh-DB `mise run ci` exit 0
- **reviewer プローブ**: 誤形状 payload（不正 field 名等）は parser が
  即 throw（exactKeys — fail-closed の実証）。正形状での markup/URL 注入は
  suite の malicious fixtures が網羅（markdown link/image・HTML tag・
  heading/list/bold・inline `javascript:`/`data:`/`https?:` 文字列を
  plain-text slot regex で reject する実装を検分）

## 検分（UX-002 — data from typed result, not LLM markup）

- **型で経路遮断**: 公開 API は typed 6 種（status/table/chart/incident/
  PR/source）の parser + renderer のみ — 「任意 card markup を受ける入力が
  存在しない」ことを test で固定
- **plain-text slot の markup 拒否**: `<>` バッククォート・markdown 構文・
  inline URL scheme を regex reject（LLM 由来文字列が来ても構造へ
  逃げられない）
- **URL は branded HttpsUrl**（https のみ・credential/hash 拒否）、
  数値は Number.isFinite 必須（NaN/Infinity 拒否）
- **決定的 render**: snapshot 固定（同一入力 byte 一致）。
  **28KiB ceiling**（Teams 制限の一次情報 URL をコード根拠に）超過は
  fail-closed
- スコープ遵守: components/tests のみ・index.ts 非接触（#260 順序条件）。
  runtime revalidation（builder 入口での再検証）も実装

## 妥当性判断

AGENTS 原則 2 の card 面での貫徹 — LLM は文章スロット（それも markup 拒否
regex 通過分のみ）、構造・数値・URL はすべて型付き契約。P7-T10
（Gadget/ViewSpec）の前例となる健全な設計。
