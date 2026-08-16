# P6-T11: Implement PrjOps status ingest pipeline

- task_id: P6-T11
- writer: codex-deep-dot（Owner 指示 2026-08-15 により実務委任。WBS 原記載
  writer=claude。orchestrator は起票・adversarial review・acceptance）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P3-T02 ✅ / P5-T06 ✅
- requirement_refs: PRD-001 / PRD-010 / A054 / REQ-004 / REQ-005 /
  PrjOps:SPEC-INT-030
- adr_refs: ADR-0020
- acceptance_gate_ids: ING-001（channel fixture E2E / completeness・
  clarification tests / E-ING audit records — ci gate、blocking）
- risk: medium

## Canon / 前提（必読）

- **preserved pure contract が正本**（変更禁止・その上に組む）:
  - `packages/shared/src/reporting/statusIngestContract.ts`
  - `packages/prjops/src/lib/freeTextValidation.ts` —
    必須 6 項目の欠落判定（決定的・LLM 不使用）、
    `accept | clarify | escalate_incomplete`、clarifyCount >= 3 で escalate
- P3-T02 workflow 基盤（executeChild・shadow/limited/primary・replay fixture
  規約・P3 不変条件: 三値 ledger / single-attempt+reconcile / 決定的
  correlation ID / E-CP-CONTRACT 変換）
- P5-T06 の Graph 型分離: channel 受信のうち Graph 系は **app-only 面
  （GraphSystemClient 系 / branded token）のみ**。delegated 面を混入させない
- AGENTS 原則: 数値・判定はコード、LLM は文章スロットのみ / sanitize 3 層 /
  監査 append-only / lib・結線分離

## Objective

**三 channel（email / Teams / GitHub）status ingest orchestration**:

1. **channel adapters（薄い結線）**: 各 channel の受信 payload →
   正規化 ingest event への写像（pure lib で正規化、adapter は結線のみ）。
   同一 source message の**重複 ingestion 排除**（source message ID による
   決定的冪等キー + CAS/unique 制約 — P3 台帳規範）
2. **ingest workflow**（`packages/control-plane`）: 正規化 event →
   preserved contract の completeness 判定 → 不足時 clarification loop
   （**max 3、count は workflow 状態でなく永続 authority で管理**）→
   accept 時 canonical persistence + acceptance notification /
   escalate_incomplete 時の宛先通知。全遷移で **E-ING audit code** を
  AuditLogWriter.append で記録
3. **canonical persistence**: 既存 PrjOps 正本（該当 repo/table）への保存。
   並行 authority 新設禁止（既存構造を使う。schema 変更が必要なら
   P1-T05 手順 + 要 amendment）

## Acceptance（WBS）

- completeness/clarification parity with the preserved pure contract
  （contract の判定と pipeline の挙動が全 fixture で一致 — parity test）
- no duplicate ingestion for the same source message（並行/再送 fixture）
- E-ING audit codes recorded（全遷移の監査記録 test）

## Forbidden

- preserved contract（statusIngestContract / freeTextValidation）の変更
- LLM による completeness/clarification 判定・依存追加（workspace link は
  要 amendment）・実資格情報・live 有効化（executionMode 規約に従う）
- main direct push / merge / approve

## Scope / allowed_paths（WBS + test 規約）

- `packages/control-plane/**` / `packages/integrations/src/graph/**` /
  `packages/shared/src/reporting/**`（**contract 本体以外**の追加のみ）/
  `packages/prjops/**` + 各 package の `tests/**`
- `.orchestration/**`（証跡）

## Validation

- channel fixture E2E（3 channel × accept/clarify×3/escalate/重複）green
- real-PostgreSQL persistence tests green
- fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P6-T11-status-ingest-pipeline`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P6-T11-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P6-T11 status=ready_for_review

## 発注時追記（2026-08-16）

- P4-T04 依存の #244 は merge 済み（entry.ts / vitest.config.ts の衝突解消）
- **並行注意（更新）**: open PR #246（server app.ts/index.ts/workbench/
  schema.sql）/ #247（contracts/agent-task）/ #248（deploy/aws）。
  これらの変更ファイルへ接触禁止。**schema 変更が必要になった場合は
  #246 が schema.sql を変更中のため、即 AGMSG で報告し指示を待つ**
  （勝手に進めない）

## Schema amendment（2026-08-16、orchestrator 条件付き承認）

- 調査結論を承認: 既存 events（dispatcher retry queue）/ pm_events
  （GitHub timeseries）への相乗りは semantics 汚染 — 新テーブル
  （per-thread clarifyCount / per-source-message unique claim /
  terminal receipt）の新設が正当
- 追加 allowed_paths: `packages/devops/src/db/schema.sql` /
  `packages/devops/src/db/migrations/2026081602xx_status_ingest_*.sql`
  （P1-T05 手順、既存テーブル inline ALTER 禁止、unique 制約で重複
  ingestion を DB 面でも排除、clarify count は check 制約 <=3）
- **順序条件**: #246 が schema.sql を変更中のため、schema.sql/migration の
  commit は **#246 の merge を確認し latest main を取り込んだ後**に行う。
  それまでは pure lib / adapters / workflow / repo interface（mock）を先行
  実装し、schema 依存部分は最後に結線する

## Dependency amendment（2026-08-16、orchestrator 承認）

- `packages/prjops` devDependencies へ `pg ^8.23.0` を追加可
  （devops/web が既に同一 range を使用 — 既存 workspace 依存の再利用であり
  新規外部依存ではない。lockfile 差分は既存解決の共有に限定されること）
- pnpm strict resolution 下で undeclared 依存に頼らない判断は正しい
  （P3-T09-R02 esbuild の教訓と同型）

## Dependency amendment 追補（2026-08-16、orchestrator 承認）

- `@types/pg ^8.21.0` も prjops devDependencies へ追加可（web が既に解決済み
  の同一 range — pg 本体と同じ「既存 workspace 依存の再利用」判定）。
  lockfile は importer 追記のみ
