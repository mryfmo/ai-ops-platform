# P2-T05 validation

実行者: claude-code-fable5-xhigh（writer）。日付: 2026-08-12。head `024a95d`。

## shared tests

- `pnpm --filter @aiops/shared run test` → **493 passed (493)**（新規 8:
  transport 構成拒否 / gateway Bearer 注入 + リクエスト毎トークン解決（rotation）/
  direct x-api-key（フラグ必須）/ 空トークン fail-closed（実 fetch 未到達）/
  正規化 16 ケース表駆動 / httpStatus 保持 + sanitize + 512 字切り詰め /
  正典語彙一致）
- 既存 `anthropicClient.test.ts` は 1 行も変更なし・全 green
  （acceptance: existing structured output tests preserved）
- 正典語彙一致テストは `deploy/litellm/model-aliases.yaml` の
  `on_errors: &allowed_fallback_errors` / `fallback_forbidden_errors:` を
  実ファイルから抽出して `FALLBACK_*_ERROR_CLASSES` と deepEqual

## 型・静的検査

- `pnpm --filter @aiops/shared run typecheck` green / `mise run lint` green /
  `mise run format` green（format:write 適用後）

## fresh 使い捨て DB CI

- 55432 で `dropdb --if-exists aiops_p001 && createdb aiops_p001`、
  db:require 指示 env を設定し `mise run ci` を単独実行 → **exit 0**

## lockfile

- 依存追加なし。pnpm-lock.yaml 変更なし

## レビュー是正後の再検証（P2-T05-001..003、head `8a1d337`）

- 001 独立確認: mode 未知値が両分岐をすり抜け direct 既定へ落ちる / 末尾ドット FQDN
  通過 / SDK 絶対 URL 指定で direct host へ virtual key が付く — いずれも reviewer の
  no-network probe どおり再現。修正後は origin 照合が**トークン解決前**に走り、
  negative test で getToken / inner fetch とも 0 call を保証。redirect:'error' 付与
- 002: status 優先へ並べ替え。矛盾シグナル 3 ケース（403/401 "timed out"、
  400 "invalid timeout value"）が forbidden のままであることを表に追加
- 003: cause 連鎖 walk（深さ 5）。ECONNRESET→model_temporarily_unavailable、
  ETIMEDOUT→timeout、E-CFG05→unknown（fail-closed）を表に追加
- shared **495 tests green** / typecheck / format green / fresh DB `mise run ci` exit 0

## 004/005 是正（head `f81e189`）

- 接続エラー判定を `instanceof Anthropic.APIConnectionError/APIConnectionTimeoutError` へ
  変更（可変 Error.name の文字列比較を撤去）。実 SDK インスタンス 5 ケース +
  偽装 name 負ケースを追加。shared 495/495 green
- PR 本文を現 head に同期。codex 再レビュー: **approve**（残 findings なし）
