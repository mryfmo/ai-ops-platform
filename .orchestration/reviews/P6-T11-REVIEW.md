# P6-T11-REVIEW — approve at `c867923`

- task_id: P6-T11 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-16
- head_sha: c86792378f0f57d664811fd4d443c8b4c708f740
- verdict: **approve**

## 順序条件の遵守確認

- merge base = `770b95b`（#246 の merge commit）— **schema/migration は
  #246 取込後に commit**（裁定どおり）。latest main（#247/#248 込み）との
  merge conflict 0 を機械確認

## 独立再検証

- shared 498 / prjops 357 / control-plane 297 / integrations 71 —
  全 suite 再実行 green
- fresh-DB `mise run ci` exit 0（reviewer 環境単独判定 — validation 参照）
- **normalizer 反証プローブ（built dist）**:
  - 正常 payload: secret（sk-ant 形）が正規化出力から**除去**され、
    出力は決定的（byte 一致）
  - projectId 優先順位: subject（PJ-101）> body/hint — 実測どおり
  - fail-closed の実証 6 連: 未知 field / 不正 timestamp / 非 canonical
    reporterId（ST- 形式強制）/ structured 未知 field / 誤 shape ×2 —
    すべて throw（probe 試行の失敗自体が strict 検証の証明になった）

## 検分（ING-001）

- **preserved contract parity**: statusIngestContract / freeTextValidation は
  無変更（diff 検分）。completeness / clarify≤3 / escalate 判定はすべて
  contract へ委譲し、workflow 側は receipt parity 検証のみ
- **no duplicate ingestion**: DB UNIQUE(channel, source_message_id) +
  workflow 側 claim の二層。clarify count は CHECK 0-3 の永続 authority
  （workflow 状態でない）
- **E-ING audit**: 全遷移を AuditLogWriter.append（metadata のみ）。
  原文 body 列は schema に不在
- P3 規範継承: claim→audit→canonical→notification→completion の順序を
  recorded history + replay で固定、single-attempt+reconcile、CAS 終端、
  unknown 境界検証。shadow は read-only（write/notify/audit を dispatch
  しない）
- Teams 受信は app-only `GraphSystemClient` 面に型で限定（P5-T06 の分離を
  正しく消費）。canonical authority は外部 prjops-data/status_updates の
  まま（PG は dedupe/clarify/receipt のみ — 並行 authority なし）
- amendments 遵守: schema 順序 / pg・@types/pg（既存 range 再利用・
  importer 差分のみ）/ vitest exclude は sandbox workflow 政策どおり

## 妥当性判断

ING-001 の 3 要件（channel fixture E2E / completeness・clarification tests /
E-ING audit records）を、preserved contract を単一正本とした委譲構造で充足。
17-case matrix + replay + real-PG 並行テストの検証密度も十分。

---

## R01 追補（2026-08-16）

- **R01（blocking、resolved）**: clean runner の coverage step は
  TEST_DATABASE_URL を持たず PG suite が skip → 新規 store 未カバーで
  prjops が閾値割れ（lines 88.83/functions 90.49/statements 87.2）。
  root-fix `e496911`: P5-T08 の dual-test パターンどおり mock PgQueryable の
  DB-less unit tests（216 行）を追加 — 閾値低下・exclude なし
- reviewer 再現検証: `env -u TEST_DATABASE_URL pnpm run test:coverage` で
  363 passed・閾値クリア（90.55/83.27/93.66/92.49、store は 100% stmts/fn/lines）
- 教訓（review 定型へ追加）: real-PG store には必ず unit 変種を併設し、
  `env -u TEST_DATABASE_URL` での coverage 通過を受入条件にする
- verdict: **approve at `e496911`**
