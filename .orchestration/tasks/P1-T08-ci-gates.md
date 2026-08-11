# P1-T08 contract / architecture gates の CI 組込

- task_id: `P1-T08`
- 根拠: FinalArch:CON-001 / GOV-004 / GOV-005 / ADR-0020
- Writer: codex-gpt56-sol-high / Reviewer: claude-code-fable5-xhigh
- depends_on: P1-T03/T04/T05(すべて merged)。WBS P1-T08 が正本
- branch: `agent/P1-T08-ci-gates`(base = main `f2c6648` 以降)

## allowed_paths

1. `.github/workflows/ci.yml`
2. `.mise.toml`
3. `package.json`(root)
4. `scripts/**`
5. `pnpm-lock.yaml`(**唯一の許可用途**: #174 由来の欠落 `packages/policy: {}` importer の
   正規取込。他の lockfile 変更は禁止)

## deliverables

- **OPA gate**: `opa test packages/policy/policies` を mise の ci 連鎖と GitHub CI の
  両方で実行(GitHub 側は gitleaks と同様の **version + sha256 pin 方式**でバイナリ導入。
  ローカルは brew 等の既存 opa を検出、なければ明確なエラーメッセージ)
- **contract gate**: `contracts/` の `pnpm run check`(spectral lint + baseline 突合)を
  両方で実行(contracts は独立 workspace — frozen install で)
- migration 冪等 / fitness は既存 verify:db / governance が担う — 重複追加せず、
  接続関係を README か ci.yml コメントで明記
- lockfile importer(`packages/policy: {}`)の正規取込

## acceptance / 制約

- **same checks runnable locally**: `mise run ci` が新 gate を含む(ローカル green を
  単独判定してから push — 従来規律)
- **CI pinned actions**: 追加 action/バイナリはすべて version + sha pin。actionlint green
- **required check context 名 `build-test` / `gitleaks` を変えない**(ruleset 20678089 の
  required_status_checks が固定参照。新 job を required にする変更は環境ゲート =
  今回はやらない。新 gate は build-test job 内 step か、非 required の新 job とする)
- 根拠ヘッダ / spec ID 規約

## verification

- fresh DB `mise run ci` exit 0(新 gate 込み)を単独判定
- `actionlint` green
- 負検証を 1 つ以上: 例) rego を一時的に壊すと opa gate が fail する事を検証ログに記録
  (commit には含めない)

## フロー

App token push/PR、ai-generated ラベル、merge しない(approve 後 Owner merge)。

## 成果物パス

- report: `.orchestration/reports/P1-T08-report.md`
- validation: `.orchestration/validation/P1-T08-validation.md`
- sandbox: `.orchestration/sandboxes/P1-T08-sandbox.md`
- learning: `.orchestration/learning/P1-T08-learning.md`
- autoskill: `.orchestration/autoskill/runs/P1-T08-autoskill.md`
