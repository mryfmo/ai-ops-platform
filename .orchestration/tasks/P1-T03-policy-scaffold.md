# P1-T03 policy パッケージ + OPA bundle scaffold

- task_id: `P1-T03`
- 根拠: FinalArch:CON-004 / FinalArch:CON-005 / FinalArch:PRD-003 / FinalArch:FR-CP-001 / ADR-0020 / ADR-0023
- Writer: codex-gpt56-sol-high / Reviewer: claude-code-fable5-xhigh
- depends_on: P0-T10(merged)。WBS P1-T03 の定義が正本
- branch: `agent/P1-T03-policy-scaffold`(base = main `417b986` 以降)

## allowed_paths(この範囲外の編集禁止)

1. `packages/policy/**`
2. `deploy/opa/**`

pnpm-workspace.yaml は `packages/*` glob のため変更不要(触らない — P1-T01/T02 と共有パスのため)。

## deliverables

- policy input/decision の TypeScript 型(正典 schema
  `docs/plans/2026-08-final-architecture/05_contracts/policy-input.schema.json` /
  `policy-decision.schema.json` と整合。schema ファイル自体は編集禁止)
- Rego bundle scaffold(`deploy/opa/` または `packages/policy/policies/` — WBS の
  verification コマンド `opa test packages/policy/policies` に合わせ policies は
  packages/policy/policies に置く)
- unit harness(vitest + opa test)

## acceptance

- **default deny**(未知 input / 未定義 tool / 不明 risk は必ず deny。Rego テストで負証明)
- **risk levels L0〜L6 を表現**(tool-risk-catalog.yaml と整合)
- 既存規約: 新規ファイルに根拠 ID ヘッダ / lib 純粋関数と結線の分離 / FetchLike 注入
  パターン(該当箇所があれば)/ describe・it タイトルに spec ID

## verification

- `opa test packages/policy/policies`(opa CLI が環境にない場合は ENV-blocked として
  報告し green 扱いにしない — 代替に vitest 側で rego を実行しない)
- `pnpm --filter @aiops/policy run build` / `test` / `typecheck`
- fresh DB `mise run ci` exit 0 を単独判定してから push

## フロー(新標準)

- branch push・PR 作成は App token(mint: `~/.config/aiops/mint-aiops-pr-token.sh`)、
  `ai-generated` ラベル。レビューは Claude(私)。**merge しない** — approve 後に
  Owner が exact head を approve+merge。

## 成果物パス

- report: `.orchestration/reports/P1-T03-report.md`
- validation: `.orchestration/validation/P1-T03-validation.md`
- sandbox: `.orchestration/sandboxes/P1-T03-sandbox.md`
- learning: `.orchestration/learning/P1-T03-learning.md`
- autoskill: `.orchestration/autoskill/runs/P1-T03-autoskill.md`
